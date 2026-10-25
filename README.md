# Challenge Me

A web app where you challenge your friends with AI-generated challenges, prove them with photo/video, and rate each other inside private groups. A local mode works without registration.

## Tech stack

- **Frontend:** React 19, Vite, TypeScript, Recharts
- **Backend:** Express, SQLite (better-sqlite3), JWT auth, web-push notifications
- **AI:** Google Gemini (with Groq / OpenRouter options)

## Getting started

Requires Node.js 18+.

```bash
# Frontend
cp .env.example .env
npm install
npm run dev            # http://localhost:3000

# Backend (separate terminal)
cd backend
cp .env.example .env   # fill in JWT_SECRET, CSRF_SECRET, GEMINI_API_KEY, ...
npm install
npm run dev            # http://localhost:3001
```

See [backend/README.md](backend/README.md) for all backend environment variables.

## Production

Set `NODE_ENV=production`, `FRONTEND_URL`, `JWT_SECRET` and `CSRF_SECRET`. Generate VAPID keys for push notifications with `npx web-push generate-vapid-keys`.

## License

[MIT](LICENSE)
