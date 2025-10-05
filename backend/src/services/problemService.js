import Problem from '../models/Problem.js';

const MAX_PROBLEM_NUMBER = 999999;

export const findNextProblemNumber = async () => {
  const problems = await Problem.find({ problemNumber: { $exists: true } }, 'problemNumber')
    .sort({ problemNumber: 1 })
    .lean();

  let expected = 1;

  for (const entry of problems) {
    const current = entry?.problemNumber;
    if (typeof current !== 'number' || Number.isNaN(current)) {
      continue;
    }

    if (current < expected) {
      continue;
    }

    if (current === expected) {
      expected += 1;
      continue;
    }

    if (current > expected) {
      break;
    }
  }

  if (expected > MAX_PROBLEM_NUMBER) {
    throw new Error('All problem numbers are in use');
  }

  return expected;
};

export const formatProblemNumber = (value) => String(value ?? '').padStart(6, '0');
