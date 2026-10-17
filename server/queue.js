const fs = require('fs');
const path = require('path');

const { loadDB, saveDB } = require('./storage');

const queueConnection = process.env.REDIS_URL ? { connection: new (require('ioredis'))(process.env.REDIS_URL) } : null;

function createGenerationQueue() {
  if (!process.env.REDIS_URL) return null;
  const { Queue } = require('bullmq');
  return new Queue('generation', queueConnection);
}

async function queueGenerationJob(jobPayload) {
  const queue = createGenerationQueue();
  if (!queue) return null;
  const job = await queue.add('generate', jobPayload, { removeOnComplete: true, removeOnFail: true });
  await queue.close();
  return job;
}

module.exports = {
  createGenerationQueue,
  queueGenerationJob,
};
