import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app.js';
import connectDatabase from './config/database.js';
import { env } from './config/env.js';
import { startSubmissionWorker, stopSubmissionWorker } from './services/submissionWorkerService.js';

const startServer = async () => {
  await connectDatabase(env.mongoUri);

  const server = app.listen(env.port, () => {
    console.log(`Server listening on port ${env.port}`);
  });

  startSubmissionWorker();

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received; shutting down`);
    stopSubmissionWorker();
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
