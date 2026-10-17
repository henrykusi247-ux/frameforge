const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const DB_FILE = path.join(__dirname, 'db.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function loadDB() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return { jobs: [], projects: [] };
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function loadUsers() {
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

const app = express();
app.use(cors());
app.use(express.json());

// Health
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Auth: signup
app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const users = loadUsers();
  if (users.find(u => u.email === email)) return res.status(409).json({ error: 'user exists' });
  const hash = await bcrypt.hash(password, 10);
  const user = { id: uuidv4(), email, passwordHash: hash, createdAt: new Date().toISOString() };
  users.unshift(user);
  saveUsers(users);
  const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
  res.status(201).json({ token });
});

// Auth: login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const users = loadUsers();
  const user = users.find(u => u.email === email);
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token });
});

// Middleware: optional auth (sets req.user if token provided)
function authOptional(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return next();
  const parts = auth.split(' ');
  if (parts.length !== 2) return next();
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
  } catch (err) {
    // ignore
  }
  next();
}

// Middleware: required auth
function authRequired(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'authorization required' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'invalid authorization' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

app.use(authOptional);

// Create a new generation job (simulated)
app.post('/api/generate', (req, res) => {
  const { prompt, style = 'Cinematic', duration = '60 sec', voice = 'Sofia', captions = true } = req.body || {};
  if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'prompt is required' });

  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const job = {
    id,
    prompt,
    style,
    duration,
    voice,
    captions: !!captions,
    status: 'queued',
    progress: 0,
    result: null,
    createdAt,
    userId: req.user?.id || null
  };

  const db = loadDB();
  db.jobs.unshift(job);
  saveDB(db);

  // Simulate generation progress in background
  setTimeout(() => simulateProgress(id), 500);

  res.status(202).json({ jobId: id });
});

// Get job status
app.get('/api/jobs/:id', (req, res) => {
  const id = req.params.id;
  const db = loadDB();
  const job = db.jobs.find((j) => j.id === id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// List recent jobs (optional filtering)
app.get('/api/recent', (req, res) => {
  const db = loadDB();
  const recent = db.jobs.slice(0, 20);
  res.json(recent);
});

// Save a project (prompt + settings) — requires auth
app.post('/api/projects', authRequired, (req, res) => {
  const { name = 'Untitled', prompt = '', settings = {} } = req.body || {};
  if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'prompt is required' });
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const project = { id, name, prompt, settings, createdAt, userId: req.user.id };
  const db = loadDB();
  db.projects.unshift(project);
  saveDB(db);
  res.status(201).json(project);
});

// Get projects — returns public projects and user projects (auth optional)
app.get('/api/projects', (req, res) => {
  const db = loadDB();
  const projects = db.projects.filter(p => !p.userId || (req.user && p.userId === req.user.id));
  res.json(projects.slice(0, 50));
});

// Internal: simulate job progress
function simulateProgress(jobId) {
  const db = loadDB();
  const job = db.jobs.find((j) => j.id === jobId);
  if (!job) return;
  job.status = 'processing';
  saveDB(db);

  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.floor(Math.random() * 20) + 5;
    if (progress >= 100) progress = 100;
    const db2 = loadDB();
    const job2 = db2.jobs.find((j) => j.id === jobId);
    if (!job2) {
      clearInterval(interval);
      return;
    }
    job2.progress = progress;
    job2.status = progress < 100 ? 'processing' : 'finalizing';
    saveDB(db2);

    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(() => finalizeJob(jobId), 700);
    }
  }, 800 + Math.floor(Math.random() * 600));
}

function finalizeJob(jobId) {
  const db = loadDB();
  const job = db.jobs.find((j) => j.id === jobId);
  if (!job) return;
  job.status = 'completed';
  job.progress = 100;
  // Mock result metadata — replace with real URLs when integrating a real generator
  job.result = {
    duration: job.duration,
    previewText: `Preview for: ${job.prompt.slice(0, 60)}${job.prompt.length > 60 ? '…' : ''}`,
    downloadUrl: `/api/mock/${jobId}.mp4`,
    thumbnailUrl: `/api/mock/${jobId}.png`
  };
  saveDB(db);
}

// Serve mock assets (placeholder images/videos) if present in server/mock
app.use('/api/mock', express.static(path.join(__dirname, 'mock')));

// Start server
app.listen(PORT, () => {
  console.log(`FrameForge API server running on http://localhost:${PORT}`);
});
