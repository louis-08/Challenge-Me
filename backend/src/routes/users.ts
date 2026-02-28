import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import db from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
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

// POST /users/me/friends — add friend by username
router.post('/me/friends',
  authenticate,
  body('username').trim().isLength({ min: 1 }),
  (req: AuthRequest, res: Response): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

    const { username } = req.body as { username: string };

    const currentUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as UserRow | undefined;
    const friend = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;

    if (!currentUser) { res.status(404).json({ error: 'Session Error.' }); return; }
    if (!friend) { res.status(404).json({ error: 'Benutzer nicht gefunden.' }); return; }
    if (friend.id === req.userId) { res.status(400).json({ error: 'Du kannst dich nicht selbst hinzufügen.' }); return; }

    const friendIds: string[] = JSON.parse(currentUser.friend_ids);
    if (friendIds.includes(friend.id)) {
      res.status(409).json({ error: 'Bereits befreundet.' });
      return;
    }

    // Two-way friendship
    const addFriend = db.transaction(() => {
      friendIds.push(friend.id);
      db.prepare('UPDATE users SET friend_ids = ? WHERE id = ?')
        .run(JSON.stringify(friendIds), req.userId);

      const friendFriendIds: string[] = JSON.parse(friend.friend_ids);
      if (!friendFriendIds.includes(req.userId!)) {
        friendFriendIds.push(req.userId!);
        db.prepare('UPDATE users SET friend_ids = ? WHERE id = ?')
          .run(JSON.stringify(friendFriendIds), friend.id);
      }
    });
    addFriend();

    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as UserRow;
    res.json(toPublicUser(updatedUser));
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
