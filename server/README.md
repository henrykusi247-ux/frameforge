## Backend notes (updated)

Auth
- POST /api/auth/signup { email, password } -> { token }
- POST /api/auth/login { email, password } -> { token }

Protected endpoints
- POST /api/projects -> requires Authorization: Bearer <token>

Dev
- server uses simple file-based persistence (server/db.json and server/users.json)
- To run locally:
  cd server
  npm install
  npm run dev

Next steps to production
- Replace file-based storage with a Postgres DB (DATABASE_URL)
- Use a managed auth provider (Supabase, Clerk) for easier production auth
- Replace job simulation with a real job queue and AI integration (worker)
- Store generated assets in S3 and return signed URLs
