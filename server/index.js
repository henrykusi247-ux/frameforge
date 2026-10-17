const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase, getUserFromToken, createProjectRecord, listProjectsForUser } = require('./supabase');

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

app.get('/api/health', (req, res) => res.json({ status: 'ok', storage: supabase ? 'supabase' : 'json' }));

async function getLocalUserFromToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return { id: payload.sub, email: payload.email };
  } catch (err) {
    return null;
  }
}

async function authOptional(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return next();
  const parts = auth.split(' ');
  if (parts.length !== 2) return next();
  const token = parts[1];
  let user = null;
  if (supabase) {
    user = await getUserFromToken(token);
  } else {
    user = await getLocalUserFromToken(token);
  }
  req.user = user;
  next();
}

async function authRequired(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'authorization required' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'invalid authorization' });
  const token = parts[1];
  let user = null;
  if (supabase) {
    user = await getUserFromToken(token);
  } else {
    user = await getLocalUserFromToken(token);
  }
  if (!user) return res.status(401).json({ error: 'invalid token' });
  req.user = user;
  next();
}

app.use(authOptional);

app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  if (supabase) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return res.status(400).json({ error: error.message });
    const user = data.user;
    if (user) {
      await supabase.from('profiles').upsert({ id: user.id, email: user.email, created_at: new Date().toISOString() });
    }
    const token = data.session?.access_token || jwt.sign({ sub: user?.id || uuidv4(), email }, JWT_SECRET, { expiresIn: '30d' });
    return res.status(201).json({ token, user: user ? { id: user.id, email: user.email } : null });
  }

  const users = loadUsers();
  if (users.find((u) => u.email === email)) return res.status(409).json({ error: 'user exists' });
  const hash = await bcrypt.hash(password, 10);
  const user = { id: uuidv4(), email, passwordHash: hash, createdAt: new Date().toISOString() };
  users.unshift(user);
  saveUsers(users);
  const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
  res.status(201).json({ token, user: { id: user.id, email: user.email } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });
    const token = data.session?.access_token;
    if (!token) return res.status(401).json({ error: 'no session token returned' });
    return res.json({ token, user: { id: data.user.id, email: data.user.email } });
  }

  const users = loadUsers();
  const user = users.find((u) => u.email === email);
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, email: user.email } });
});

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

  setTimeout(() => simulateProgress(id), 500);
  res.status(202).json({ jobId: id });
});

app.get('/api/jobs/:id', (req, res) => {
  const id = req.params.id;
  const db = loadDB();
  const job = db.jobs.find((j) => j.id === id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

app.get('/api/recent', (req, res) => {
  const db = loadDB();
  const recent = db.jobs.slice(0, 20);
  res.json(recent);
});

app.post('/api/projects', authRequired, async (req, res) => {
  const { name = 'Untitled', prompt = '', settings = {} } = req.body || {};
  if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'prompt is required' });

  if (supabase) {
    const result = await createProjectRecord({
      id: uuidv4(),
      name,
      prompt,
      settings,
      user_id: req.user.id,
      created_at: new Date().toISOString()
    });
    if (result.error) return res.status(500).json({ error: result.error.message });
    return res.status(201).json(result.data);
  }

  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const project = { id, name, prompt, settings, createdAt, userId: req.user.id };
  const db = loadDB();
  db.projects.unshift(project);
  saveDB(db);
  res.status(201).json(project);
});

app.get('/api/projects', async (req, res) => {
  if (supabase) {
    const userId = req.user?.id || null;
    const projects = await listProjectsForUser(userId);
    return res.json(projects);
  }

  const db = loadDB();
  const projects = db.projects.filter((p) => !p.userId || (req.user && p.userId === req.user.id));
  res.json(projects.slice(0, 50));
});

function simulateProgress(jobId) {
  const db = loadDB();
  const job = db.jobs.find((j) => j.id === jobId);
  if (!job) return;
  job.status = 'processing';
  saveDB(db);

  let progress = 0;
  const interval = setInterval(() => {
    const value = Math.floor(Math.random() * 20) + 5;
    progress = Math.min(progress + value, 100);
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
  job.result = {
    duration: job.duration,
    previewText: `Preview for: ${job.prompt.slice(0, 60)}${job.prompt.length > 60 ? '…' : ''}`,
    downloadUrl: `/api/mock/${jobId}.mp4`,
    thumbnailUrl: `/api/mock/${jobId}.png`
  };
  saveDB(db);
}

app.use('/api/mock', express.static(path.join(__dirname, 'mock')));

app.listen(PORT, () => {
  console.log(`FrameForge API server running on http://localhost:${PORT}`);
});
