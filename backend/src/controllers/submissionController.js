import mongoose from 'mongoose';
import Problem from '../models/Problem.js';
import Submission from '../models/Submission.js';
import { incrementUserDailyStats } from '../services/statsService.js';
import {
  publishSubmissionEvent,
  subscribeSubmissionStream,
  getSubmissionUpdatesSince
} from '../services/submissionStreamService.js';
import { sanitizeSourceCode } from '../utils/sourceSanitizer.js';
import { getLanguageResolver } from '../utils/languageResolver.js';
import {
  resubmitAndUpdate,
  deleteSubmission as deleteSubmissionService,
  recomputeProblemCounters,
  verdictToStatus,
  evaluateSubmissionRun
} from '../services/submissionService.js';

const loadLanguageResolver = async () => {
  try {
    return await getLanguageResolver();
  } catch (error) {
    console.warn('Failed to load Judge0 language metadata', error);
    return null;
  }
};

const isAdminLike = (user) => ['admin', 'super_admin'].includes(user?.role);
const isSuperAdmin = (user) => user?.role === 'super_admin';

const canSubmitProblem = (problem, user) => {
  if (!problem) {
    return false;
  }
  if (problem.isPublic) {
    return true;
  }
  if (!user) {
    return false;
  }
  if (isAdminLike(user)) {
    return true;
  }
  return problem.author?.toString() === user.id;
};

const deriveLanguageLabel = (languageId) => {
  if (languageId === undefined || languageId === null) {
    return '';
  }
  return `language-${languageId}`;
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const fetchSubmissionList = async ({
  page,
  limit,
  status,
  userFilter,
  problemId,
  dateFrom,
  dateTo,
  sort
} = {}, { resolveLanguageLabel } = {}) => {
  const filters = { deletedAt: null };

  if (Array.isArray(status) && status.length) {
    const uniqueStatuses = Array.from(new Set(status));
    filters.status = { $in: uniqueStatuses };
  }

  if (problemId) {
    filters.problemId = problemId;
  }

  if (userFilter) {
    if (mongoose.isValidObjectId(userFilter)) {
      filters.user = new mongoose.Types.ObjectId(userFilter);
    } else {
      filters.userName = new RegExp(escapeRegExp(userFilter), 'i');
    }
  }

  if (dateFrom || dateTo) {
    filters.createdAt = {};
    if (dateFrom) {
      filters.createdAt.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      filters.createdAt.$lte = new Date(dateTo);
    }
  }

  const sortField = sort.startsWith('-') ? sort.slice(1) : sort;
  const sortDirection = sort.startsWith('-') ? -1 : 1;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Submission.find(filters)
      .sort({ [sortField]: sortDirection })
      .skip(skip)
      .limit(limit)
      .select(
        '_id user userName problemId problemTitle language languageId status score runtimeMs execTimeMs memoryKB memoryKb createdAt queuedAt startedAt finishedAt lastRunAt'
      )
      .lean(),
    Submission.countDocuments(filters)
  ]);

  const rows = items.map((submission) =>
    sanitizedGlobalSubmission(submission, {}, { resolveLanguageLabel })
  );

  return {
    rows,
    total
  };
};

const resolveProblemForAccess = async (problemJudgeId) => {
  const normalizedId = Number(problemJudgeId);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
    return null;
  }
  return Problem.findOne({ problemId: normalizedId }).select(
    '_id problemId title isPublic author'
  );
};

const ensureProblemAccessibleToUser = async ({ problemJudgeId, user }) => {
  const problem = await resolveProblemForAccess(problemJudgeId);
  if (!problem) {
    return {
      error: {
        status: 404,
        body: { code: 'PROBLEM_NOT_FOUND', message: 'Problem not found' }
      }
    };
  }

  const isAdmin = isAdminLike(user);
  const isAuthor = problem.author?.toString() === user?.id;
  const isPublic = Boolean(problem.isPublic);

  if (!isPublic && !isAdmin && !isAuthor) {
    return {
      error: {
        status: 403,
        body: { code: 'FORBIDDEN', message: 'Problem is not accessible' }
      }
    };
  }

  return { problem };
};

const sanitizeSubmission = (submission, { resolveLanguageLabel } = {}) => {
  const runtimeMs = submission.runtimeMs ?? submission.execTimeMs ?? null;
  const memoryKB = submission.memoryKB ?? submission.memoryKb ?? null;
  const languageLabel = resolveLanguageLabel
    ? resolveLanguageLabel(
        submission.languageId,
        submission.language ?? deriveLanguageLabel(submission.languageId)
      )
    : submission.language ?? deriveLanguageLabel(submission.languageId);

  const populatedUser =
    submission.user &&
    typeof submission.user === 'object' &&
    submission.user !== null &&
    submission.user.username;

  return {
    id: submission._id.toString(),
    user: populatedUser
      ? {
          id:
            submission.user._id?.toString?.() ??
            submission.user.id?.toString?.() ??
            submission.user.toString(),
          username: submission.user.username
        }
      : undefined,
    userName: submission.userName,
    problem: submission.problem?._id
      ? {
          id: submission.problem._id.toString(),
          title: submission.problem.title,
          problemId: submission.problem.problemId,
          difficulty: submission.problem.difficulty
        }
      : undefined,
    problemTitle: submission.problemTitle,
    languageId: submission.languageId,
    language: languageLabel,
    verdict: submission.verdict,
    status: submission.status,
    score: submission.score,
    execTimeMs: submission.execTimeMs,
    memoryKb: submission.memoryKb,
    runtimeMs,
    memoryKB,
    sourceLen: submission.sourceLen,
    submittedAt: submission.submittedAt,
    queuedAt: submission.queuedAt,
    startedAt: submission.startedAt,
    finishedAt: submission.finishedAt,
    lastRunAt: submission.lastRunAt,
    deletedAt: submission.deletedAt ?? null,
    testCaseResults: submission.testCaseResults,
    resultSummary: submission.resultSummary,
    judge0: submission.judge0
  };
};

const sanitizedGlobalSubmission = (submission, extra = {}, { resolveLanguageLabel } = {}) => {
  const runtimeMs = submission.runtimeMs ?? submission.execTimeMs ?? null;
  const memoryKB = submission.memoryKB ?? submission.memoryKb ?? null;
  const languageLabel = resolveLanguageLabel
    ? resolveLanguageLabel(
        submission.languageId,
        submission.language ?? deriveLanguageLabel(submission.languageId)
      )
    : submission.language ?? deriveLanguageLabel(submission.languageId);

  return {
    id: submission._id.toString(),
    _id: submission._id.toString(),
    userId: submission.user?._id?.toString() ?? submission.user?.toString() ?? null,
    userName:
      submission.userName ??
      submission.user?.username ??
      (submission.user ? null : '(deleted user)'),
    problemId: submission.problemId,
    problemTitle: submission.problemTitle ?? submission.problem?.title ?? null,
    language: languageLabel,
    languageId: submission.languageId ?? null,
    status: submission.status,
    verdict: submission.verdict ?? null,
    score: submission.score,
    runtimeMs,
    memoryKB,
    createdAt: submission.createdAt,
    queuedAt: submission.queuedAt,
    startedAt: submission.startedAt,
    finishedAt: submission.finishedAt,
    lastRunAt: submission.lastRunAt,
    deletedAt: submission.deletedAt ?? null,
    ...extra
  };
};

const buildSubmissionDetail = (submission, { resolveLanguageLabel } = {}) => {
  const runtimeMs = submission.runtimeMs ?? submission.execTimeMs ?? null;
  const memoryKB = submission.memoryKB ?? submission.memoryKb ?? null;

  const rawSource = submission.sourceCode ?? '';
  const { sanitized: safeSource, changed: sourceSanitized } = sanitizeSourceCode(rawSource);
  const computedSourceLen =
    submission.sourceLen ?? (sourceSanitized ? safeSource.length : rawSource.length);
  const languageLabel = resolveLanguageLabel
    ? resolveLanguageLabel(
        submission.languageId,
        submission.language ?? deriveLanguageLabel(submission.languageId)
      )
    : submission.language ?? deriveLanguageLabel(submission.languageId);

  return {
    _id: submission._id.toString(),
    userId: submission.user?._id?.toString() ?? submission.user?.toString() ?? null,
    userName:
      submission.userName ??
      submission.user?.username ??
      (submission.user ? null : '(deleted user)'),
    problemId: submission.problemId,
    problemTitle: submission.problemTitle ?? submission.problem?.title ?? null,
    languageId: submission.languageId,
    language: languageLabel,
    sourceLen: computedSourceLen,
    source: safeSource,
    status: submission.status,
    verdict: submission.verdict ?? null,
    score: submission.score,
    runtimeMs,
    memoryKB,
    createdAt: submission.createdAt,
    queuedAt: submission.queuedAt,
    startedAt: submission.startedAt,
    finishedAt: submission.finishedAt,
    lastRunAt: submission.lastRunAt,
    runs: Array.isArray(submission.runs)
      ? submission.runs.map((run) => ({
          at: run.at,
          judge0Token: run.judge0Token ?? null,
          status: run.status ?? null,
          time: run.time ?? null,
          memory: run.memory ?? null
        }))
      : []
  };
};

const toPlainSubmission = (submission) =>
  submission?.toObject ? submission.toObject({ virtuals: false }) : submission;

const emitSubmissionEvent = (submission, type = 'submission:update') => {
  if (!submission) {
    return;
  }
  const plain = toPlainSubmission(submission);
  publishSubmissionEvent(sanitizedGlobalSubmission(plain, { type }));
};

const markSubmissionFailed = async (submission, { verdict = 'IE', save = true, error } = {}) => {
  if (!submission) {
    return;
  }
  const finishedAt = submission.finishedAt ?? new Date();
  submission.status = 'failed';
  submission.verdict = submission.verdict ?? verdict;
  submission.finishedAt = finishedAt;
  submission.lastRunAt = finishedAt;
  if (error) {
    const message = error?.message ?? 'Execution failed';
    submission.runs = Array.isArray(submission.runs) ? submission.runs : [];
    submission.runs.push({
      at: finishedAt,
      judge0Token: null,
      status: {
        verdict: submission.verdict,
        status: 'failed',
        error: message
      },
      time: null,
      memory: null
    });
  }
  if (save) {
    await submission.save();
  }
  emitSubmissionEvent(submission);
};

const processSubmission = async (submissionId) => {
  const submission = await Submission.findById(submissionId)
    .populate('problem')
    .populate('user', 'username');

  if (!submission) {
    return;
  }

  const problem = submission.problem;

  if (!problem || !Array.isArray(problem.testCases) || problem.testCases.length === 0) {
    await markSubmissionFailed(submission);
    return;
  }

  submission.status = 'running';
  submission.startedAt = new Date();
  submission.lastRunAt = submission.startedAt;
  await submission.save();
  emitSubmissionEvent(submission);

  try {
    const evaluation = await evaluateSubmissionRun({ submission, problem });
    const finishedAt = new Date();

    submission.verdict = evaluation.verdict;
    submission.status = evaluation.status;
    submission.score = evaluation.score;
    submission.execTimeMs = evaluation.execTimeMs;
    submission.runtimeMs = evaluation.execTimeMs;
    submission.memoryKb = evaluation.memoryKb;
    submission.memoryKB = evaluation.memoryKb;
    submission.testCaseResults = evaluation.testCaseResults;
    submission.resultSummary = evaluation.resultSummary;
    submission.judge0 = evaluation.judge0;
    submission.finishedAt = finishedAt;
    submission.lastRunAt = finishedAt;
    submission.runs = Array.isArray(submission.runs) ? submission.runs : [];
    submission.runs.push({
      at: finishedAt,
      judge0Token: evaluation.judge0?.jobId ?? null,
      status: {
        verdict: evaluation.verdict,
        status: evaluation.status,
        score: evaluation.score
      },
      time: evaluation.execTimeMs ?? null,
      memory: evaluation.memoryKb ?? null
    });

    await submission.save();
    emitSubmissionEvent(submission);

    await Problem.updateOne(
      { _id: problem._id },
      {
        $inc: {
          submissionCount: 1,
          acceptedSubmissionCount: evaluation.verdict === 'AC' ? 1 : 0
        }
      },
      { timestamps: false }
    );

    const userId =
      submission.user?._id?.toString() ??
      submission.user?.id ??
      submission.user?.toString() ??
      submission.userId;

    if (userId) {
      await incrementUserDailyStats(new mongoose.Types.ObjectId(userId), submission.submittedAt, {
        submitDelta: 1,
        acDelta: evaluation.verdict === 'AC' ? 1 : 0
      });
    }
  } catch (error) {
    console.error(`Failed to process submission ${submissionId}`, error);
    await markSubmissionFailed(submission, { error });
  }
};

const queueSubmissionProcessing = (submissionId) => {
  if (!submissionId) {
    return;
  }
  setImmediate(() => {
    processSubmission(submissionId).catch((error) => {
      console.error(`Unhandled submission processing error for ${submissionId}`, error);
    });
  });
};

export const createSubmission = async (req, res, next) => {
  try {
    const { problemId, languageId, sourceCode } = req.validated?.body || req.body;
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const username = req.user.username || req.user.email;

    const problem = await Problem.findById(problemId).select(
      'problemId title judge0LanguageIds testCases isPublic author cpuTimeLimit memoryLimit'
    );

    if (
      !problem ||
      (!problem.isPublic &&
        problem.author?.toString() !== req.user.id &&
        !isAdminLike(req.user))
    ) {
      return res
        .status(404)
        .json({ code: 'PROBLEM_NOT_FOUND', message: 'Problem not available' });
    }

    if (!canSubmitProblem(problem, req.user)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Problem is not accessible' });
    }

    const pendingSubmission = await Submission.findOne({
      user: userId,
      problem: problem._id,
      deletedAt: null,
      status: { $in: ['queued', 'running'] }
    }).select('_id status submittedAt');

    if (pendingSubmission) {
      return res.status(409).json({
        code: 'SUBMISSION_PENDING',
        message: 'Submission already in progress for this problem',
        submissionId: pendingSubmission._id.toString()
      });
    }

    const allowedLanguages = Array.isArray(problem.judge0LanguageIds)
      ? problem.judge0LanguageIds
      : [];

    if (allowedLanguages.length && !allowedLanguages.includes(languageId)) {
      return res.status(400).json({ code: 'INVALID_LANGUAGE', message: 'Language not allowed' });
    }

    if (!Array.isArray(problem.testCases) || problem.testCases.length === 0) {
      return res
        .status(400)
        .json({ code: 'TEST_CASES_MISSING', message: 'Problem has no test cases configured' });
    }

    const { sanitized: normalizedSourceCode, changed: sourceChanged } = sanitizeSourceCode(sourceCode);

    if (!normalizedSourceCode || normalizedSourceCode.trim().length === 0) {
      return res
        .status(400)
        .json({ code: 'INVALID_SOURCE', message: 'Source code was empty after sanitization' });
    }

    if (sourceChanged) {
      console.warn(
        'Submission source sanitized to remove HTML artifacts for user %s and problem %s',
        req.user.id,
        problem.problemId
      );
    }

    const resolveLanguageLabel = await loadLanguageResolver();
    const languageLabel = resolveLanguageLabel
      ? resolveLanguageLabel(languageId, deriveLanguageLabel(languageId))
      : deriveLanguageLabel(languageId);

    const now = new Date();
    const submissionDoc = await Submission.create({
      user: userId,
      userName: username,
      problem: problem._id,
      problemId: problem.problemId,
      problemTitle: problem.title,
      languageId,
      language: languageLabel,
      sourceCode: normalizedSourceCode,
      sourceLen: normalizedSourceCode.length,
      verdict: 'PENDING',
      status: 'queued',
      score: 0,
      submittedAt: now,
      queuedAt: now
    });

    emitSubmissionEvent(submissionDoc, 'submission:new');
    queueSubmissionProcessing(submissionDoc._id);

    res.status(202).json({
      submissionId: submissionDoc._id.toString(),
      initialStatus: 'queued'
    });
  } catch (error) {
    next(error);
  }
};

export const listMySubmissions = async (req, res, next) => {
  try {
    const { limit = 50, problemId, verdict } = req.validated?.query || {};
    const filters = {
      user: req.user.id,
      deletedAt: null
    };

    if (problemId) {
      filters.problem = problemId;
    }

    if (verdict) {
      filters.verdict = verdict;
    }

    const submissions = await Submission.find(filters)
      .populate('problem', 'title problemId difficulty')
      .sort({ submittedAt: -1 })
      .limit(limit);

    const resolveLanguageLabel = await loadLanguageResolver();

    res.json({
      items: submissions.map((submission) =>
        sanitizeSubmission(submission, { resolveLanguageLabel })
      )
    });
  } catch (error) {
    next(error);
  }
};

export const listSubmissions = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      user,
      problemId,
      dateFrom,
      dateTo,
      sort = '-createdAt'
    } = req.validated?.query || {};

    const resolveLanguageLabel = await loadLanguageResolver();

    const { rows, total } = await fetchSubmissionList({
      page,
      limit,
      status,
      userFilter: user,
      problemId,
      dateFrom,
      dateTo,
      sort
    }, { resolveLanguageLabel });

    res.json({
      items: rows,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    });
  } catch (error) {
    next(error);
  }
};

export const listProblemSubmissions = async (req, res, next) => {
  try {
    const { problemId } = req.validated?.params || req.params;
    const {
      scope = 'mine',
      page = 1,
      limit = 20,
      sort = '-createdAt'
    } = req.validated?.query || {};

    const access = await ensureProblemAccessibleToUser({
      problemJudgeId: problemId,
      user: req.user
    });

    if (access.error) {
      return res.status(access.error.status).json(access.error.body);
    }

    const targetProblemId = access.problem.problemId;
    const userFilter = scope === 'mine' ? req.user.id : undefined;

    const resolveLanguageLabel = await loadLanguageResolver();

    const { rows, total } = await fetchSubmissionList({
      page,
      limit,
      status: undefined,
      userFilter,
      problemId: targetProblemId,
      dateFrom: undefined,
      dateTo: undefined,
      sort
    }, { resolveLanguageLabel });

    const normalizedRows = rows.map((row) => {
      if (row.problemTitle) {
        return row;
      }
      return {
        ...row,
        problemTitle: access.problem.title ?? row.problemTitle ?? null
      };
    });

    res.json({
      items: normalizedRows,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      scope,
      problem: {
        problemId: targetProblemId,
        title: access.problem.title ?? null
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getSubmission = async (req, res, next) => {
  try {
    const { id } = req.validated?.params || req.params;
    const submission = await Submission.findById(id)
      .populate('problem', 'title problemId difficulty')
      .populate('user', 'username');

    if (!submission || submission.deletedAt) {
      return res.status(404).json({ code: 'SUBMISSION_NOT_FOUND', message: 'Submission not found' });
    }

    const ownerId =
      submission.user?._id?.toString() ??
      submission.user?.id ??
      submission.user?.toString() ??
      submission.userId;
    const isOwner = ownerId ? ownerId === req.user?.id : false;
    const isAdminUser = isAdminLike(req.user);
    const canViewSource = isOwner || isAdminUser;

    const resolveLanguageLabel = await loadLanguageResolver();
    const detail = buildSubmissionDetail(submission, { resolveLanguageLabel });
    const responsePayload = {
      ...detail,
      canViewSource
    };

    if (!canViewSource) {
      delete responsePayload.source;
    }

    res.json({ submission: responsePayload });
  } catch (error) {
    next(error);
  }
};

export const resubmitSubmission = async (req, res, next) => {
  try {
    const { id } = req.validated?.params || req.params;
    const result = await resubmitAndUpdate({ submissionId: id, actingUser: req.user });
    const updatedSubmission = result.submission;

    emitSubmissionEvent(updatedSubmission);

    const resolveLanguageLabel = await loadLanguageResolver();
    const detail = buildSubmissionDetail(updatedSubmission, { resolveLanguageLabel });

    const ownerId =
      updatedSubmission.user?._id?.toString() ??
      updatedSubmission.user?._id ??
      updatedSubmission.user?.toString() ??
      updatedSubmission.userId;
    const isOwner = ownerId ? ownerId.toString() === req.user.id : false;
    const isAdminUser = isAdminLike(req.user);
    const canViewSource = isOwner || isAdminUser;

    if (!canViewSource) {
      delete detail.source;
    }

    res.json({
      submission: {
        ...detail,
        canViewSource
      }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSubmission = async (req, res, next) => {
  try {
    const { id } = req.validated?.params || req.params;
    const result = await deleteSubmissionService({ submissionId: id, actingUser: req.user });

    if (result?.submission) {
      emitSubmissionEvent(result.submission, 'submission:deleted');
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const listUserSubmissionsAsAdmin = async (req, res, next) => {
  try {
    const params = req.validated?.params || req.params;
    const userId = params.userId ?? params.id;
    const {
      page = 1,
      limit = 20,
      status,
      problemId,
      dateFrom,
      dateTo,
      sort = '-createdAt'
    } = req.validated?.query || {};

    const resolveLanguageLabel = await loadLanguageResolver();

    const { rows, total } = await fetchSubmissionList({
      page,
      limit,
      status,
      userFilter: userId,
      problemId,
      dateFrom,
      dateTo,
      sort
    }, { resolveLanguageLabel });

    res.json({
      items: rows,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    });
  } catch (error) {
    next(error);
  }
};

export const streamSubmissions = (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const sendEvent = (event, explicitType) => {
    if (!event) {
      return;
    }
    if (explicitType) {
      res.write(`event: ${explicitType}\n`);
    }
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  sendEvent({ type: 'ready', emittedAt: new Date().toISOString() });

  const allowEvent = (event) => Boolean(event);

  const listener = (event) => {
    if (!allowEvent(event)) {
      return;
    }
    sendEvent(event);
  };

  const unsubscribe = subscribeSubmissionStream(listener);

  const { since } = req.query || {};
  const backlog = getSubmissionUpdatesSince(since).filter((event) => allowEvent(event));
  backlog.forEach((event) => sendEvent(event, 'replay'));

  const heartbeat = setInterval(() => {
    sendEvent({ emittedAt: new Date().toISOString() }, 'heartbeat');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
};

export const streamProblemSubmissions = async (req, res, next) => {
  try {
    const { problemId } = req.validated?.params || req.params;
    const { since } = req.query || {};

    const access = await ensureProblemAccessibleToUser({
      problemJudgeId: problemId,
      user: req.user
    });

    if (access.error) {
      return res.status(access.error.status).json(access.error.body);
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const targetProblemId = access.problem.problemId;

    const sendEvent = (event, explicitType) => {
      if (!event) {
        return;
      }
      if (explicitType) {
        res.write(`event: ${explicitType}\n`);
      }
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    sendEvent({
      type: 'ready',
      problemId: targetProblemId,
      emittedAt: new Date().toISOString()
    });

    const filterEvent = (event) => event && event.problemId === targetProblemId;

    const listener = (event) => {
      if (!filterEvent(event)) {
        return;
      }
      sendEvent(event);
    };

    const unsubscribe = subscribeSubmissionStream(listener);

    const backlog = getSubmissionUpdatesSince(since).filter((event) => filterEvent(event));
    backlog.forEach((event) => sendEvent(event, 'replay'));

    const heartbeat = setInterval(() => {
      sendEvent(
        {
          problemId: targetProblemId,
          emittedAt: new Date().toISOString()
        },
        'heartbeat'
      );
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });

    return null;
  } catch (error) {
    next(error);
    return null;
  }
};

export const getSubmissionUpdates = async (req, res, next) => {
  try {
    const { since } = req.query || {};
    const updates = getSubmissionUpdatesSince(since);
    res.json({ items: updates });
  } catch (error) {
    next(error);
  }
};
