import Problem from '../models/Problem.js';
import { evaluateDifficulty } from '../services/difficultyService.js';
import { reconcileRatingSubmissions } from '../services/ratingService.js';

export const previewDifficulty = async (req, res, next) => {
  try {
    const problem = await Problem.findOne({ problemId: req.validated.params.problemId }).lean();
    if (!problem) return res.status(404).json({ message: 'Problem not found' });
    const suggestion = await evaluateDifficulty(problem);
    res.json({ ...suggestion, expectedVersion: problem.difficultyVersion ?? 0, expectedUpdatedAt: problem.updatedAt });
  } catch (error) {
    if (error.code?.startsWith('DIFFICULTY_')) return res.status(error.status).json({ code: error.code, message: error.message });
    next(error);
  }
};

export const confirmDifficulty = async (req, res, next) => {
  try {
    const { difficultyRating, expectedVersion, expectedUpdatedAt } = req.validated.body;
    const problem = await Problem.findOne({ problemId: req.validated.params.problemId }).select('+difficultyHistory').lean();
    if (!problem) return res.status(404).json({ message: 'Problem not found' });
    if ((problem.difficultyVersion ?? 0) !== expectedVersion || +problem.updatedAt !== +new Date(expectedUpdatedAt)) {
      return res.status(409).json({ code: 'DIFFICULTY_CONFLICT', message: 'The problem changed. Reload it before confirming the difficulty.' });
    }
    if ((problem.difficultyRating ?? null) === difficultyRating) return res.json({ difficultyRating, difficultyVersion: expectedVersion });
    const at = new Date();
    const changes = problem.difficultyHistory?.length ? [] : [{ at: new Date(0), rating: problem.difficultyRating ?? null }];
    changes.push({ at, rating: difficultyRating, changedBy: req.user.id });
    const updated = await Problem.findOneAndUpdate({
      _id: problem._id, updatedAt: problem.updatedAt,
      $or: [{ difficultyVersion: expectedVersion }, ...(expectedVersion === 0 ? [{ difficultyVersion: { $exists: false } }] : [])]
    }, {
      $set: { difficultyRating, difficultyRatingPending: true },
      $inc: { difficultyVersion: 1 }, $push: { difficultyHistory: { $each: changes } }
    }, { new: true, runValidators: true }).lean();
    if (!updated) return res.status(409).json({ code: 'DIFFICULTY_CONFLICT', message: 'The problem changed. Reload it before confirming the difficulty.' });
    let ratingUpdatePending = false;
    try { await reconcileRatingSubmissions(); } catch (error) {
      ratingUpdatePending = true;
      console.error('Difficulty rating refresh deferred', { problemId: problem.problemId, message: error.message });
    }
    res.json({ difficultyRating: updated.difficultyRating, difficultyVersion: updated.difficultyVersion, ratingUpdatePending });
  } catch (error) { next(error); }
};
