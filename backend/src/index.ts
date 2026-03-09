import 'dotenv/config';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import groupsRouter from './routes/groups';
import aiRouter from './routes/ai';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required but not set.');
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET;

// --- Trust proxy setting ---
app.set('trust proxy', 1);

// --- Security middleware ---
app.use(helmet());
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true, // required for httpOnly cookie auth
  exposedHeaders: ['X-CSRF-Token']
}));

// --- Global rate limiting (protects all routes) ---
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen. Bitte versuche es später erneut.' }
});
app.use(globalLimiter);

// --- Body parsing ---
app.use(express.json({ limit: '15mb' }));
app.use(cookieParser());

// --- CSRF protection (Signed Token pattern, no third-party cookies required) ---
const CSRF_HEADER = 'x-csrf-token';
const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function generateCsrfToken(): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  return jwt.sign({ type: 'csrf', nonce }, JWT_SECRET, { expiresIn: '1d' });
}

function verifyCsrfToken(token: string): boolean {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { type?: string };
    return payload.type === 'csrf';
  } catch {
    return false;
  }
}

app.use((req: Request, res: Response, next: NextFunction): void => {
  // Issue a fresh signed CSRF token in every response header for the frontend to pick up
  const csrfToken = generateCsrfToken();
  res.setHeader(CSRF_HEADER, csrfToken);

  // Validate on state-changing requests
  if (!CSRF_SAFE_METHODS.has(req.method)) {
    const headerToken = req.get(CSRF_HEADER);
    if (!headerToken || !verifyCsrfToken(headerToken)) {
      res.status(403).json({ error: 'Ungültiges CSRF-Token.' });
      return;
    }
  }

  next();
});

app.get('/csrf', (_req, res) => {
  res.json({ csrfToken: res.get(CSRF_HEADER) });
});

// --- Routes ---
app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/groups', groupsRouter);
app.use('/ai', aiRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// --- 404 handler ---
app.use((_req, res) => {
  res.status(404).json({ error: 'Route nicht gefunden.' });
});

// --- Error handler ---
app.use((err: Error & { type?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err.type === 'entity.too.large') {
    res.status(413).json({ error: 'Upload ist zu groß. Bitte kürzeres oder stärker komprimiertes Video verwenden.' });
    return;
  }

  console.error(err.stack);
  res.status(500).json({ error: 'Interner Serverfehler.' });
});

app.listen(PORT, () => {
  console.log(`Challenge Me backend running on http://localhost:${PORT}`);
  console.log(`Accepting requests from: ${FRONTEND_URL}`);
});

export default app;
