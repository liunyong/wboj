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

const normalizeSlug = (slug) => slug.toLowerCase().trim();

const normalizeTags = (tags = []) => Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));

const isAdmin = (user) => user?.role === 'admin';

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

    const query = Problem.find(filters, {
      title: 1,
      slug: 1,
      difficulty: 1,
      tags: 1,
      isPublic: 1,
      problemNumber: 1,
      submissionCount: 1,
      acceptedSubmissionCount: 1,
      createdAt: 1,
      updatedAt: 1
    })
      .sort({ problemNumber: 1 })
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

export const getProblem = async (req, res, next) => {
  try {
    const { idOrSlug } = req.validated?.params || req.params;
    const { includePrivate = false } = req.validated?.query || {};
    const isUserAdmin = isAdmin(req.user);

    const query = mongoose.isValidObjectId(idOrSlug)
      ? { _id: idOrSlug }
      : { slug: normalizeSlug(idOrSlug) };

    const problem = await Problem.findOne(query);

    if (!problem) {
      return res.status(404).json({ code: 'PROBLEM_NOT_FOUND', message: 'Problem not found' });
    }

    const isOwner = problem.author?.toString() === req.user?.id;

    if (!problem.isPublic && !isUserAdmin && !isOwner) {
      return res.status(404).json({ code: 'PROBLEM_NOT_FOUND', message: 'Problem not found' });
    }

    const payload = problem.toObject();

    if (!(isUserAdmin || isOwner) || !includePrivate) {
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
    const tags = normalizeTags(payload.tags);

    const MAX_NUMBER_RETRIES = 5;

    for (let attempt = 0; attempt < MAX_NUMBER_RETRIES; attempt += 1) {
      const problemNumber = await findNextProblemNumber();

      try {
        const problem = await Problem.create({
          ...payload,
          slug: normalizeSlug(payload.slug),
          tags,
          author: req.user?.id ?? null,
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

    if (updates.slug) {
      updates.slug = normalizeSlug(updates.slug);
    }

    if (updates.testCases) {
      updates.testCases = sanitizeTestCases(updates.testCases);
    }

    if (updates.tags) {
      updates.tags = normalizeTags(updates.tags);
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
