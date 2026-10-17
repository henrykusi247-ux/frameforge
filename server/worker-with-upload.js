const IORedis = require('ioredis');
const { Worker } = require('bullmq');
const { loadDB, saveDB } = require('./storage');
const { createReplicatePrediction, getPredictionResult } = require('./ai/replicate-client');
const { uploadFromUrlToSupabase } = require('./storage-upload');

async function updateJob(jobId, update) {
  const db = loadDB();
  const job = db.jobs.find((entry) => entry.id === jobId);
  if (!job) return;
  Object.assign(job, update);
  saveDB(db);
}

async function processGenerationJob(job) {
  const { jobId, prompt, style, duration, voice, captions } = job.data;
  await updateJob(jobId, { status: 'processing', progress: 5 });

  try {
    const prediction = await createReplicatePrediction({ prompt, style, duration, voice, captions });
    const predictionId = prediction?.id;
    if (!predictionId) throw new Error('Replicate request did not return a prediction id');

    let attempts = 0;
    while (attempts < 120) {
      const result = await getPredictionResult(predictionId);
      const status = result?.status || 'starting';

      if (status === 'queued' || status === 'processing' || status === 'starting') {
        const progress = Math.min(90, 15 + attempts * 1);
        await updateJob(jobId, { status: 'processing', progress });
        attempts += 1;
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }

      if (status === 'succeeded') {
        // result.output might be a URL or array of URLs
        const output = Array.isArray(result.output) ? result.output[0] : result.output;
        let uploadInfo = null;
        if (output && typeof output === 'string' && output.startsWith('http')) {
          const destPath = `videos/${jobId}${output.endsWith('.mp4') ? '.mp4' : ''}`;
          const uploaded = await uploadFromUrlToSupabase(output, destPath);
          if (uploaded.error) {
            // fall back to storing provider output URL
            await updateJob(jobId, {
              status: 'completed',
              progress: 100,
              result: {
                previewText: `Preview for: ${prompt.slice(0, 60)}${prompt.length > 60 ? '…' : ''}`,
                outputUrl: output,
                provider: 'replicate',
              },
            });
          } else {
            await updateJob(jobId, {
              status: 'completed',
              progress: 100,
              result: {
                previewText: `Preview for: ${prompt.slice(0, 60)}${prompt.length > 60 ? '…' : ''}`,
                outputUrl: uploaded.publicUrl,
                storagePath: uploaded.path,
                provider: 'replicate',
              },
            });
          }
        } else {
          // unknown output shape - store raw result
          await updateJob(jobId, {
            status: 'completed',
            progress: 100,
            result: {
              previewText: `Preview for: ${prompt.slice(0, 60)}${prompt.length > 60 ? '…' : ''}`,
              output: result.output,
              provider: 'replicate',
            },
          });
        }
        return;
      }

      if (status === 'failed' || status === 'canceled') {
        throw new Error(result?.error || 'Generation failed');
      }

      attempts += 1;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    throw new Error('Replicate job timed out');
  } catch (error) {
    await updateJob(jobId, {
      status: 'failed',
      progress: 0,
      error: error.message,
    });
    throw error;
  }
}

function startWorker() {
  if (!process.env.REDIS_URL) {
    console.log('REDIS_URL not set; generation worker is disabled.');
    return null;
  }

  const worker = new Worker(
    'generation',
    async (job) => {
      await processGenerationJob(job);
    },
    {
      connection: new IORedis(process.env.REDIS_URL),
      autorun: true,
    }
  );

  worker.on('completed', (job) => {
    console.log(`Generation job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Generation job ${job.id} failed:`, err.message);
  });

  return worker;
}

if (require.main === module) {
  // Start worker when run directly
  startWorker();
}

module.exports = { startWorker, processGenerationJob };
