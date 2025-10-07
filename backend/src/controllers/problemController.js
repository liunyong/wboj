import Problem from '../models/Problem.js';
import { getNextSequence } from '../services/idService.js';

const sanitizeTestCases = (testCases = []) =>
  testCases.map((testCase) => ({
    input: testCase.input,
    expectedOutput: testCase.expectedOutput,
    isPublic: Boolean(testCase.isPublic),
    ...(testCase.inputFileName ? { inputFileName: testCase.inputFileName } : {}),
    ...(testCase.outputFileName ? { outputFileName: testCase.outputFileName } : {})
  }));

const normalizeTags = (tags = []) =>
  Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));

const normalizeAlgorithms = (algorithms = []) =>
  Array.from(new Set(algorithms.map((name) => name.trim()).filter(Boolean)));

const isAdmin = (user) => user?.role === 'admin';

const ensurePublicTestCases = (testCases = []) =>
  testCases.filter((testCase) => testCase.isPublic);

export const getProblems = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      visibility = 'public',
      difficulty
    } = req.validated?.query || {};

    const isUserAdmin = isAdmin(req.user);

    const filters = {};

    if (!isUserAdmin) {
      filters.isPublic = true;
    } else if (visibility === 'public') {
      filters.isPublic = true;
    } else if (visibility === 'private') {
      filters.isPublic = false;
    }

    if (difficulty) {
      filters.difficulty = difficulty;
    }

    const skip = (page - 1) * limit;

    const projection = {
      title: 1,
      difficulty: 1,
      tags: 1,
      algorithms: 1,
      isPublic: 1,
      problemId: 1,
      submissionCount: 1,
      acceptedSubmissionCount: 1,
      createdAt: 1,
      updatedAt: 1
    };

    const query = Problem.find(filters, projection)
      .sort({ problemId: 1 })
      .skip(skip)
      .limit(limit);

    const [items, total] = await Promise.all([query, Problem.countDocuments(filters)]);

    res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    });
  } catch (error) {
    next(error);
  }
};

export const getProblemById = async (req, res, next) => {
  try {
    const { problemId } = req.validated?.params || req.params;
    const { includePrivate = false } = req.validated?.query || {};
    const numericProblemId = Number(problemId);

    const problem = await Problem.findOne({ problemId: numericProblemId });

    if (!problem) {
      return res.status(404).json({ code: 'PROBLEM_NOT_FOUND', message: 'Problem not found' });
    }

    const isUserAdmin = isAdmin(req.user);
    const isOwner = problem.author?.toString() === req.user?.id;

    if (!problem.isPublic && !isUserAdmin && !isOwner) {
      return res.status(404).json({ code: 'PROBLEM_NOT_FOUND', message: 'Problem not found' });
    }

    const payload = problem.toObject();

    if (!(isUserAdmin || isOwner) || !includePrivate) {
      payload.testCases = ensurePublicTestCases(payload.testCases);
    }

    res.json(payload);
  } catch (error) {
    next(error);
  }
};

export const getProblemBySlug = async (req, res, next) => {
  try {
    const { slug } = req.validated?.params || req.params;
    const normalized = slug.trim().toLowerCase();

    const legacy = await Problem.collection.findOne({ slug: normalized });

    if (!legacy?.problemId) {
      return res.status(404).json({ code: 'PROBLEM_NOT_FOUND', message: 'Problem not found' });
    }

    res.redirect(301, `/api/problems/${legacy.problemId}`);
  } catch (error) {
    next(error);
  }
};

export const createProblem = async (req, res, next) => {
  try {
    const payload = req.validated?.body || req.body;
    const sanitizedTestCases = sanitizeTestCases(payload.testCases);
    const tags = normalizeTags(payload.tags);
    const algorithms = normalizeAlgorithms(payload.algorithms);

    const MAX_RETRIES = 5;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      const problemId = await getNextSequence('problemId');

      try {
        const problem = await Problem.create({
          ...payload,
          tags,
          algorithms,
          author: req.user?.id ?? null,
          problemId,
          testCases: sanitizedTestCases
        });

        res.status(201).json(problem);
        return;
      } catch (error) {
        if (error.code === 11000 && error.keyPattern?.problemId) {
          if (attempt < MAX_RETRIES - 1) {
            continue;
          }
          return res.status(503).json({ message: 'Failed to allocate a unique problem id' });
        }
        throw error;
      }
    }

    return res.status(503).json({ message: 'Failed to allocate a unique problem id' });
  } catch (error) {
    next(error);
  }
};

export const updateProblemVisibility = async (req, res, next) => {
  try {
    const { problemId } = req.validated?.params || req.params;
    const { isPublic } = req.validated?.body || req.body;
    const numericProblemId = Number(problemId);

    const problem = await Problem.findOneAndUpdate(
      { problemId: numericProblemId },
      { isPublic: Boolean(isPublic) },
      { new: true }
    );

    if (!problem) {
      return res.status(404).json({ message: 'Problem not found' });
    }

    res.json(problem);
  } catch (error) {
    next(error);
  }
};

export const deleteProblem = async (req, res, next) => {
  try {
    const { problemId } = req.validated?.params || req.params;
    const numericProblemId = Number(problemId);

    const problem = await Problem.findOneAndDelete({ problemId: numericProblemId });

    if (!problem) {
      return res.status(404).json({ message: 'Problem not found' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getProblemAlgorithms = async (req, res, next) => {
  try {
    const results = await Problem.aggregate([
      { $unwind: '$algorithms' },
      {
        $group: {
          _id: '$algorithms',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1, _id: 1 } }
    ]);

    res.json({
      items: results.map((item) => item._id)
    });
  } catch (error) {
    next(error);
  }
};
