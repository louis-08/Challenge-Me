import 'dotenv/config';
import crypto from 'crypto';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import groupsRouter from './routes/groups';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const IS_PROD = process.env.NODE_ENV === 'production';

// --- Security middleware ---
app.use(helmet());
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true // required for httpOnly cookie auth
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
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// --- CSRF protection (Double Submit Cookie pattern) ---
const CSRF_COOKIE = 'csrf';
const CSRF_HEADER = 'x-csrf-token';
const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

app.use((req: Request, res: Response, next: NextFunction): void => {
  // Issue a CSRF token for the browser to read via JavaScript
  let csrfToken = req.cookies[CSRF_COOKIE] as string | undefined;
  if (!csrfToken) {
    csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE, csrfToken, {
      httpOnly: false, // intentionally readable by JS
      secure: IS_PROD,
      sameSite: 'strict'
    });
  }

  // Validate on state-changing requests
  if (!CSRF_SAFE_METHODS.has(req.method)) {
    const headerToken = req.get(CSRF_HEADER);
    if (!headerToken || headerToken !== csrfToken) {
      res.status(403).json({ error: 'Ungültiges CSRF-Token.' });
      return;
    }
  }

  next();
});

// --- Routes ---
app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/groups', groupsRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// --- 404 handler ---
app.use((_req, res) => {
  res.status(404).json({ error: 'Route nicht gefunden.' });
});

// --- Error handler ---
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Interner Serverfehler.' });
});

app.listen(PORT, () => {
  console.log(`Challenge Me backend running on http://localhost:${PORT}`);
  console.log(`Accepting requests from: ${FRONTEND_URL}`);
});

export default app;
