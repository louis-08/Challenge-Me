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
import aiRouter from './routes/ai';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const IS_PROD = process.env.NODE_ENV === 'production';

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

// --- CSRF protection (Double Submit Cookie pattern) ---
const CSRF_COOKIE = 'csrf';
const CSRF_HEADER = 'x-csrf-token';
const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

app.use((req: Request, res: Response, next: NextFunction): void => {
  // Issue a CSRF token stored server-side in res.locals (not reliant on cross-origin cookie reading)
  let csrfToken = req.cookies[CSRF_COOKIE] as string | undefined;
  if (!csrfToken) {
    csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      secure: IS_PROD,
      sameSite: IS_PROD ? 'none' : 'lax'
    });
  }
  // Store in res.locals so /csrf-token endpoint can expose it
  res.locals[CSRF_COOKIE] = csrfToken;

  // In development, skip CSRF validation
  if (!IS_PROD) {
    next();
    return;
  }

  // Provide it in a response header as well
  res.setHeader(CSRF_HEADER, csrfToken);

  // Validate on state-changing requests (production only)
  if (!CSRF_SAFE_METHODS.has(req.method)) {
    const headerToken = req.get(CSRF_HEADER);
    if (!headerToken || headerToken !== csrfToken) {
      res.status(403).json({ error: 'Ungültiges CSRF-Token.' });
      return;
    }
  }

  next();
});

// Expose CSRF token to SPA (cross-origin document.cookie is not readable by JS on a different domain)
app.get('/csrf', (_req: Request, res: Response) => {
  res.json({ csrfToken: res.locals[CSRF_COOKIE] });
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
