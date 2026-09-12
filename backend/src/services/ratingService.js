import FirstSolve from '../models/FirstSolve.js';
import Problem from '../models/Problem.js';
import RatingProfile from '../models/RatingProfile.js';
import Season from '../models/Season.js';
import Submission from '../models/Submission.js';
import User from '../models/User.js';
import { buildPortfolioTimeline, calculatePortfolio } from './portfolioService.js';

export const currentSeasonFilter = (now = new Date()) => ({
  active: true, startDate: { $lte: now }, endDate: { $gt: now }
});

export const publicSeason = (season, now = new Date()) => season ? ({
  id: String(season._id), name: season.name, startDate: season.startDate,
  endDate: season.endDate, active: season.active,
  current: season.active && +season.startDate <= +now && +season.endDate > +now,
  finalizedAt: season.finalizedAt
}) : null;

export const refreshUserRating = async (userId, season = null, now = null) => {
  const scope = season ? String(season._id) : 'overall';
  // Optimistic compare-and-swap retries re-read the sources. A slower concurrent
  // worker cannot overwrite the result of a newer first accept/difficulty update.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const existing = await RatingProfile.findOne({ user: userId, scope }).lean();
    if (season?.finalizedAt && existing) return existing;
    const solves = await FirstSolve.find({ user: userId }).lean();
    const problems = await Problem.find({ _id: { $in: solves.map((solve) => solve.problem) } })
      .select('_id difficultyRating +difficultyHistory').lean();
    const portfolio = buildPortfolioTimeline(solves, new Map(problems.map((p) => [String(p._id), p])), season, now ?? new Date());
    if (!existing) {
      try {
        return (await RatingProfile.create({ user: userId, scope, ...portfolio })).toObject();
      } catch (error) {
        if (error.code === 11000) continue;
        throw error;
      }
    }
    const updated = await RatingProfile.findOneAndUpdate(
      { _id: existing._id, revision: existing.revision },
      { $set: portfolio, $inc: { revision: 1 } }, { new: true }
    ).lean();
    if (updated) return updated;
  }
  throw Object.assign(new Error('Rating is updating. Please retry.'), { status: 503, code: 'RATING_BUSY' });
};

export const refreshUserRatings = async (userId) => {
  await refreshUserRating(userId);
  const seasons = await Season.find({ finalizedAt: null, startDate: { $lte: new Date() } }).lean();
  for (const season of seasons) await refreshUserRating(userId, season);
};

const upsertFirstSolve = async (submission) => {
  const acceptedAt = submission.firstAcceptedAt;
  if (!acceptedAt) return;
  const filter = { user: submission.user?._id ?? submission.user, problem: submission.problem?._id ?? submission.problem };
  const update = {
    $min: { acceptedAt },
    $setOnInsert: { problemId: submission.problemId, problemTitle: submission.problemTitle }
  };
  let result;
  try {
    result = await FirstSolve.updateOne(filter, update, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    result = await FirstSolve.updateOne(filter, update);
  }
  return { userId: filter.user, changed: Boolean(result.upsertedCount || result.modifiedCount) };
};

export const recordFirstAccept = async (submission) => {
  const result = await upsertFirstSolve(submission);
  if (!result) return;
  // Always refresh when recovering pending work, even if the ledger was saved
  // before a crash. Replay deduplicates history and repeated accepted submissions.
  await refreshUserRatings(result.userId);
  return result.changed;
};

export const reconcileRatingSubmissions = async () => {
  const pending = await Submission.find({ ratingPending: true }).limit(100).lean();
  for (const submission of pending) {
    await recordFirstAccept(submission);
    await Submission.updateOne({ _id: submission._id, firstAcceptedAt: submission.firstAcceptedAt }, { $set: { ratingPending: false } });
  }
  const changedProblems = await Problem.find({ difficultyRatingPending: true }).select('_id difficultyVersion').lean();
  for (const problem of changedProblems) {
    for (const userId of await FirstSolve.distinct('user', { problem: problem._id })) await refreshUserRatings(userId);
    await Problem.updateOne({ _id: problem._id, difficultyVersion: problem.difficultyVersion }, { $set: { difficultyRatingPending: false } }, { timestamps: false });
  }
};

export const rankingRows = async (scope = 'overall') => {
  const [profiles, users] = await Promise.all([
    RatingProfile.find({ scope }).select('-history -anchors').lean(),
    User.find({ isActive: true, deletedAt: null }).select('_id username profilePublic').lean()
  ]);
  const byUser = new Map(profiles.map((profile) => [String(profile.user), profile]));
  const rows = users.map((user) => {
    const profile = byUser.get(String(user._id));
    return {
      user: String(user._id), username: user.username, profilePublic: user.profilePublic ?? false,
      rating: profile?.rating ?? 0, solvedCount: profile?.solvedCount ?? 0,
      ratedSolvedCount: profile?.ratedSolvedCount ?? 0
    };
  }).filter((row) => scope === 'overall' || row.solvedCount > 0);
  rows.sort((a, b) => b.rating - a.rating || b.ratedSolvedCount - a.ratedSolvedCount ||
    (a.username < b.username ? -1 : a.username > b.username ? 1 : a.user.localeCompare(b.user)));
  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
};

export const initializeSeasonRatings = async (now = new Date()) => {
  const seasons = await Season.find({ ratingsInitializedAt: null, finalizedAt: null, startDate: { $lte: now } }).lean();
  for (const season of seasons) {
    const userIds = await FirstSolve.distinct('user', { acceptedAt: { $gte: season.startDate, $lt: season.endDate } });
    for (const userId of userIds) await refreshUserRating(userId, season, +season.endDate <= +now ? now : null);
    await Season.updateOne({ _id: season._id, ratingsInitializedAt: null }, { $set: { ratingsInitializedAt: now } });
  }
};

export const finalizeEndedSeasons = async (now = new Date()) => {
  await initializeSeasonRatings(now);
  const seasons = await Season.find({ finalizedAt: null, endDate: { $lte: now } }).lean();
  for (const season of seasons) {
    // Never seal an archive while a persisted AC from that period still awaits recovery.
    if (await Submission.exists({ ratingPending: true, firstAcceptedAt: { $gte: season.startDate, $lt: season.endDate } })) continue;
    const userIds = await FirstSolve.distinct('user', { acceptedAt: { $gte: season.startDate, $lt: season.endDate } });
    for (const userId of userIds) await refreshUserRating(userId, season, now);
    const results = await rankingRows(String(season._id));
    await Season.updateOne({ _id: season._id, finalizedAt: null }, { $set: { results, finalizedAt: now } });
  }
};

export const getRatingProfile = async (userId) => {
  await reconcileRatingSubmissions();
  await finalizeEndedSeasons();
  const currentSeason = await Season.findOne(currentSeasonFilter()).lean();
  const overall = await refreshUserRating(userId);
  const current = currentSeason ? await refreshUserRating(userId, currentSeason) : null;
  const [overallRows, seasonRows, past] = await Promise.all([
    rankingRows(), currentSeason ? rankingRows(String(currentSeason._id)) : [],
    Season.find({ finalizedAt: { $ne: null }, 'results.user': userId }).sort({ endDate: -1 }).lean()
  ]);
  const serialize = (profile, rows) => ({
    rating: profile?.rating ?? 0, solvedCount: profile?.solvedCount ?? 0,
    ratedSolvedCount: profile?.ratedSolvedCount ?? 0, anchors: profile?.anchors ?? calculatePortfolio().anchors,
    history: profile?.history ?? [], rank: rows.find((row) => row.user === String(userId))?.rank ?? null
  });
  return {
    overall: serialize(overall, overallRows),
    currentSeason: currentSeason ? { ...publicSeason(currentSeason), ...serialize(current, seasonRows) } : null,
    previousSeasons: past.map((season) => ({
      ...publicSeason(season), ...season.results.find((result) => String(result.user) === String(userId)),
      user: undefined
    }))
  };
};

// Idempotent migration/recovery: preserve historical ACs retained in run history,
// even when a later re-run has another verdict. No existing OJ data is removed.
export const backfillRatings = async () => {
  await Promise.all([FirstSolve.init(), RatingProfile.init()]);
  const pendingByUser = new Map();
  const cursor = Submission.find({ $or: [
    { firstAcceptedAt: { $ne: null } },
    { deletedAt: null, verdict: 'AC' },
    { deletedAt: null, 'runs.status.verdict': 'AC' }
  ] }).select('user problem problemId problemTitle firstAcceptedAt runs verdict finishedAt submittedAt createdAt').cursor();
  for await (const submission of cursor) {
    const dates = [submission.firstAcceptedAt,
      ...submission.runs.filter((run) => run.status?.verdict === 'AC').map((run) => run.at)
    ].filter(Boolean);
    if (!dates.length && submission.verdict === 'AC') dates.push(submission.finishedAt ?? submission.submittedAt ?? submission.createdAt);
    if (!dates.length) continue;
    const acceptedAt = new Date(Math.min(...dates.map((date) => +new Date(date))));
    await Submission.updateOne({ _id: submission._id }, { $set: { firstAcceptedAt: acceptedAt, ratingPending: true } });
    await upsertFirstSolve({ ...submission.toObject(), firstAcceptedAt: acceptedAt });
    const userId = String(submission.user);
    if (!pendingByUser.has(userId)) pendingByUser.set(userId, []);
    pendingByUser.get(userId).push({ updateOne: {
      filter: { _id: submission._id, firstAcceptedAt: acceptedAt },
      update: { $set: { ratingPending: false } }
    } });
  }
  // Replay once per user, rather than once per historical AC (including retries).
  // Only clear the exact processed submissions after their portfolio is durable.
  for (const [userId, updates] of pendingByUser) {
    await refreshUserRatings(userId);
    for (let offset = 0; offset < updates.length; offset += 500) {
      await Submission.bulkWrite(updates.slice(offset, offset + 500));
    }
  }
  while (await Submission.exists({ ratingPending: true })) await reconcileRatingSubmissions();
  await reconcileRatingSubmissions();
  await finalizeEndedSeasons();
};
