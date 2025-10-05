import mongoose from 'mongoose';
import Problem from '../models/Problem.js';
import { findNextProblemNumber } from '../services/problemService.js';

const sanitizeTestCases = (testCases = []) =>
  testCases.map((testCase) => ({
    input: testCase.input,
    expectedOutput: testCase.expectedOutput,
    isPublic: Boolean(testCase.isPublic),
    ...(testCase.inputFileName ? { inputFileName: testCase.inputFileName } : {}),
    ...(testCase.outputFileName ? { outputFileName: testCase.outputFileName } : {})
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
      Problem.find(
        filters,
        'title slug description judge0LanguageIds problemNumber submissionCount acceptedSubmissionCount createdAt updatedAt'
      )
        .sort({ problemNumber: 1 })
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
    const sanitizedTestCases = sanitizeTestCases(payload.testCases);

    const MAX_NUMBER_RETRIES = 5;

    for (let attempt = 0; attempt < MAX_NUMBER_RETRIES; attempt += 1) {
      const problemNumber = await findNextProblemNumber();

      try {
        const problem = await Problem.create({
          ...payload,
          problemNumber,
          testCases: sanitizedTestCases
        });

        res.status(201).json(problem);
        return;
      } catch (error) {
        if (error.code === 11000) {
          if (error.keyPattern?.slug) {
            return res.status(409).json({ message: 'A problem with this slug already exists' });
          }

          if (error.keyPattern?.problemNumber) {
            if (attempt < MAX_NUMBER_RETRIES - 1) {
              continue;
            }

            return res.status(503).json({ message: 'Failed to allocate a unique problem number' });
          }
        }

        throw error;
      }
    }

    return res.status(503).json({ message: 'Failed to allocate a unique problem number' });
  } catch (error) {
    if (error.message === 'All problem numbers are in use') {
      return res.status(503).json({ message: error.message });
    }
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

    if (Object.prototype.hasOwnProperty.call(updates, 'problemNumber')) {
      delete updates.problemNumber;
    }

    ['submissionCount', 'acceptedSubmissionCount'].forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(updates, field)) {
        delete updates[field];
      }
    });

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
