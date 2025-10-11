import ProblemUpdate from '../models/ProblemUpdate.js';

const sanitizeProblemUpdate = (update) => ({
  id: update._id.toString(),
  problemId: update.problemId,
  titleSnapshot: update.titleSnapshot,
  summary: update.summary,
  createdAt: update.createdAt,
  problem: update.problem?._id
    ? {
        id: update.problem._id.toString(),
        title: update.problem.title,
        problemId: update.problem.problemId
      }
    : undefined
});

export const listProblemUpdates = async (req, res, next) => {
  try {
    const { limit = 20 } = req.validated?.query || {};

    const updates = await ProblemUpdate.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('problem', 'title problemId')
      .lean({ virtuals: false });

    res.json({
      items: updates.map(sanitizeProblemUpdate)
    });
  } catch (error) {
    next(error);
  }
};
