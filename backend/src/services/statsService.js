import UserStatsDaily from '../models/UserStatsDaily.js';

const ensureDateKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  const utcYear = date.getUTCFullYear();
  const utcMonth = date.getUTCMonth();
  const utcDay = date.getUTCDate();
  const normalized = new Date(Date.UTC(utcYear, utcMonth, utcDay));
  return normalized.toISOString().slice(0, 10);
};

export const incrementUserDailyStats = async (userId, date, { submitDelta = 0, acDelta = 0 }) => {
  const dateKey = ensureDateKey(date);

  await UserStatsDaily.updateOne(
    { user: userId, date: dateKey },
    {
      $setOnInsert: { user: userId, date: dateKey },
      $inc: {
        submitCount: submitDelta,
        acCount: acDelta
      }
    },
    { upsert: true }
  );
};
