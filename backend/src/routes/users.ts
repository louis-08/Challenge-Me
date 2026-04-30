import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { addClient, removeClient } from '../sseClients';
import { Milestone } from '../types';
import {
  createNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from '../notifications';
import {
  getVapidPublicKey,
  isPushEnabled,
  removePushSubscription,
  upsertPushSubscription
} from '../push';

const UPLOADS_DIR = path.join(__dirname, '../../uploads/avatars');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
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

interface FriendRequestRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  created_at: string;
  updated_at: string;
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

function parseIds(value: string): string[] {
  try {
    return JSON.parse(value) as string[];
  } catch {
    return [];
  }
}

function addFriendEdge(userId: string, friendId: string): void {
  const row = db.prepare('SELECT friend_ids FROM users WHERE id = ?').get(userId) as { friend_ids: string } | undefined;
  if (!row) return;
  const friendIds = parseIds(row.friend_ids);
  if (!friendIds.includes(friendId)) {
    friendIds.push(friendId);
    db.prepare('UPDATE users SET friend_ids = ? WHERE id = ?').run(JSON.stringify(friendIds), userId);
  }
}

function toFriendRequestDto(request: FriendRequestRow, meId: string) {
  const otherUserId = request.from_user_id === meId ? request.to_user_id : request.from_user_id;
  const otherUser = db.prepare('SELECT * FROM users WHERE id = ?').get(otherUserId) as UserRow | undefined;
  return {
    id: request.id,
    fromUserId: request.from_user_id,
    toUserId: request.to_user_id,
    status: request.status,
    createdAt: request.created_at,
    updatedAt: request.updated_at,
    otherUser: otherUser ? toPublicUser(otherUser) : undefined
  };
}

// GET /users/stream — SSE real-time updates for notifications
router.get('/stream',
  authenticate,
  (req: AuthRequest, res: Response): void => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.socket?.setNoDelay(true);

    const userRow = db.prepare('SELECT group_ids FROM users WHERE id = ?').get(req.userId) as { group_ids: string } | undefined;
    const groupIds = userRow ? parseIds(userRow.group_ids) : [];

    addClient(req.userId!, groupIds, res);
    res.write('data: {"connected":true}\n\n');

    const heartbeat = setInterval(() => {
      try { res.write(': ping\n\n'); } catch { clearInterval(heartbeat); }
    }, 25_000);

    res.on('close', () => {
      clearInterval(heartbeat);
      removeClient(res);
    });
  }
);

// GET /users/me/notifications — latest notifications
router.get('/me/notifications',
  authenticate,
  (req: AuthRequest, res: Response): void => {
    const limitRaw = req.query.limit;
    const limit = typeof limitRaw === 'string' ? Number.parseInt(limitRaw, 10) : 50;
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, limit)) : 50;
    res.json(listNotifications(req.userId!, safeLimit));
  }
);

// GET /users/me/push/public-key — VAPID public key for browser subscription
router.get('/me/push/public-key',
  authenticate,
  (_req: AuthRequest, res: Response): void => {
    if (!isPushEnabled()) {
      res.status(503).json({ error: 'Push ist aktuell nicht konfiguriert.' });
      return;
    }
    res.json({ publicKey: getVapidPublicKey() });
  }
);

// POST /users/me/push/subscribe — store or update browser push subscription
router.post('/me/push/subscribe',
  authenticate,
  body('subscription.endpoint').isString().isLength({ min: 1 }),
  body('subscription.keys.p256dh').isString().isLength({ min: 1 }),
  body('subscription.keys.auth').isString().isLength({ min: 1 }),
  (req: AuthRequest, res: Response): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

    if (!isPushEnabled()) {
      res.status(503).json({ error: 'Push ist aktuell nicht konfiguriert.' });
      return;
    }

    const subscription = req.body.subscription as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };

    upsertPushSubscription(req.userId!, subscription);
    res.json({ ok: true });
  }
);

// POST /users/me/push/unsubscribe — remove one subscription endpoint
router.post('/me/push/unsubscribe',
  authenticate,
  body('endpoint').isString().isLength({ min: 1 }),
  (req: AuthRequest, res: Response): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

    removePushSubscription(req.userId!, req.body.endpoint as string);
    res.json({ ok: true });
  }
);

// PATCH /users/me/notifications/read-all — mark all as read
router.patch('/me/notifications/read-all',
  authenticate,
  (_req: AuthRequest, res: Response): void => {
    markAllNotificationsRead(_req.userId!);
    res.json({ ok: true });
  }
);

// PATCH /users/me/notifications/:id/read — mark one as read
router.patch('/me/notifications/:id/read',
  authenticate,
  param('id').isUUID(),
  (req: AuthRequest, res: Response): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

    const updated = markNotificationRead(req.userId!, String(req.params.id));
    if (!updated) { res.status(404).json({ error: 'Benachrichtigung nicht gefunden.' }); return; }
    res.json({ ok: true });
  }
);

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

    const friendIds: string[] = parseIds(currentUser.friend_ids);
    if (friendIds.includes(target.id)) {
      res.status(409).json({ error: 'Bereits befreundet.' });
      return;
    }

    // Check if a request already exists in either direction
    const existingPending = db.prepare(
      `SELECT id FROM friend_requests
       WHERE status = 'PENDING' AND ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))`
    ).get(req.userId, target.id, target.id, req.userId) as { id: string } | undefined;

    if (existingPending) {
      res.status(409).json({ error: 'Anfrage bereits vorhanden.' });
      return;
    }

    const requestId = uuidv4();
    db.prepare(
      'INSERT INTO friend_requests (id, from_user_id, to_user_id, status) VALUES (?, ?, ?, ?)'
    ).run(requestId, req.userId, target.id, 'PENDING');

    createNotification({
      userId: target.id,
      type: 'FRIEND_REQUEST_RECEIVED',
      title: 'Neue Freundschaftsanfrage',
      body: `${currentUser.username} hat dir eine Freundschaftsanfrage gesendet.`,
      payload: {
        requestId,
        fromUserId: currentUser.id,
        fromUsername: currentUser.username
      }
    });

    res.status(201).json({ ok: true, requestId, message: 'Freundschaftsanfrage gesendet.' });
  }
);

// GET /users/me/friends/requests — list incoming/outgoing requests
router.get('/me/friends/requests',
  authenticate,
  (req: AuthRequest, res: Response): void => {
    const scope = String(req.query.scope || 'incoming');
    let rows: FriendRequestRow[] = [];

    if (scope === 'outgoing') {
      rows = db.prepare(
        `SELECT * FROM friend_requests WHERE from_user_id = ? ORDER BY created_at DESC`
      ).all(req.userId) as FriendRequestRow[];
    } else if (scope === 'all') {
      rows = db.prepare(
        `SELECT * FROM friend_requests WHERE from_user_id = ? OR to_user_id = ? ORDER BY created_at DESC`
      ).all(req.userId, req.userId) as FriendRequestRow[];
    } else {
      rows = db.prepare(
        `SELECT * FROM friend_requests WHERE to_user_id = ? ORDER BY created_at DESC`
      ).all(req.userId) as FriendRequestRow[];
    }

    res.json(rows.map((r) => toFriendRequestDto(r, req.userId!)));
  }
);

// POST /users/me/friends/requests/:id/respond — accept or decline
router.post('/me/friends/requests/:id/respond',
  authenticate,
  param('id').isUUID(),
  body('action').isIn(['ACCEPT', 'DECLINE']),
  (req: AuthRequest, res: Response): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

    const requestRow = db.prepare('SELECT * FROM friend_requests WHERE id = ?').get(req.params.id) as FriendRequestRow | undefined;
    if (!requestRow) { res.status(404).json({ error: 'Anfrage nicht gefunden.' }); return; }
    if (requestRow.to_user_id !== req.userId) { res.status(403).json({ error: 'Kein Zugriff.' }); return; }
    if (requestRow.status !== 'PENDING') { res.status(409).json({ error: 'Anfrage wurde bereits beantwortet.' }); return; }

    const action = req.body.action as 'ACCEPT' | 'DECLINE';
    const newStatus: FriendRequestRow['status'] = action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED';

    db.transaction(() => {
      db.prepare('UPDATE friend_requests SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run(newStatus, requestRow.id);

      if (newStatus === 'ACCEPTED') {
        addFriendEdge(requestRow.from_user_id, requestRow.to_user_id);
        addFriendEdge(requestRow.to_user_id, requestRow.from_user_id);
      }
    })();

    const me = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as UserRow | undefined;
    if (me) {
      createNotification({
        userId: requestRow.from_user_id,
        type: newStatus === 'ACCEPTED' ? 'FRIEND_REQUEST_ACCEPTED' : 'FRIEND_REQUEST_DECLINED',
        title: newStatus === 'ACCEPTED' ? 'Freundschaftsanfrage angenommen' : 'Freundschaftsanfrage abgelehnt',
        body: newStatus === 'ACCEPTED'
          ? `${me.username} hat deine Freundschaftsanfrage angenommen.`
          : `${me.username} hat deine Freundschaftsanfrage abgelehnt.`,
        payload: {
          requestId: requestRow.id,
          responderUserId: me.id,
          responderUsername: me.username
        }
      });
    }

    const updated = db.prepare('SELECT * FROM friend_requests WHERE id = ?').get(requestRow.id) as FriendRequestRow;
    res.json(toFriendRequestDto(updated, req.userId!));
  }
);

// GET /users/me/friends — list current user's friends
router.get('/me/friends',
  authenticate,
  (req: AuthRequest, res: Response): void => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as UserRow | undefined;
    if (!user) { res.status(404).json({ error: 'Benutzer nicht gefunden.' }); return; }

    const friendIds: string[] = parseIds(user.friend_ids);
    if (friendIds.length === 0) { res.json([]); return; }

    const placeholders = friendIds.map(() => '?').join(',');
    const friends = db.prepare(`SELECT * FROM users WHERE id IN (${placeholders})`).all(...friendIds) as UserRow[];
    res.json(friends.map(toPublicUser));
  }
);

router.delete('/me/friends/:friendId',
  authenticate,
  param('friendId').isUUID(),
  (req: AuthRequest, res: Response): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as UserRow | undefined;
    const friend = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.friendId) as UserRow | undefined;
    if (!user || !friend) { res.status(404).json({ error: 'Benutzer nicht gefunden.' }); return; }

    const myFriends: string[] = JSON.parse(user.friend_ids);
    if (!myFriends.includes(friend.id)) { res.status(404).json({ error: 'Freundschaft nicht gefunden.' }); return; }

    db.transaction(() => {
      const updatedMyFriends = myFriends.filter(id => id !== friend.id);
      db.prepare('UPDATE users SET friend_ids = ? WHERE id = ?').run(JSON.stringify(updatedMyFriends), req.userId);

      const theirFriends = (JSON.parse(friend.friend_ids) as string[]).filter(id => id !== req.userId);
      db.prepare('UPDATE users SET friend_ids = ? WHERE id = ?').run(JSON.stringify(theirFriends), friend.id);
    })();

    res.json({ ok: true });
  }
);

// POST /users/me/avatar — upload a profile photo
router.post('/me/avatar',
  authenticate,
  avatarUpload.single('avatar'),
  (req: AuthRequest, res: Response): void => {
    if (!req.file) { res.status(400).json({ error: 'Kein Bild hochgeladen.' }); return; }

    // Delete old avatar file if it was a local upload
    const user = db.prepare('SELECT avatar FROM users WHERE id = ?').get(req.userId) as { avatar: string } | undefined;
    if (user?.avatar?.startsWith('/uploads/')) {
      const oldPath = path.join(__dirname, '../..', user.avatar);
      fs.unlink(oldPath, () => {});
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarUrl, req.userId);
    res.json({ avatar: avatarUrl });
  }
);

// PATCH /users/me/profile — update username, password, or avatar
router.patch('/me/profile',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { username, password, avatar } = req.body as { username?: string; password?: string; avatar?: string };

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as UserRow | undefined;
    if (!user) { res.status(404).json({ error: 'Benutzer nicht gefunden.' }); return; }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (username !== undefined) {
      const trimmed = username.trim();
      if (trimmed.length < 3 || trimmed.length > 30) { res.status(400).json({ error: 'Benutzername muss 3–30 Zeichen lang sein.' }); return; }
      if (!/^[a-zA-Z0-9_\-]+$/.test(trimmed)) { res.status(400).json({ error: 'Benutzername darf nur Buchstaben, Zahlen, _ und - enthalten.' }); return; }
      const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(trimmed, req.userId);
      if (existing) { res.status(409).json({ error: 'Benutzername bereits vergeben.' }); return; }
      updates.push('username = ?');
      values.push(trimmed);
    }

    if (password !== undefined) {
      if (password.length < 6) { res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen lang sein.' }); return; }
      const hash = await bcrypt.hash(password, 12);
      updates.push('password = ?');
      values.push(hash);
    }

    if (avatar !== undefined) {
      updates.push('avatar = ?');
      values.push(avatar);
    }

    if (updates.length === 0) { res.status(400).json({ error: 'Keine Änderungen angegeben.' }); return; }

    values.push(req.userId);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...(values as Parameters<typeof db.prepare>));

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as UserRow;
    res.json(toPublicUser(updated));
  }
);

// DELETE /users/me — permanently delete own account
router.delete('/me',
  authenticate,
  (req: AuthRequest, res: Response): void => {
    db.transaction(() => {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as UserRow | undefined;
      if (user) {
        // Remove user from all their groups
        const groupIds: string[] = JSON.parse(user.group_ids);
        for (const groupId of groupIds) {
          const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as { member_ids: string } | undefined;
          if (group) {
            const newMembers = (JSON.parse(group.member_ids) as string[]).filter(id => id !== req.userId);
            db.prepare('UPDATE groups SET member_ids = ? WHERE id = ?').run(JSON.stringify(newMembers), groupId);
          }
        }
        // Remove user from friends' friend lists
        const friendIds: string[] = JSON.parse(user.friend_ids);
        for (const friendId of friendIds) {
          const friend = db.prepare('SELECT * FROM users WHERE id = ?').get(friendId) as UserRow | undefined;
          if (friend) {
            const theirFriends = (JSON.parse(friend.friend_ids) as string[]).filter(id => id !== req.userId);
            db.prepare('UPDATE users SET friend_ids = ? WHERE id = ?').run(JSON.stringify(theirFriends), friendId);
          }
        }
      }
      db.prepare('DELETE FROM friend_requests WHERE from_user_id = ? OR to_user_id = ?').run(req.userId, req.userId);
      db.prepare('DELETE FROM users WHERE id = ?').run(req.userId);
    })();
    res.json({ ok: true });
  }
);

export default router;
