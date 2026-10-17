const fetch = global.fetch || require('node-fetch');
const REPLICATE_API_URL = 'https://api.replicate.com/v1';

// This client targets Replicate's model endpoint for video models such as minimax/video-01.
// It sends a request with a prompt and optional parameters (duration, aspect_ratio, style)
// and returns the prediction object. Adjust the input shape if you use a different model.

async function createReplicatePrediction({ prompt, style, duration, voice, captions }) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error('REPLICATE_API_TOKEN is missing');
  }

  // Choose model from env or fallback
  const model = process.env.REPLICATE_MODEL || 'minimax/video-01';

  // Normalize duration to seconds (accepts '60 sec', '2 min', or numeric seconds)
  let durationSeconds = 10;
  if (typeof duration === 'string') {
    if (duration.includes('min')) durationSeconds = parseInt(duration, 10) * 60;
    else if (duration.includes('sec')) durationSeconds = parseInt(duration, 10);
    else durationSeconds = parseInt(duration, 10) || 10;
  } else if (typeof duration === 'number') {
    durationSeconds = duration;
  }

  // Basic prompt enrichment
  const promptText = `${prompt}\n\nStyle: ${style || 'Cinematic'}\nVoice: ${voice || 'none'}\nCaptions: ${captions ? 'on' : 'off'}`;

  // Build model input. Specific models expect different fields — consult the model docs if needed.
  const input = {
    prompt: promptText,
    // target duration in seconds — model may accept 'duration' or 'length'
    duration: durationSeconds,
    // optional tuning hints (many models accept aspect_ratio/w/h)
    aspect_ratio: process.env.REPLICATE_ASPECT_RATIO || '16:9',
  };

  const res = await fetch(`${REPLICATE_API_URL}/models/${model}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Replicate API error: ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Failed to parse Replicate response: ${text}`);
  }
}

async function getPredictionResult(predictionId) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error('REPLICATE_API_TOKEN is missing');
  }

  const res = await fetch(`${REPLICATE_API_URL}/predictions/${predictionId}`, {
    headers: {
      Authorization: `Token ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Replicate fetch error: ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Failed to parse Replicate prediction: ${text}`);
  }
}

module.exports = {
  createReplicatePrediction,
  getPredictionResult,
};
