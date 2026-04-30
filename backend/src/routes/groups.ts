import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Group, GroupChallenge, ChallengeSubmission, MediaItem } from '../types';
import { addClient, removeClient, notifyGroup, updateUserGroupSubscriptions } from '../sseClients';
import { createNotification } from '../notifications';

const router = Router();

const GROUP_UPLOADS_DIR = path.join(__dirname, '../../uploads/groups');
fs.mkdirSync(GROUP_UPLOADS_DIR, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, GROUP_UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Nur Bilddateien erlaubt.'));
  }
});

interface GroupRow {
  id: string;
  name: string;
  code: string;
  member_ids: string;
  description: string;
  avatar: string;
  active_challenge: string | null;
  past_challenges: string;
}

interface UserRow {
  id: string;
  username: string;
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
    avatar: row.avatar || undefined,
    activeChallenge: row.active_challenge ? JSON.parse(row.active_challenge) : undefined,
    pastChallenges: JSON.parse(row.past_challenges)
  };
}

function generateGroupCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function syncUserGroupSubscriptions(userId: string): void {
  const user = db.prepare('SELECT group_ids FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  const groupIds = user ? JSON.parse(user.group_ids) as string[] : [];
  updateUserGroupSubscriptions(userId, groupIds);
}

// GET /groups/stream — SSE real-time updates
router.get('/stream',
  authenticate,
  (req: AuthRequest, res: Response): void => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // prevent nginx/proxy buffering
    res.flushHeaders();

    // Disable Nagle's algorithm so each write is sent immediately
    res.socket?.setNoDelay(true);

    const userRow = db.prepare('SELECT group_ids FROM users WHERE id = ?').get(req.userId) as UserRow | undefined;
    const groupIds: string[] = userRow ? JSON.parse(userRow.group_ids) : [];

    addClient(req.userId!, groupIds, res);

    // Confirm connection
    res.write('data: {"connected":true}\n\n');

    // Keep-alive heartbeat every 25s
    const heartbeat = setInterval(() => {
      try { res.write(': ping\n\n'); } catch { clearInterval(heartbeat); }
    }, 25_000);

    res.on('close', () => {
      clearInterval(heartbeat);
      removeClient(res);
    });
  }
);

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

    for (const userId of allMembers) {
      syncUserGroupSubscriptions(userId);
    }

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

    for (const userId of memberIds) {
      syncUserGroupSubscriptions(userId);
    }

    const updated = db.prepare('SELECT * FROM groups WHERE id = ?').get(row.id) as GroupRow;
    notifyGroup(row.id, { type: 'GROUP_UPDATED', groupId: row.id, createdAt: new Date().toISOString() });
    res.json(toGroup(updated));
  }
);

// PATCH /groups/:id — update group metadata and members
router.patch('/:id',
  authenticate,
  param('id').isUUID(),
  (req: AuthRequest, res: Response): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

    const { name, description, memberIds, avatar } = req.body as {
      name?: string;
      description?: string;
      memberIds?: string[];
      avatar?: string;
    };

    const row = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id) as GroupRow | undefined;
    if (!row) { res.status(404).json({ error: 'Gruppe nicht gefunden.' }); return; }

    const currentMemberIds: string[] = JSON.parse(row.member_ids);
    if (!currentMemberIds.includes(req.userId!)) {
      res.status(403).json({ error: 'Kein Zugriff.' });
      return;
    }

    let nextName = row.name;
    let nextDescription = row.description;
    let nextAvatar = row.avatar || '';
    let nextMemberIds = [...currentMemberIds];

    if (name !== undefined) {
      const trimmed = name.trim();
      if (trimmed.length < 1 || trimmed.length > 80) {
        res.status(400).json({ error: 'Der Gruppenname muss 1–80 Zeichen lang sein.' });
        return;
      }
      nextName = trimmed;
    }

    if (description !== undefined) {
      const trimmed = description.trim();
      if (trimmed.length > 500) {
        res.status(400).json({ error: 'Die Beschreibung darf maximal 500 Zeichen lang sein.' });
        return;
      }
      nextDescription = trimmed;
    }

    if (avatar !== undefined) {
      nextAvatar = avatar;
    }

    if (memberIds !== undefined) {
      if (!Array.isArray(memberIds)) {
        res.status(400).json({ error: 'Ungültige Mitgliederliste.' });
        return;
      }

      const uniqueMemberIds = [...new Set(memberIds.filter((id): id is string => typeof id === 'string'))];
      if (uniqueMemberIds.length === 0) {
        res.status(400).json({ error: 'Eine Gruppe muss mindestens ein Mitglied haben.' });
        return;
      }

      const requester = db.prepare('SELECT friend_ids FROM users WHERE id = ?').get(req.userId) as UserRow | undefined;
      if (!requester) { res.status(404).json({ error: 'Benutzer nicht gefunden.' }); return; }

      const friendIds: string[] = JSON.parse(requester.friend_ids);
      const addedMembers = uniqueMemberIds.filter(id => !currentMemberIds.includes(id) && id !== req.userId);
      const invalidAddedMembers = addedMembers.filter(id => !friendIds.includes(id));
      if (invalidAddedMembers.length > 0) {
        res.status(400).json({ error: 'Du kannst nur Freunde zur Gruppe hinzufügen.' });
        return;
      }

      const existingUsers = db.prepare(
        `SELECT id FROM users WHERE id IN (${uniqueMemberIds.map(() => '?').join(',')})`
      ).all(...uniqueMemberIds) as Array<{ id: string }>;
      if (existingUsers.length !== uniqueMemberIds.length) {
        res.status(400).json({ error: 'Mindestens ein Mitglied wurde nicht gefunden.' });
        return;
      }

      nextMemberIds = uniqueMemberIds;
    }

    const removedMemberIds = currentMemberIds.filter(id => !nextMemberIds.includes(id));
    const addedMemberIds = nextMemberIds.filter(id => !currentMemberIds.includes(id));

    db.transaction(() => {
      db.prepare('UPDATE groups SET name = ?, description = ?, avatar = ?, member_ids = ? WHERE id = ?')
        .run(nextName, nextDescription, nextAvatar, JSON.stringify(nextMemberIds), row.id);

      for (const userId of removedMemberIds) {
        const user = db.prepare('SELECT group_ids FROM users WHERE id = ?').get(userId) as UserRow | undefined;
        if (!user) continue;
        const groupIds = (JSON.parse(user.group_ids) as string[]).filter(groupId => groupId !== row.id);
        db.prepare('UPDATE users SET group_ids = ? WHERE id = ?').run(JSON.stringify(groupIds), userId);
      }

      for (const userId of addedMemberIds) {
        const user = db.prepare('SELECT group_ids FROM users WHERE id = ?').get(userId) as UserRow | undefined;
        if (!user) continue;
        const groupIds = JSON.parse(user.group_ids) as string[];
        if (!groupIds.includes(row.id)) {
          groupIds.push(row.id);
          db.prepare('UPDATE users SET group_ids = ? WHERE id = ?').run(JSON.stringify(groupIds), userId);
        }
      }
    })();

    for (const userId of [...new Set([...currentMemberIds, ...nextMemberIds])]) {
      syncUserGroupSubscriptions(userId);
    }

    notifyGroup(row.id, { groupId: row.id });
    const updated = db.prepare('SELECT * FROM groups WHERE id = ?').get(row.id) as GroupRow;
    res.json(toGroup(updated));
  }
);

// POST /groups/:id/avatar — upload a group avatar
router.post('/:id/avatar',
  authenticate,
  param('id').isUUID(),
  avatarUpload.single('avatar'),
  (req: AuthRequest, res: Response): void => {
    if (!req.file) { res.status(400).json({ error: 'Kein Bild hochgeladen.' }); return; }

    const row = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id) as GroupRow | undefined;
    if (!row) { res.status(404).json({ error: 'Gruppe nicht gefunden.' }); return; }

    const memberIds: string[] = JSON.parse(row.member_ids);
    if (!memberIds.includes(req.userId!)) {
      res.status(403).json({ error: 'Kein Zugriff.' });
      return;
    }

    if (row.avatar?.startsWith('/uploads/groups/')) {
      const oldPath = path.join(__dirname, '../..', row.avatar);
      fs.unlink(oldPath, () => {});
    }

    const avatarUrl = `/uploads/groups/${req.file.filename}`;
    db.prepare('UPDATE groups SET avatar = ? WHERE id = ?').run(avatarUrl, row.id);

    const updated = db.prepare('SELECT * FROM groups WHERE id = ?').get(row.id) as GroupRow;
    notifyGroup(row.id, { groupId: row.id });
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

// DELETE /groups/:id — leave or delete group
router.delete('/:id',
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

    // Notify BEFORE deleting so subscribers still exist
    notifyGroup(row.id, { type: 'GROUP_DELETED', deleted: true, id: row.id, createdAt: new Date().toISOString() });

    db.transaction(() => {
      // Remove group_id from all members
      for (const userId of memberIds) {
        const user = db.prepare('SELECT group_ids FROM users WHERE id = ?').get(userId) as UserRow | undefined;
        if (user) {
          const groupIds: string[] = JSON.parse(user.group_ids).filter((gid: string) => gid !== row.id);
          db.prepare('UPDATE users SET group_ids = ? WHERE id = ?').run(JSON.stringify(groupIds), userId);
        }
      }
      db.prepare('DELETE FROM groups WHERE id = ?').run(row.id);
    })();

    for (const userId of memberIds) {
      syncUserGroupSubscriptions(userId);
    }

    res.json({ ok: true });
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

    const creator = db.prepare('SELECT username FROM users WHERE id = ?').get(req.userId) as { username: string } | undefined;
    const creatorName = creator?.username || 'Ein Mitglied';

    for (const memberId of memberIds) {
      if (memberId === req.userId) continue;
      createNotification({
        userId: memberId,
        type: 'CHALLENGE_INVITED',
        title: 'Neue Challenge-Einladung',
        body: `${creatorName} hat eine neue Challenge in ${row.name} gestartet.`,
        payload: {
          groupId: row.id,
          challengeId: challenge.id,
          challengeTitle: challenge.title
        }
      });
    }

    const updated = db.prepare('SELECT * FROM groups WHERE id = ?').get(row.id) as GroupRow;
    notifyGroup(row.id, { type: 'GROUP_UPDATED', groupId: row.id, createdAt: new Date().toISOString() });
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
    const movedToVoting = challenge.submissions.length >= memberIds.length;
    if (challenge.submissions.length >= memberIds.length) {
      challenge.status = 'VOTING';
    }

    db.prepare('UPDATE groups SET active_challenge = ? WHERE id = ?')
      .run(JSON.stringify(challenge), row.id);

    if (movedToVoting) {
      for (const memberId of memberIds) {
        createNotification({
          userId: memberId,
          type: 'CHALLENGE_VOTING_STARTED',
          title: 'Votingphase gestartet',
          body: `Die Challenge \"${challenge.title}\" ist beendet. Das Voting hat begonnen.`,
          payload: {
            groupId: row.id,
            challengeId: challenge.id,
            challengeTitle: challenge.title
          }
        });
      }
    }

    const updated = db.prepare('SELECT * FROM groups WHERE id = ?').get(row.id) as GroupRow;
    notifyGroup(row.id, { type: 'GROUP_UPDATED', groupId: row.id, createdAt: new Date().toISOString() });
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
    if (challenge.status !== 'VOTING') {
      challenge.status = 'VOTING';
      for (const memberId of memberIds) {
        createNotification({
          userId: memberId,
          type: 'CHALLENGE_VOTING_STARTED',
          title: 'Votingphase gestartet',
          body: `Die Challenge \"${challenge.title}\" ist beendet. Das Voting hat begonnen.`,
          payload: {
            groupId: row.id,
            challengeId: challenge.id,
            challengeTitle: challenge.title
          }
        });
      }
    }

    db.prepare('UPDATE groups SET active_challenge = ? WHERE id = ?')
      .run(JSON.stringify(challenge), row.id);

    const updated = db.prepare('SELECT * FROM groups WHERE id = ?').get(row.id) as GroupRow;
    notifyGroup(row.id, { type: 'GROUP_UPDATED', groupId: row.id, createdAt: new Date().toISOString() });
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
    notifyGroup(row.id, { type: 'GROUP_UPDATED', groupId: row.id, createdAt: new Date().toISOString() });
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
    notifyGroup(row.id, { type: 'GROUP_UPDATED', groupId: row.id, createdAt: new Date().toISOString() });
    res.json(toGroup(updated));
  }
);

// POST /groups/:id/challenge/comment — add a comment to a submission during voting
router.post('/:id/challenge/comment',
  authenticate,
  param('id').isUUID(),
  body('targetUserId').isUUID(),
  body('text').trim().isLength({ min: 1, max: 500 }),
  (req: AuthRequest, res: Response): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

    const { targetUserId, text } = req.body as { targetUserId: string; text: string };
    const row = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id) as GroupRow | undefined;

    if (!row) { res.status(404).json({ error: 'Gruppe nicht gefunden.' }); return; }

    const memberIds: string[] = JSON.parse(row.member_ids);
    if (!memberIds.includes(req.userId!)) {
      res.status(403).json({ error: 'Kein Zugriff.' });
      return;
    }

    if (!row.active_challenge) { res.status(400).json({ error: 'Keine aktive Challenge.' }); return; }

    const challenge: GroupChallenge = JSON.parse(row.active_challenge);
    if (challenge.status !== 'VOTING') { res.status(400).json({ error: 'Kommentare nur in der Voting-Phase möglich.' }); return; }

    const subIdx = challenge.submissions.findIndex(s => s.userId === targetUserId);
    if (subIdx === -1) { res.status(404).json({ error: 'Einreichung nicht gefunden.' }); return; }

    if (!challenge.submissions[subIdx].comments) {
      challenge.submissions[subIdx].comments = [];
    }
    challenge.submissions[subIdx].comments!.push({
      userId: req.userId!,
      text,
      timestamp: new Date().toISOString()
    });

    db.prepare('UPDATE groups SET active_challenge = ? WHERE id = ?')
      .run(JSON.stringify(challenge), row.id);

    const updated = db.prepare('SELECT * FROM groups WHERE id = ?').get(row.id) as GroupRow;
    notifyGroup(row.id, { groupId: row.id });
    res.json(toGroup(updated));
  }
);

export default router;
