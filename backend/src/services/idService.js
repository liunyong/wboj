import Counter from '../models/Counter.js';

const DEFAULT_SEEDS = {
  problemId: 99999
};

export const getNextSequence = async (name) => {
  if (!name) {
    throw new Error('Sequence name is required');
  }

  const seed = DEFAULT_SEEDS[name] ?? 0;

  const counter = await Counter.findOneAndUpdate(
    { _id: name },
    {
      $inc: { seq: 1 },
      $setOnInsert: { seq: seed }
    },
    {
      new: true,
      upsert: true
    }
  );

  if (!counter) {
    throw new Error(`Failed to allocate sequence for ${name}`);
  }

  return counter.seq;
};
