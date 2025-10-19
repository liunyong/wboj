import Problem from '../models/Problem.js';
import ProblemUpdate from '../models/ProblemUpdate.js';
import { getNextSequence } from '../services/idService.js';
import { ensureProblemNumbersBackfilled } from '../services/problemNumberService.js';
import { parseTestCasesFromZip } from '../services/testCaseZipService.js';
import { buildProblemSlug } from '../utils/problemSlug.js';
import { sanitizeOptionalRichText, sanitizeRichText } from '../utils/sanitizeHtml.js';
import { recomputeProblemCounters } from '../services/submissionService.js';

const sanitizeTestCases = (testCases = []) => {
  const sanitized = (testCases ?? [])
    .map((testCase) => {
      const input = typeof testCase.input === 'string' ? testCase.input : '';
      const output = typeof testCase.output === 'string' ? testCase.output : '';
      const rawPoints = Number.parseInt(testCase.points ?? 1, 10);
      const points = Number.isFinite(rawPoints) && rawPoints >= 1 ? Math.min(rawPoints, 1000) : 1;

      if (!input || !output) {
        return null;
      }

      return {
        input,
        output,
        points
      };
    })
    .filter(Boolean);

  return sanitized.slice(0, 500);
};

const sanitizeSamples = (samples = []) =>
  (Array.isArray(samples) ? samples : []).map((sample) => {
    const normalized = {
      input: sample.input,
      output: sample.output
    };
    const explanation = sanitizeOptionalRichText(sample.explanation);
    if (explanation) {
      normalized.explanation = explanation;
    }
    return normalized;
  });

const normalizeTags = (tags = []) =>
  Array.from(new Set((Array.isArray(tags) ? tags : []).map((tag) => tag.trim()).filter(Boolean)));

const normalizeAlgorithms = (algorithms = []) =>
  Array.from(
    new Set((Array.isArray(algorithms) ? algorithms : []).map((name) => name.trim()).filter(Boolean))
  );

const isAdmin = (user) => ['admin', 'super_admin'].includes(user?.role);

const assignIfDefined = (target, key, value) => {
  if (value !== undefined) {
    target[key] = value;
  }
};

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
      problemNumber: 1,
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

    await ensureProblemNumbersBackfilled();

    const query = Problem.find(filters, projection)
      .sort({ problemNumber: 1, problemId: 1 })
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
    payload.testCaseCount = Array.isArray(problem.testCases) ? problem.testCases.length : 0;
    payload.totalPoints = Array.isArray(problem.testCases)
      ? problem.testCases.reduce((sum, testCase) => sum + (testCase.points || 0), 0)
      : 0;

    if (!(isUserAdmin || isOwner) || !includePrivate) {
      delete payload.testCases;
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
    const {
      problemNumber: _clientProblemNumber,
      problemId: _clientProblemId,
      slug: _clientSlug,
      ...clientPayload
    } = payload;
    const sanitizedTestCases = sanitizeTestCases(clientPayload.testCases);
    if (!sanitizedTestCases.length) {
      return res.status(400).json({ message: 'At least one valid test case is required' });
    }
    const tags = normalizeTags(clientPayload.tags);
    const algorithms = normalizeAlgorithms(clientPayload.algorithms);
    const sanitizedSamples = sanitizeSamples(clientPayload.samples);
    const sanitizedInputFormat = sanitizeOptionalRichText(clientPayload.inputFormat);
    const sanitizedOutputFormat = sanitizeOptionalRichText(clientPayload.outputFormat);
    const sanitizedConstraints = sanitizeOptionalRichText(clientPayload.constraints);
    const sanitizedStatement = sanitizeRichText(clientPayload.statement);
    const normalizedTitle =
      typeof clientPayload.title === 'string' ? clientPayload.title.trim() : clientPayload.title;

    await ensureProblemNumbersBackfilled();

    const MAX_RETRIES = 5;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      const problemId = await getNextSequence('problemId');
      const problemNumber = await getNextSequence('problemNumber');
      const slug = buildProblemSlug(normalizedTitle, problemId);

      try {
        const problemData = {
          title: normalizedTitle,
          statement: sanitizedStatement,
          difficulty: clientPayload.difficulty,
          isPublic: typeof clientPayload.isPublic === 'boolean' ? clientPayload.isPublic : true,
          tags,
          algorithms,
          samples: sanitizedSamples,
          judge0LanguageIds: clientPayload.judge0LanguageIds,
          testCases: sanitizedTestCases,
          author: req.user?.id ?? null,
          problemId,
          problemNumber,
          slug
        };

        assignIfDefined(problemData, 'inputFormat', sanitizedInputFormat);
        assignIfDefined(problemData, 'outputFormat', sanitizedOutputFormat);
        assignIfDefined(problemData, 'constraints', sanitizedConstraints);
        assignIfDefined(problemData, 'cpuTimeLimit', clientPayload.cpuTimeLimit);
        assignIfDefined(problemData, 'memoryLimit', clientPayload.memoryLimit);

        const problem = await Problem.create(problemData);

        try {
          await ProblemUpdate.create({
            problem: problem._id,
            problemId,
            titleSnapshot: problem.title,
            summary: `Created by ${req.user?.username ?? 'system'}`
          });
        } catch (updateError) {
          console.error('Failed to record problem creation update', updateError);
        }

        const created = problem.toObject();
        created.testCaseCount = sanitizedTestCases.length;
        created.totalPoints = sanitizedTestCases.reduce((sum, item) => sum + (item.points || 0), 0);
        res.status(201).json(created);
        return;
      } catch (error) {
        if (
          error.code === 11000 &&
          (error.keyPattern?.problemId || error.keyPattern?.problemNumber || error.keyPattern?.slug)
        ) {
          if (error.keyPattern?.problemNumber) {
            await ensureProblemNumbersBackfilled();
          }
          if (attempt < MAX_RETRIES - 1) {
            continue;
          }
          return res.status(503).json({ message: 'Failed to allocate a unique problem identifier' });
        }
        throw error;
      }
    }

    return res.status(503).json({ message: 'Failed to allocate a unique problem identifier' });
  } catch (error) {
    next(error);
  }
};

export const updateProblem = async (req, res, next) => {
  try {
    const { problemId } = req.validated?.params || req.params;
    const numericProblemId = Number(problemId);
    const updates = req.validated?.body || req.body || {};

    const problem = await Problem.findOne({ problemId: numericProblemId });

    if (!problem) {
      return res.status(404).json({ message: 'Problem not found' });
    }

    const user = req.user;
    const isOwner = problem.author?.toString() === user?.id;
    const isUserAdmin = isAdmin(user);

    if (!isUserAdmin && !isOwner) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You do not have permission to edit this problem'
      });
    }

    const normalizedTitle =
      typeof updates.title === 'string' ? updates.title.trim() : problem.title;

    const nextUpdates = {
      title: normalizedTitle,
      statement: sanitizeRichText(updates.statement),
      slug: buildProblemSlug(normalizedTitle, problem.problemId)
    };

    if (Object.prototype.hasOwnProperty.call(updates, 'inputFormat')) {
      assignIfDefined(nextUpdates, 'inputFormat', sanitizeOptionalRichText(updates.inputFormat));
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'outputFormat')) {
      assignIfDefined(nextUpdates, 'outputFormat', sanitizeOptionalRichText(updates.outputFormat));
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'constraints')) {
      assignIfDefined(nextUpdates, 'constraints', sanitizeOptionalRichText(updates.constraints));
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'difficulty')) {
      nextUpdates.difficulty = updates.difficulty;
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'isPublic')) {
      nextUpdates.isPublic = Boolean(updates.isPublic);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'samples')) {
      nextUpdates.samples = sanitizeSamples(updates.samples);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'judge0LanguageIds')) {
      nextUpdates.judge0LanguageIds = updates.judge0LanguageIds;
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'tags')) {
      nextUpdates.tags = normalizeTags(updates.tags);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'algorithms')) {
      nextUpdates.algorithms = normalizeAlgorithms(updates.algorithms);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'cpuTimeLimit')) {
      assignIfDefined(nextUpdates, 'cpuTimeLimit', updates.cpuTimeLimit);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'memoryLimit')) {
      assignIfDefined(nextUpdates, 'memoryLimit', updates.memoryLimit);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'testCases')) {
      const sanitized = sanitizeTestCases(updates.testCases);
      if (!sanitized.length) {
        return res.status(400).json({ message: 'At least one valid test case is required' });
      }
      nextUpdates.testCases = sanitized;
    }

    problem.set(nextUpdates);
    await problem.save();

    try {
      const changedFields = Object.keys(updates || {}).filter(
        (key) => key !== 'problemId' && key !== 'problemNumber'
      );
      const actor = req.user?.username ?? 'system';
      const summary =
        changedFields.length > 0
          ? `Updated by ${actor} (${changedFields.slice(0, 4).join(', ')})`
          : `Updated by ${actor}`;

      await ProblemUpdate.create({
        problem: problem._id,
        problemId: problem.problemId,
        titleSnapshot: problem.title,
        summary
      });
    } catch (updateError) {
      console.error('Failed to record problem update entry', updateError);
    }

    const payload = problem.toObject();
    payload.testCaseCount = Array.isArray(problem.testCases) ? problem.testCases.length : 0;
    payload.totalPoints = Array.isArray(problem.testCases)
      ? problem.testCases.reduce((sum, testCase) => sum + (testCase.points || 0), 0)
      : 0;

    res.json(payload);
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

export const recountProblemCounters = async (req, res, next) => {
  try {
    const { problemId } = req.validated?.params || req.params;
    const normalizedId = Number(problemId);
    if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
      return res
        .status(400)
        .json({ code: 'INVALID_PROBLEM_ID', message: 'Problem id must be a positive integer' });
    }

    const result = await recomputeProblemCounters({ problemId: normalizedId });

    res.json({
      problemId: normalizedId,
      submissionCount: result.submissionCount,
      acceptedSubmissionCount: result.acceptedSubmissionCount
    });
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

export const parseProblemTestCasesZip = async (req, res, next) => {
  try {
    const file = req.file;

    if (!file?.buffer) {
      return res.status(400).json({ message: 'ZIP file is required' });
    }

    const trimCandidate =
      req.body?.trimWhitespace ?? req.body?.trim ?? req.body?.ignoreTrailingSpaces ?? false;
    const trimFlag =
      typeof trimCandidate === 'string'
        ? ['true', '1', 'on', 'yes'].includes(trimCandidate.toLowerCase())
        : Boolean(trimCandidate);

    const { testCases, warnings } = parseTestCasesFromZip(file.buffer, {
      trimTrailingWhitespace: trimFlag
    });

    if (!testCases.length) {
      return res.status(400).json({ message: 'No valid test cases found in the ZIP archive', warnings });
    }

    res.json({ testCases, warnings });
  } catch (error) {
    if (error.message?.includes('ZIP')) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};
