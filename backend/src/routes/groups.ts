import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Group, GroupChallenge, ChallengeSubmission, MediaItem } from '../types';

const router = Router();

interface GroupRow {
  id: string;
  name: string;
  code: string;
  member_ids: string;
  description: string;
  active_challenge: string | null;
  past_challenges: string;
}

interface UserRow {
  id: string;
  group_ids: string;
  friend_ids: string;
}

function toGroup(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    memberIds: JSON.parse(row.member_ids),
    description: row.description,
    activeChallenge: row.active_challenge ? JSON.parse(row.active_challenge) : undefined,
    pastChallenges: JSON.parse(row.past_challenges)
  };
}

function generateGroupCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// POST /groups — create a group
router.post('/',
  authenticate,
  body('name').trim().isLength({ min: 1, max: 80 }),
  body('memberIds').optional().isArray(),
  (req: AuthRequest, res: Response): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

    const { name, memberIds = [] } = req.body as { name: string; memberIds?: string[] };
    const allMembers = [...new Set([req.userId!, ...memberIds])];

    const id = uuidv4();
    const code = generateGroupCode();

    const createGroup = db.transaction(() => {
      db.prepare(
        'INSERT INTO groups (id, name, code, member_ids, description, past_challenges) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, name, code, JSON.stringify(allMembers), 'Eine Gruppe für gemeinsame Abenteuer.', '[]');

      for (const userId of allMembers) {
        const user = db.prepare('SELECT group_ids FROM users WHERE id = ?').get(userId) as UserRow | undefined;
        if (user) {
          const groupIds: string[] = JSON.parse(user.group_ids);
          if (!groupIds.includes(id)) {
            groupIds.push(id);
            db.prepare('UPDATE users SET group_ids = ? WHERE id = ?').run(JSON.stringify(groupIds), userId);
          }
        }
      }
    });
    createGroup();

    const row = db.prepare('SELECT * FROM groups WHERE id = ?').get(id) as GroupRow;
    res.status(201).json(toGroup(row));
  }
);

// POST /groups/join — join by code
router.post('/join',
  authenticate,
  body('code').trim().isLength({ min: 4, max: 10 }),
  (req: AuthRequest, res: Response): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

    const { code } = req.body as { code: string };
    const row = db.prepare('SELECT * FROM groups WHERE code = ?').get(code.toUpperCase()) as GroupRow | undefined;

    if (!row) { res.status(404).json({ error: 'Gruppe nicht gefunden.' }); return; }

    const memberIds: string[] = JSON.parse(row.member_ids);
    if (memberIds.includes(req.userId!)) {
      res.status(409).json({ error: 'Du bist bereits in dieser Gruppe.' });
      return;
    }

    const joinGroup = db.transaction(() => {
      memberIds.push(req.userId!);
      db.prepare('UPDATE groups SET member_ids = ? WHERE id = ?').run(JSON.stringify(memberIds), row.id);

      const user = db.prepare('SELECT group_ids FROM users WHERE id = ?').get(req.userId) as UserRow | undefined;
      if (user) {
        const groupIds: string[] = JSON.parse(user.group_ids);
        if (!groupIds.includes(row.id)) {
          groupIds.push(row.id);
          db.prepare('UPDATE users SET group_ids = ? WHERE id = ?').run(JSON.stringify(groupIds), req.userId);
        }
      }
    });
    joinGroup();

    const updated = db.prepare('SELECT * FROM groups WHERE id = ?').get(row.id) as GroupRow;
    res.json(toGroup(updated));
  }
);

// GET /groups/mine — groups for current user
router.get('/mine',
  authenticate,
  (req: AuthRequest, res: Response): void => {
    const user = db.prepare('SELECT group_ids FROM users WHERE id = ?').get(req.userId) as UserRow | undefined;
    if (!user) { res.status(404).json({ error: 'Benutzer nicht gefunden.' }); return; }

    const groupIds: string[] = JSON.parse(user.group_ids);
    if (groupIds.length === 0) { res.json([]); return; }

    const placeholders = groupIds.map(() => '?').join(',');
    const rows = db.prepare(`SELECT * FROM groups WHERE id IN (${placeholders})`).all(...groupIds) as GroupRow[];
    res.json(rows.map(toGroup));
  }
);

// GET /groups/:id — get single group
router.get('/:id',
  authenticate,
  param('id').isUUID(),
  (req: AuthRequest, res: Response): void => {
    const row = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id) as GroupRow | undefined;
    if (!row) { res.status(404).json({ error: 'Gruppe nicht gefunden.' }); return; }

    const memberIds: string[] = JSON.parse(row.member_ids);
    if (!memberIds.includes(req.userId!)) {
      res.status(403).json({ error: 'Kein Zugriff.' });
      return;
    }
    res.json(toGroup(row));
  }
);

// POST /groups/:id/challenge — start a challenge
router.post('/:id/challenge',
  authenticate,
  param('id').isUUID(),
  body('title').trim().isLength({ min: 1, max: 200 }),
  body('description').trim().isLength({ min: 1, max: 1000 }),
  body('durationMinutes').isInt({ min: 1, max: 60 * 24 * 7 * 4 }), // max 4 weeks
  (req: AuthRequest, res: Response): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

    const { title, description, durationMinutes } = req.body as { title: string; description: string; durationMinutes: number };
    const row = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id) as GroupRow | undefined;

    if (!row) { res.status(404).json({ error: 'Gruppe nicht gefunden.' }); return; }

    const memberIds: string[] = JSON.parse(row.member_ids);
    if (!memberIds.includes(req.userId!)) {
      res.status(403).json({ error: 'Kein Zugriff.' });
      return;
    }

    const deadline = new Date();
    deadline.setMinutes(deadline.getMinutes() + durationMinutes);

    const challenge: GroupChallenge = {
      id: uuidv4(),
      title,
      description,
      deadline: deadline.toISOString(),
      status: 'ACTIVE',
      submissions: []
    };

    db.prepare('UPDATE groups SET active_challenge = ? WHERE id = ?')
      .run(JSON.stringify(challenge), row.id);

    const updated = db.prepare('SELECT * FROM groups WHERE id = ?').get(row.id) as GroupRow;
    res.json(toGroup(updated));
  }
);

// POST /groups/:id/challenge/submit — submit proof
router.post('/:id/challenge/submit',
  authenticate,
  param('id').isUUID(),
  body('comment').optional().trim().isLength({ max: 1000 }),
  body('media').isArray({ max: 10 }),
  (req: AuthRequest, res: Response): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

    const { media, comment = '' } = req.body as { media: MediaItem[]; comment?: string };
    const row = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id) as GroupRow | undefined;

    if (!row) { res.status(404).json({ error: 'Gruppe nicht gefunden.' }); return; }

    const memberIds: string[] = JSON.parse(row.member_ids);
    if (!memberIds.includes(req.userId!)) {
      res.status(403).json({ error: 'Kein Zugriff.' });
      return;
    }

    if (!row.active_challenge) { res.status(400).json({ error: 'Keine aktive Challenge.' }); return; }

    const challenge: GroupChallenge = JSON.parse(row.active_challenge);
    if (challenge.status !== 'ACTIVE') { res.status(400).json({ error: 'Challenge ist nicht aktiv.' }); return; }

    const submission: ChallengeSubmission = {
      userId: req.userId!,
      media,
      comment,
      timestamp: new Date().toISOString(),
      ratings: []
    };

    const idx = challenge.submissions.findIndex(s => s.userId === req.userId);
    if (idx >= 0) {
      challenge.submissions[idx] = submission;
    } else {
      challenge.submissions.push(submission);
    }

    // Auto-transition to voting when all members have submitted
    if (challenge.submissions.length >= memberIds.length) {
      challenge.status = 'VOTING';
    }

    db.prepare('UPDATE groups SET active_challenge = ? WHERE id = ?')
      .run(JSON.stringify(challenge), row.id);

    const updated = db.prepare('SELECT * FROM groups WHERE id = ?').get(row.id) as GroupRow;
    res.json(toGroup(updated));
  }
);

// POST /groups/:id/challenge/vote — transition to voting phase
router.post('/:id/challenge/vote',
  authenticate,
  param('id').isUUID(),
  (req: AuthRequest, res: Response): void => {
    const row = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id) as GroupRow | undefined;
    if (!row) { res.status(404).json({ error: 'Gruppe nicht gefunden.' }); return; }

    const memberIds: string[] = JSON.parse(row.member_ids);
    if (!memberIds.includes(req.userId!)) {
      res.status(403).json({ error: 'Kein Zugriff.' });
      return;
    }

    if (!row.active_challenge) { res.status(400).json({ error: 'Keine aktive Challenge.' }); return; }

    const challenge: GroupChallenge = JSON.parse(row.active_challenge);
    challenge.status = 'VOTING';

    db.prepare('UPDATE groups SET active_challenge = ? WHERE id = ?')
      .run(JSON.stringify(challenge), row.id);

    const updated = db.prepare('SELECT * FROM groups WHERE id = ?').get(row.id) as GroupRow;
    res.json(toGroup(updated));
  }
);

// POST /groups/:id/challenge/rate — rate a submission
router.post('/:id/challenge/rate',
  authenticate,
  param('id').isUUID(),
  body('targetUserId').isUUID(),
  body('score').isInt({ min: 1, max: 5 }),
  (req: AuthRequest, res: Response): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

    const { targetUserId, score } = req.body as { targetUserId: string; score: number };
    const row = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id) as GroupRow | undefined;

    if (!row) { res.status(404).json({ error: 'Gruppe nicht gefunden.' }); return; }

    const memberIds: string[] = JSON.parse(row.member_ids);
    if (!memberIds.includes(req.userId!)) {
      res.status(403).json({ error: 'Kein Zugriff.' });
      return;
    }

    if (!row.active_challenge) { res.status(400).json({ error: 'Keine aktive Challenge.' }); return; }

    const challenge: GroupChallenge = JSON.parse(row.active_challenge);
    if (challenge.status !== 'VOTING') { res.status(400).json({ error: 'Nicht in der Abstimmungsphase.' }); return; }

    const subIdx = challenge.submissions.findIndex(s => s.userId === targetUserId);
    if (subIdx === -1) { res.status(404).json({ error: 'Einreichung nicht gefunden.' }); return; }

    const voteIdx = challenge.submissions[subIdx].ratings.findIndex(r => r.voterId === req.userId);
    if (voteIdx >= 0) {
      challenge.submissions[subIdx].ratings[voteIdx].score = score;
    } else {
      challenge.submissions[subIdx].ratings.push({ voterId: req.userId!, score });
    }

    db.prepare('UPDATE groups SET active_challenge = ? WHERE id = ?')
      .run(JSON.stringify(challenge), row.id);

    const updated = db.prepare('SELECT * FROM groups WHERE id = ?').get(row.id) as GroupRow;
    res.json(toGroup(updated));
  }
);

// POST /groups/:id/challenge/finish — finish challenge, compute winner
router.post('/:id/challenge/finish',
  authenticate,
  param('id').isUUID(),
  (req: AuthRequest, res: Response): void => {
    const row = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id) as GroupRow | undefined;
    if (!row) { res.status(404).json({ error: 'Gruppe nicht gefunden.' }); return; }

    const memberIds: string[] = JSON.parse(row.member_ids);
    if (!memberIds.includes(req.userId!)) {
      res.status(403).json({ error: 'Kein Zugriff.' });
      return;
    }

    if (!row.active_challenge) { res.status(400).json({ error: 'Keine aktive Challenge.' }); return; }

    const challenge: GroupChallenge = JSON.parse(row.active_challenge);

    // Compute winner
    let winnerId: string | undefined;
    let maxScore = -1;
    for (const sub of challenge.submissions) {
      const total = sub.ratings.reduce((sum, r) => sum + r.score, 0);
      const avg = sub.ratings.length ? total / sub.ratings.length : 0;
      if (avg > maxScore) {
        maxScore = avg;
        winnerId = sub.userId;
      }
    }

    challenge.status = 'COMPLETED';
    challenge.winnerId = winnerId;

    const pastChallenges: GroupChallenge[] = JSON.parse(row.past_challenges);
    pastChallenges.unshift(challenge);

    db.prepare('UPDATE groups SET active_challenge = NULL, past_challenges = ? WHERE id = ?')
      .run(JSON.stringify(pastChallenges), row.id);

    const updated = db.prepare('SELECT * FROM groups WHERE id = ?').get(row.id) as GroupRow;
    res.json(toGroup(updated));
  }
);

export default router;
