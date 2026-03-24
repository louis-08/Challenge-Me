import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { notifyUser } from '../sseClients';
import { Milestone } from '../types';

const router = Router();

interface UserRow {
  id: string;
  username: string;
  password: string;
  avatar: string;
  milestones: string;
  group_ids: string;
  friend_ids: string;
}

function toPublicUser(row: UserRow) {
  return {
    id: row.id,
    username: row.username,
    avatar: row.avatar,
    milestones: JSON.parse(row.milestones),
    groupIds: JSON.parse(row.group_ids),
    friendIds: JSON.parse(row.friend_ids)
  };
}

// GET /users/:id — get user by ID (requires auth, used by frontend)
router.get('/:id',
  authenticate,
  param('id').isUUID(),
  (req: AuthRequest, res: Response): void => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as UserRow | undefined;
    if (!user) { res.status(404).json({ error: 'Benutzer nicht gefunden.' }); return; }
    res.json(toPublicUser(user));
  }
);

// PUT /users/me/milestones — update milestones for current user
router.put('/me/milestones',
  authenticate,
  body('milestones').isArray(),
  (req: AuthRequest, res: Response): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

    const milestones: Milestone[] = req.body.milestones;
    db.prepare('UPDATE users SET milestones = ? WHERE id = ?')
      .run(JSON.stringify(milestones), req.userId);
    res.json({ ok: true });
  }
);

// POST /users/me/friend-requests — send a friend request by username
router.post('/me/friend-requests',
  authenticate,
  body('username').trim().isLength({ min: 1 }),
  (req: AuthRequest, res: Response): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

    const { username } = req.body as { username: string };

    const currentUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as UserRow | undefined;
    const target = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;

    if (!currentUser) { res.status(404).json({ error: 'Session Error.' }); return; }
    if (!target) { res.status(404).json({ error: 'Benutzer nicht gefunden.' }); return; }
    if (target.id === req.userId) { res.status(400).json({ error: 'Du kannst dich nicht selbst hinzufügen.' }); return; }

    const friendIds: string[] = JSON.parse(currentUser.friend_ids);
    if (friendIds.includes(target.id)) {
      res.status(409).json({ error: 'Bereits befreundet.' });
      return;
    }

    // Check if a request already exists in either direction
    const existing = db.prepare(
      'SELECT id FROM friend_requests WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)'
    ).get(req.userId, target.id, target.id, req.userId);
    if (existing) {
      res.status(409).json({ error: 'Anfrage bereits vorhanden.' });
      return;
    }

    const requestId = uuidv4();
    db.prepare('INSERT INTO friend_requests (id, from_user_id, to_user_id) VALUES (?, ?, ?)')
      .run(requestId, req.userId, target.id);

    // Push real-time notification to the target user if they're connected
    notifyUser(target.id, {
      friendRequest: {
        id: requestId,
        from_user_id: req.userId,
        username: currentUser.username,
        avatar: currentUser.avatar
      }
    });

    res.json({ ok: true });
  }
);

// GET /users/me/friend-requests — list incoming friend requests
router.get('/me/friend-requests',
  authenticate,
  (req: AuthRequest, res: Response): void => {
    const requests = db.prepare(
      'SELECT fr.id, fr.from_user_id, fr.created_at, u.username, u.avatar FROM friend_requests fr JOIN users u ON u.id = fr.from_user_id WHERE fr.to_user_id = ?'
    ).all(req.userId) as { id: string; from_user_id: string; created_at: string; username: string; avatar: string; }[];
    res.json(requests);
  }
);

// POST /users/me/friend-requests/:id/accept — accept a friend request
router.post('/me/friend-requests/:id/accept',
  authenticate,
  (req: AuthRequest, res: Response): void => {
    interface FRRow { id: string; from_user_id: string; to_user_id: string; }
    const fr = db.prepare('SELECT * FROM friend_requests WHERE id = ? AND to_user_id = ?').get(req.params.id, req.userId) as FRRow | undefined;
    if (!fr) { res.status(404).json({ error: 'Anfrage nicht gefunden.' }); return; }

    const me = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as UserRow;
    const sender = db.prepare('SELECT * FROM users WHERE id = ?').get(fr.from_user_id) as UserRow;

    db.transaction(() => {
      const myFriends: string[] = JSON.parse(me.friend_ids);
      if (!myFriends.includes(fr.from_user_id)) {
        myFriends.push(fr.from_user_id);
        db.prepare('UPDATE users SET friend_ids = ? WHERE id = ?').run(JSON.stringify(myFriends), req.userId);
      }
      const theirFriends: string[] = JSON.parse(sender.friend_ids);
      if (!theirFriends.includes(req.userId!)) {
        theirFriends.push(req.userId!);
        db.prepare('UPDATE users SET friend_ids = ? WHERE id = ?').run(JSON.stringify(theirFriends), fr.from_user_id);
      }
      db.prepare('DELETE FROM friend_requests WHERE id = ?').run(fr.id);
    })();

    res.json({ ok: true });
  }
);

// POST /users/me/friend-requests/:id/decline — decline a friend request
router.post('/me/friend-requests/:id/decline',
  authenticate,
  (req: AuthRequest, res: Response): void => {
    const result = db.prepare('DELETE FROM friend_requests WHERE id = ? AND to_user_id = ?').run(req.params.id, req.userId);
    if (result.changes === 0) { res.status(404).json({ error: 'Anfrage nicht gefunden.' }); return; }
    res.json({ ok: true });
  }
);

// GET /users/me/friends — list current user's friends
router.get('/me/friends',
  authenticate,
  (req: AuthRequest, res: Response): void => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as UserRow | undefined;
    if (!user) { res.status(404).json({ error: 'Benutzer nicht gefunden.' }); return; }

    const friendIds: string[] = JSON.parse(user.friend_ids);
    if (friendIds.length === 0) { res.json([]); return; }

    const placeholders = friendIds.map(() => '?').join(',');
    const friends = db.prepare(`SELECT * FROM users WHERE id IN (${placeholders})`).all(...friendIds) as UserRow[];
    res.json(friends.map(toPublicUser));
  }
);

export default router;
