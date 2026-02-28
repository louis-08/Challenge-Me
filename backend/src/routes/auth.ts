import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import db from '../db';
import { INITIAL_MILESTONES } from '../constants';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET!;
const IS_PROD = process.env.NODE_ENV === 'production';
const SALT_ROUNDS = 12;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Zu viele Anfragen. Bitte versuche es später erneut.' }
});

const validateAuth = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Benutzername muss 3–30 Zeichen lang sein.')
    .matches(/^[a-zA-Z0-9_\-]+$/)
    .withMessage('Benutzername darf nur Buchstaben, Zahlen, _ und - enthalten.'),
  body('password')
    .isLength({ min: 6, max: 128 })
    .withMessage('Passwort muss mindestens 6 Zeichen lang sein.')
];

function setTokenCookie(res: Response, userId: string): void {
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

// POST /auth/register
router.post('/register', authLimiter, validateAuth, async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg });
    return;
  }

  const { username, password } = req.body as { username: string; password: string };

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    res.status(409).json({ error: 'Benutzername bereits vergeben.' });
    return;
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const id = uuidv4();
  const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`;

  db.prepare(
    'INSERT INTO users (id, username, password, avatar, milestones) VALUES (?, ?, ?, ?, ?)'
  ).run(id, username, hash, avatar, JSON.stringify(INITIAL_MILESTONES));

  setTokenCookie(res, id);
  res.status(201).json({ id, username, avatar, milestones: INITIAL_MILESTONES, groupIds: [], friendIds: [] });
});

// POST /auth/login
router.post('/login', authLimiter, validateAuth, async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg });
    return;
  }

  const { username, password } = req.body as { username: string; password: string };

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
  if (!user) {
    res.status(401).json({ error: 'Ungültige Anmeldedaten.' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: 'Ungültige Anmeldedaten.' });
    return;
  }

  setTokenCookie(res, user.id);
  res.json(toPublicUser(user));
});

// POST /auth/logout
router.post('/logout', (_req: Request, res: Response): void => {
  res.clearCookie('token', { httpOnly: true, secure: IS_PROD, sameSite: 'strict' });
  res.json({ ok: true });
});

// GET /auth/me
import { authenticate, AuthRequest } from '../middleware/auth';

router.get('/me', authenticate, (req: AuthRequest, res: Response): void => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as UserRow | undefined;
  if (!user) {
    res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    return;
  }
  res.json(toPublicUser(user));
});

// --- Helpers ---

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

export default router;
