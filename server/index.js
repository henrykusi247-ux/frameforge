const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_FILE = path.join(__dirname, 'db.json');
const PORT = process.env.PORT || 3000;

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

const app = express();
app.use(cors());
app.use(express.json());

// Health
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

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
    createdAt
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

// Save a project (prompt + settings)
app.post('/api/projects', (req, res) => {
  const { name = 'Untitled', prompt = '', settings = {} } = req.body || {};
  if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'prompt is required' });
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const project = { id, name, prompt, settings, createdAt };
  const db = loadDB();
  db.projects.unshift(project);
  saveDB(db);
  res.status(201).json(project);
});

// Get projects
app.get('/api/projects', (req, res) => {
  const db = loadDB();
  res.json(db.projects.slice(0, 50));
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
