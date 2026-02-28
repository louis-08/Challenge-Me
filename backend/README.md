# Challenge Me — Backend

Express.js REST API backend for the Challenge Me webapp.

## Stack

| Tool | Purpose |
|------|---------|
| **Express.js** | HTTP framework |
| **better-sqlite3** | SQLite database (file-based, no extra server) |
| **bcrypt** | Password hashing (12 rounds) |
| **jsonwebtoken** | Stateless auth via httpOnly cookie |
| **helmet** | Secure HTTP headers |
| **cors** | Restrict cross-origin requests to frontend URL |
| **express-rate-limit** | Brute-force protection on auth endpoints |
| **express-validator** | Input validation & sanitisation |

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env and set a strong JWT_SECRET

# 3. Run (development)
npm run dev

# 4. Build & run (production)
npm run build
npm start
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Port the server listens on |
| `JWT_SECRET` | — | **Required in production.** Long random string |
| `NODE_ENV` | `development` | Set to `production` for secure cookies |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed CORS origin |

## API

### Auth

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | `{username, password}` | Create account |
| POST | `/auth/login` | `{username, password}` | Login, sets httpOnly cookie |
| POST | `/auth/logout` | — | Clears auth cookie |
| GET | `/auth/me` | — | Current session user |

### Users

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/users/:id` | — | Get user by ID |
| PUT | `/users/me/milestones` | `{milestones[]}` | Update milestones |
| POST | `/users/me/friends` | `{username}` | Add friend |
| GET | `/users/me/friends` | — | List friends |

### Groups

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/groups` | `{name, memberIds?}` | Create group |
| POST | `/groups/join` | `{code}` | Join by code |
| GET | `/groups/mine` | — | My groups |
| GET | `/groups/:id` | — | Single group |
| POST | `/groups/:id/challenge` | `{title, description, durationMinutes}` | Start challenge |
| POST | `/groups/:id/challenge/submit` | `{media[], comment}` | Submit proof |
| POST | `/groups/:id/challenge/vote` | — | Transition to voting |
| POST | `/groups/:id/challenge/rate` | `{targetUserId, score}` | Rate submission (1–5) |
| POST | `/groups/:id/challenge/finish` | — | Finish & compute winner |

## Security

- Passwords hashed with bcrypt (cost factor 12)
- Auth token stored in `httpOnly; Secure; SameSite=Strict` cookie — not accessible to JavaScript
- Auth endpoints rate-limited (10 requests / 15 min per IP)
- All endpoints rate-limited (100 requests / 1 min per IP globally)
- CSRF protection via Double Submit Cookie pattern:
  - Server sets a `csrf` cookie (non-httpOnly) on the first response
  - All state-changing requests (POST/PUT/DELETE) must include `X-CSRF-Token` header matching the cookie value
- All inputs validated and sanitised before processing
- HTTP security headers set by helmet
- CORS restricted to the configured frontend origin
- SQLite foreign keys enforced; WAL journal mode
