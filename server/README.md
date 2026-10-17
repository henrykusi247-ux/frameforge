# FrameForge server

This is a minimal Express backend used by the FrameForge frontend for local development and prototype workflows.

Features:
- POST /api/generate — create a simulated generation job (returns jobId)
- GET /api/jobs/:id — check job status and result
- GET /api/recent — list recent jobs
- POST /api/projects — save a small project record
- GET /api/projects — list saved projects

Quick start

1. cd server
2. npm install
3. npm run dev   # requires nodemon (dev)
4. npm start     # production

Notes

This server uses a simple JSON file at `server/db.json` to persist jobs and projects. It is intended as a lightweight mock service for development. Replace the job simulation with real background jobs and storage when integrating a real AI generation provider.
