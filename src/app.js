// Frontend app logic (wired to backend API). Falls back to local simulation if API is unavailable.
const promptInput = document.querySelector('#promptInput');
const charCount = document.querySelector('#charCount');
const toast = document.querySelector('#toast');
const toastMessage = document.querySelector('#toastMessage');
const videoFrame = document.querySelector('#videoFrame');
const playButton = document.querySelector('#playButton');
const playSmall = document.querySelector('#playSmall');
const timeline = document.querySelector('#timeline');
const timelineProgress = document.querySelector('#timelineProgress');
const timelineKnob = document.querySelector('#timelineKnob');
const playerTime = document.querySelector('#playerTime');
const captionToggle = document.querySelector('#captionToggle');
const captionPreview = document.querySelector('#captionPreview');
const previewCaption = document.querySelector('#previewCaption');
const scene = document.querySelector('#scene');
const generateButton = document.querySelector('#generateButton');
const previewLoading = document.querySelector('#previewLoading');
const previewSuccess = document.querySelector('#previewSuccess');
const progressBar = document.querySelector('#progressBar');
const progressText = document.querySelector('#progressText');
const sceneTitle = document.querySelector('#previewTitle');
let toastTimer;
let playbackTimer;
let playbackSeconds = 0;
let isPlaying = false;
let isMuted = false;
let pollTimer;
let totalDurationSeconds = 60;

function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function updateDuration() {
  const duration = document.querySelector('#durationSelect').value;
  totalDurationSeconds = duration === '2 min' ? 120 : Number.parseInt(duration, 10);
  document.querySelector('.player-controls .player-time:last-of-type').textContent = formatTime(totalDurationSeconds);
  document.querySelector('.preview-duration').innerHTML = `${formatTime(playbackSeconds)} <span>/</span> ${formatTime(totalDurationSeconds)}`;
  playbackSeconds = Math.min(playbackSeconds, totalDurationSeconds);
}

function showToast(message) {
  toastMessage.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

document.querySelector('#toastClose').addEventListener('click', () => toast.classList.remove('show'));
promptInput.addEventListener('input', () => {
  charCount.textContent = `${promptInput.value.length} / 500`;
});

// UI interactions
document.querySelectorAll('.style-card').forEach((card) => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.style-card').forEach((item) => item.classList.remove('selected'));
    card.classList.add('selected');
    const style = card.dataset.style;
    scene.dataset.style = style;
    const palettes = {
      Cinematic: ['#15233a', '#e7a87c', '#394454'],
      Anime: ['#a86d83', '#ffd7a8', '#617d89'],
      '3D Animation': ['#29224f', '#b57cde', '#37466a'],
      Documentary: ['#607d83', '#d5c39e', '#4d625b'],
    };
    const [sky, horizon, ground] = palettes[style];
    scene.style.background = `linear-gradient(180deg, ${sky} 0%, #65728a 40%, ${horizon} 73%, ${ground} 100%)`;
    showToast(`${style} style selected`);
  });
});

document.querySelectorAll('.segment').forEach((segment) => {
  segment.addEventListener('click', () => {
    document.querySelectorAll('.segment').forEach((item) => item.classList.remove('active'));
    segment.classList.add('active');
    const ratio = segment.dataset.ratio.replace(':', '-');
    videoFrame.classList.remove('ratio-16-9', 'ratio-9-16', 'ratio-1-1');
    videoFrame.classList.add(`ratio-${ratio}`);
    showToast(`${segment.dataset.ratio} aspect ratio selected`);
  });
});

document.querySelector('#voiceSelect').addEventListener('change', (event) => {
  const voice = event.currentTarget.value;
  showToast(voice === 'None' ? 'Voiceover turned off' : `${voice} voice selected`);
});
document.querySelector('#durationSelect').addEventListener('change', () => {
  updateDuration();
  showToast(`${document.querySelector('#durationSelect').value} duration selected`);
});

captionToggle.addEventListener('click', () => {
  const enabled = captionToggle.classList.toggle('on');
  captionToggle.setAttribute('aria-checked', String(enabled));
  captionPreview.style.display = enabled && isPlaying ? 'block' : 'none';
  showToast(enabled ? 'Auto-captions turned on' : 'Auto-captions turned off');
});

document.querySelector('#surpriseButton').addEventListener('click', () => {
  const ideas = [
    'A cinematic travel film following a solo hiker through the misty mountains of Patagonia at sunrise.',
    'A cozy coffee shop on a rainy afternoon, steam curling from a ceramic cup beside a foggy window.',
    'A dreamy aerial journey over the Amalfi Coast at golden hour, with sunlight dancing on the sea.',
    'A tiny astronaut floating through a pastel galaxy, surrounded by playful planets and stardust.',
  ];
  promptInput.value = ideas[Math.floor(Math.random() * ideas.length)];
  charCount.textContent = `${promptInput.value.length} / 500`;
  showToast('A little inspiration, just for you');
});

document.querySelectorAll('.recent-video').forEach((item) => {
  item.addEventListener('click', () => {
    promptInput.value = item.dataset.prompt;
    charCount.textContent = `${promptInput.value.length} / 500`;
    promptInput.focus();
    showToast('Idea added to your prompt');
  });
});

function updatePlayback() {
  playbackSeconds = playbackSeconds >= totalDurationSeconds ? 0 : playbackSeconds + 1;
  const percent = playbackSeconds / totalDurationSeconds * 100;
  timelineProgress.style.width = `${percent}%`;
  timelineKnob.style.left = `${percent}%`;
  playerTime.textContent = formatTime(playbackSeconds);
  document.querySelector('.preview-duration').innerHTML = `${formatTime(playbackSeconds)} <span>/</span> ${formatTime(totalDurationSeconds)}`;
}

function togglePlayback() {
  isPlaying = !isPlaying;
  videoFrame.classList.toggle('is-playing', isPlaying);
  playButton.style.display = isPlaying ? 'none' : 'grid';
  playSmall.textContent = isPlaying ? 'Ⅱ' : '▶';
  captionPreview.style.display = isPlaying && captionToggle.classList.contains('on') ? 'block' : 'none';
  if (isPlaying) {
    playbackTimer = setInterval(updatePlayback, 1000);
  } else {
    clearInterval(playbackTimer);
  }
}

playButton.addEventListener('click', togglePlayback);
playSmall.addEventListener('click', togglePlayback);
timeline.addEventListener('click', (event) => {
  const bounds = timeline.getBoundingClientRect();
  const percent = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
  playbackSeconds = Math.round(percent * totalDurationSeconds);
  timelineProgress.style.width = `${percent * 100}%`;
  timelineKnob.style.left = `${percent * 100}%`;
  playerTime.textContent = formatTime(playbackSeconds);
  document.querySelector('.preview-duration').innerHTML = `${formatTime(playbackSeconds)} <span>/</span> ${formatTime(totalDurationSeconds)}`;
});
document.querySelector('#volumeButton').addEventListener('click', (event) => {
  isMuted = !isMuted;
  event.currentTarget.textContent = isMuted ? '◌' : '◖';
  event.currentTarget.setAttribute('aria-label', isMuted ? 'Unmute audio' : 'Mute audio');
  showToast(isMuted ? 'Preview muted' : 'Preview audio on');
});
document.querySelector('#fullscreenButton').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else videoFrame.requestFullscreen?.();
});

// Helper: get auth token if present
function authHeaders() {
  const token = localStorage.getItem('ff_token');
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

// Poll job status and update UI
async function pollJob(jobId) {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) throw new Error('Job fetch failed');
      const job = await res.json();
      const progress = job.progress || 0;
      progressBar.style.width = `${progress}%`;
      progressText.textContent = `${progress}%`;
      if (progress >= 100 && job.status === 'completed') {
        clearInterval(pollTimer);
        previewLoading.classList.remove('visible');
        previewSuccess.classList.add('visible');
        generateButton.disabled = false;
        generateButton.innerHTML = '<span class="generate-icon">✦</span><span>Generate video</span><span class="button-arrow">→</span>';
        previewCaption.textContent = job.result?.previewText || 'A new story, made just for you.';
        captionPreview.querySelector('.caption-line').textContent = job.result?.previewText || 'A new story, made just for you.';
        sceneTitle.innerHTML = 'Your next<br />great story';
        showToast('Your video is ready to preview');
        setTimeout(() => previewSuccess.classList.remove('visible'), 2400);
      }
    } catch (err) {
      // If API fails, stop polling and fall back to local simulation
      clearInterval(pollTimer);
      showToast('Backend unavailable — falling back to local simulation');
      simulateGenerationFallback();
    }
  }, 900);
}

// Try to use backend /api/generate, otherwise fallback to local simulation
async function simulateGeneration() {
  if (!promptInput.value.trim()) {
    promptInput.focus();
    promptInput.closest('.prompt-wrap').style.borderColor = '#df8d72';
    showToast('Add a video idea to get started');
    setTimeout(() => { promptInput.closest('.prompt-wrap').style.borderColor = ''; }, 1500);
    return;
  }

  // Prepare payload
  const styleEl = document.querySelector('.style-card.selected');
  const style = styleEl ? styleEl.dataset.style : 'Cinematic';
  const payload = {
    prompt: promptInput.value,
    style,
    duration: document.querySelector('#durationSelect').value,
    voice: document.querySelector('#voiceSelect').value,
    captions: captionToggle.classList.contains('on')
  };

  // UI setup
  previewSuccess.classList.remove('visible');
  previewLoading.classList.add('visible');
  generateButton.disabled = true;
  generateButton.innerHTML = '<span class="loading-ring" style="width:13px;height:13px;margin:0"></span><span>Creating your video</span>';
  progressBar.style.width = '0%';
  progressText.textContent = '0%';

  // Try backend
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Generation request failed');
    const data = await res.json();
    const jobId = data.jobId;
    showToast('Generation started — working on it');
    pollJob(jobId);
  } catch (err) {
    // Fallback local simulation
    showToast('Backend unavailable — falling back to local simulation');
    simulateGenerationFallback();
  }
}

// Local simulation (previous behavior) used when backend is not reachable
function simulateGenerationFallback() {
  clearInterval(pollTimer);
  isPlaying = false;
  clearInterval(playbackTimer);
  videoFrame.classList.remove('is-playing');
  playButton.style.display = 'grid';
  playSmall.textContent = '▶';
  previewSuccess.classList.remove('visible');
  previewLoading.classList.add('visible');
  generateButton.disabled = true;
  generateButton.innerHTML = '<span class="loading-ring" style="width:13px;height:13px;margin:0"></span><span>Creating your video</span>';
  progressBar.style.width = '0%';
  progressText.textContent = '0%';
  let progress = 0;
  const generationTimer = setInterval(() => {
    progress += Math.floor(Math.random() * 15) + 8;
    progress = Math.min(progress, 100);
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `${progress}%`;
    if (progress >= 100) {
      clearInterval(generationTimer);
      setTimeout(() => {
        previewLoading.classList.remove('visible');
        previewSuccess.classList.add('visible');
        generateButton.disabled = false;
        generateButton.innerHTML = '<span class="generate-icon">✦</span><span>Generate video</span><span class="button-arrow">→</span>';
        previewCaption.textContent = 'A new story, made just for you.';
        captionPreview.querySelector('.caption-line').textContent = 'A new story, made just for you.';
        sceneTitle.innerHTML = 'Your next<br />great story';
        showToast('Your video is ready to preview');
        setTimeout(() => previewSuccess.classList.remove('visible'), 2400);
      }, 500);
    }
  }, 360);
}

generateButton.addEventListener('click', simulateGeneration);

document.querySelector('#newProject').addEventListener('click', () => {
  promptInput.value = '';
  charCount.textContent = '0 / 500';
  promptInput.focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  showToast('Ready for a fresh idea');
});

document.querySelector('#menuButton').addEventListener('click', () => document.querySelector('#sidebar').classList.toggle('open'));
document.querySelectorAll('.nav-item[data-view]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    document.querySelectorAll('.nav-item[data-view]').forEach((item) => item.classList.remove('active'));
    link.classList.add('active');
    if (link.dataset.view !== 'Create') showToast(`${link.dataset.view} is ready for you`);
    document.querySelector('#sidebar').classList.remove('open');
  });
});
document.querySelector('#historyButton').addEventListener('click', () => showToast('Your latest creations are listed below'));
document.querySelector('#seeAllButton').addEventListener('click', () => showToast('Showing your recent videos'));
document.querySelector('#allStylesButton').addEventListener('click', () => showToast('More visual styles are coming soon'));
document.querySelector('#upgradeButton').addEventListener('click', () => showToast('Choose a plan to unlock more credits'));
document.querySelector('#helpButton').addEventListener('click', () => showToast('Help center — we’re here to help'));
document.querySelector('#learnMoreButton').addEventListener('click', () => showToast('Describe it, choose a style, then generate'));
document.querySelector('#previewMenu').addEventListener('click', () => showToast('Preview options: your video is ready to play'));
document.querySelector('#shortcutsButton').addEventListener('click', () => showToast('Tip: ⌘ K starts a new video'));
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    document.querySelector('#newProject').click();
  }
  if (event.key === 'Escape') document.querySelector('#sidebar').classList.remove('open');
});
