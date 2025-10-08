import Problem from '../models/Problem.js';
import { getNextSequence } from './idService.js';

const MISSING_PROBLEM_NUMBER_FILTER = {
  $or: [{ problemNumber: { $exists: false } }, { problemNumber: null }]
};

let backfillPromise = null;

const backfillMissingProblemNumbers = async () => {
  const cursor = Problem.find(MISSING_PROBLEM_NUMBER_FILTER)
    .sort({ createdAt: 1, _id: 1 })
    .cursor();

  // Assign a unique problemNumber to each legacy problem lacking one.
  for await (const problem of cursor) {
    const nextNumber = await getNextSequence('problemNumber');
    await Problem.updateOne({ _id: problem._id }, { $set: { problemNumber: nextNumber } });
  }
};

export const ensureProblemNumbersBackfilled = async () => {
  if (backfillPromise) {
    return backfillPromise;
  }

  const needsBackfill = await Problem.exists(MISSING_PROBLEM_NUMBER_FILTER);

  if (!needsBackfill) {
    return;
  }

  backfillPromise = backfillMissingProblemNumbers().finally(() => {
    backfillPromise = null;
  });

  return backfillPromise;
};
