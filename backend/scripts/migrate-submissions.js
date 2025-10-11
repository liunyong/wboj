/* eslint-disable no-console */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import Submission from '../src/models/Submission.js';
import Problem from '../src/models/Problem.js';
import User from '../src/models/User.js';

dotenv.config({ path: process.env.BACKEND_DOTENV || '.env' });

const verdictToStatus = (verdict) => {
  switch (verdict) {
    case 'AC':
      return 'accepted';
    case 'WA':
      return 'wrong_answer';
    case 'TLE':
      return 'tle';
    case 'RTE':
      return 'rte';
    case 'CE':
      return 'ce';
    case 'MLE':
    case 'PE':
    case 'IE':
    case 'PARTIAL':
      return 'failed';
    default:
      return 'failed';
  }
};

const ensureIndexes = async () => {
  await Submission.collection.createIndex({ createdAt: -1 });
  await Submission.collection.createIndex({ user: 1, createdAt: -1 });
  await Submission.collection.createIndex({ problemId: 1, createdAt: -1 });
  await Submission.collection.createIndex({ status: 1, createdAt: -1 });
};

const backfillSubmissions = async () => {
  const cursor = Submission.find({
    $or: [
      { userName: { $exists: false } },
      { problemId: { $exists: false } },
      { problemTitle: { $exists: false } },
      { status: { $exists: false } },
      { runtimeMs: { $exists: false } },
      { memoryKB: { $exists: false } },
      { queuedAt: { $exists: false } }
    ]
  })
    .select('_id user userName problem problemId problemTitle verdict status languageId language runtimeMs execTimeMs memoryKB memoryKb queuedAt submittedAt createdAt finishedAt')
    .cursor();

  for await (const submission of cursor) {
    const updates = {};

    if (!submission.userName) {
      const user = submission.user ? await User.findById(submission.user).select('username') : null;
      updates.userName = user?.username ?? '(deleted user)';
    }

    if (!submission.problemId || !submission.problemTitle) {
      const problem =
        submission.problem != null
          ? await Problem.findById(submission.problem).select('problemId title')
          : null;
      if (problem) {
        if (!submission.problemId && problem.problemId !== undefined) {
          updates.problemId = problem.problemId;
        }
        if (!submission.problemTitle && problem.title) {
          updates.problemTitle = problem.title;
        }
      }
    }

    if (!submission.language) {
      updates.language = `language-${submission.languageId ?? 'unknown'}`;
    }

    if (!submission.status) {
      updates.status = verdictToStatus(submission.verdict);
    }

    if (!submission.runtimeMs && submission.execTimeMs !== undefined) {
      updates.runtimeMs = submission.execTimeMs;
    }

    if (!submission.memoryKB && submission.memoryKb !== undefined) {
      updates.memoryKB = submission.memoryKb;
    }

    if (!submission.queuedAt) {
      updates.queuedAt = submission.submittedAt ?? submission.createdAt ?? new Date();
    }

    if (!submission.startedAt && submission.finishedAt) {
      updates.startedAt = submission.submittedAt ?? submission.createdAt ?? submission.finishedAt;
    }

    if (Object.keys(updates).length > 0) {
      await Submission.updateOne({ _id: submission._id }, { $set: updates });
    }
  }
};

const backfillUsers = async () => {
  await User.updateMany(
    { profilePublic: { $exists: false } },
    { $set: { profilePublic: false } }
  );
};

const main = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/wboj';
  await mongoose.connect(mongoUri);

  await backfillUsers();
  await ensureIndexes();
  await backfillSubmissions();

  await mongoose.disconnect();
  console.log('Migration completed successfully.');
};

main().catch((error) => {
  console.error('Migration failed', error);
  process.exit(1);
});
