import mongoose from 'mongoose';
import Problem from '../models/Problem.js';

const sanitizeTestCases = (testCases = []) =>
  testCases.map((testCase) => ({
    input: testCase.input,
    expectedOutput: testCase.expectedOutput,
    isPublic: Boolean(testCase.isPublic)
  }));

export const getProblems = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      visibility = 'all'
    } = req.validated?.query || {};

    const filters = {};

    if (visibility === 'public') {
      filters['testCases.isPublic'] = true;
    } else if (visibility === 'private') {
      filters['testCases.isPublic'] = { $ne: true };
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Problem.find(filters, 'title slug description judge0LanguageIds')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Problem.countDocuments(filters)
    ]);

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

export const getProblem = async (req, res, next) => {
  try {
    const { idOrSlug } = req.validated?.params || req.params;
    const { includePrivate = false } = req.validated?.query || {};

    const query = mongoose.isValidObjectId(idOrSlug)
      ? { _id: idOrSlug }
      : { slug: idOrSlug };

    const problem = await Problem.findOne(query);

    if (!problem) {
      return res.status(404).json({ message: 'Problem not found' });
    }

    const payload = problem.toObject();

    if (!includePrivate) {
      payload.testCases = payload.testCases?.filter((testCase) => testCase.isPublic) ?? [];
    }

    res.json(payload);
  } catch (error) {
    next(error);
  }
};

export const createProblem = async (req, res, next) => {
  try {
    const payload = req.validated?.body || req.body;

    const problem = await Problem.create({
      ...payload,
      testCases: sanitizeTestCases(payload.testCases)
    });

    res.status(201).json(problem);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A problem with this slug already exists' });
    }
    next(error);
  }
};

export const updateProblem = async (req, res, next) => {
  try {
    const { id } = req.validated?.params || req.params;
    const updates = req.validated?.body || req.body;

    if (updates.testCases) {
      updates.testCases = sanitizeTestCases(updates.testCases);
    }

    const problem = await Problem.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });

    if (!problem) {
      return res.status(404).json({ message: 'Problem not found' });
    }

    res.json(problem);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A problem with this slug already exists' });
    }
    next(error);
  }
};

export const deleteProblem = async (req, res, next) => {
  try {
    const { id } = req.validated?.params || req.params;

    const problem = await Problem.findByIdAndDelete(id);

    if (!problem) {
      return res.status(404).json({ message: 'Problem not found' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
