import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import connectDatabase from '../src/config/database.js';
import Counter from '../src/models/Counter.js';
import Problem from '../src/models/Problem.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const START_PROBLEM_ID = 100000;

const main = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/judge0';

  await connectDatabase(mongoUri);

  const existingMax = await Problem.findOne({ problemId: { $exists: true } })
    .sort({ problemId: -1 })
    .lean();

  let nextProblemId = existingMax?.problemId
    ? Math.max(existingMax.problemId + 1, START_PROBLEM_ID)
    : START_PROBLEM_ID;

  const cursor = Problem.find({ $or: [{ problemId: { $exists: false } }, { problemId: null }] })
    .sort({ createdAt: 1, _id: 1 })
    .cursor();

  let updatedCount = 0;

  for await (const problem of cursor) {
    await Problem.updateOne({ _id: problem._id }, { $set: { problemId: nextProblemId } });
    updatedCount += 1;
    nextProblemId += 1;
  }

  if (updatedCount > 0 || nextProblemId > START_PROBLEM_ID) {
    await Counter.findOneAndUpdate(
      { _id: 'problemId' },
      { $set: { seq: Math.max(nextProblemId - 1, START_PROBLEM_ID - 1) } },
      { upsert: true }
    );
  }

  console.log(`Backfill complete. Updated ${updatedCount} problems. Next problemId: ${nextProblemId}`);
  process.exit(0);
};

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
