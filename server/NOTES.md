## Backend

A minimal Express backend was added under `server/` to simulate generation jobs and store small projects.

To run locally:

1. cd server
2. npm install
3. npm run dev   # starts server on port 3000 (nodemon)

API endpoints:
- GET /api/health
- POST /api/generate { prompt, style, duration, voice, captions }
- GET /api/jobs/:id
- GET /api/recent
- POST /api/projects { name, prompt, settings }
- GET /api/projects

Docker:
- docker build -t frameforge-server ./server
- docker run -p 3000:3000 frameforge-server
