import Problem from '../models/Problem.js';
import Submission from '../models/Submission.js';
import UserStatsDaily from '../models/UserStatsDaily.js';

const dateKey = (date) => new Date(date).toISOString().slice(0, 10);

export const reconcilePendingSubmissionAccounting = async () => {
  const pending = await Submission.find({ accountingPending: true })
    .limit(100)
    .select('_id problem user submittedAt')
    .lean();
  if (!pending.length) return 0;

  const problemIds = [...new Set(pending.map((item) => item.problem?.toString()).filter(Boolean))];
  await Promise.all(
    problemIds.map(async (problemId) => {
      const filter = { problem: problemId, deletedAt: null, finishedAt: { $ne: null } };
      const [submissionCount, acceptedSubmissionCount] = await Promise.all([
        Submission.countDocuments(filter),
        Submission.countDocuments({ ...filter, verdict: 'AC' })
      ]);
      await Problem.updateOne(
        { _id: problemId },
        { $set: { submissionCount, acceptedSubmissionCount } },
        { timestamps: false }
      );
    })
  );

  const dailyKeys = new Map();
  for (const item of pending) {
    if (!item.user || !item.submittedAt) continue;
    const day = dateKey(item.submittedAt);
    dailyKeys.set(`${item.user}:${day}`, { user: item.user, date: day });
  }
  await Promise.all(
    [...dailyKeys.values()].map(async ({ user, date }) => {
      const start = new Date(`${date}T00:00:00.000Z`);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      const filter = {
        user,
        deletedAt: null,
        finishedAt: { $ne: null },
        submittedAt: { $gte: start, $lt: end }
      };
      const [submitCount, acCount] = await Promise.all([
        Submission.countDocuments(filter),
        Submission.countDocuments({ ...filter, verdict: 'AC' })
      ]);
      await UserStatsDaily.updateOne(
        { user, date },
        { $set: { submitCount, acCount } },
        { upsert: true }
      );
    })
  );

  await Submission.updateMany(
    { _id: { $in: pending.map((item) => item._id) } },
    { $set: { accountingPending: false } }
  );
  return pending.length;
};
