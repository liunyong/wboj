import mongoose from 'mongoose';
import Problem from '../models/Problem.js';
import Submission from '../models/Submission.js';
import { executeTestCases, buildCaseSummary } from '../services/testCaseRunnerService.js';
import { incrementUserDailyStats } from '../services/statsService.js';
import {
  publishSubmissionEvent,
  subscribeSubmissionStream,
  getSubmissionUpdatesSince
} from '../services/submissionStreamService.js';

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
  if (user.role === 'admin') {
    return true;
  }
  return problem.author?.toString() === user.id;
};

const verdictToStatus = (verdict) => {
  switch (verdict) {
    case 'AC':
      return 'accepted';
    case 'WA':
      return 'wrong_answer';
    case 'TLE':
      return 'tle';
    case 'RTE':
      return 'rte';
    case 'CE':
      return 'ce';
    case 'MLE':
    case 'PE':
    case 'IE':
    case 'PARTIAL':
      return 'failed';
    default:
      return 'failed';
  }
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
}) => {
  const filters = {};

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
        '_id user userName problemId problemTitle language languageId status score runtimeMs execTimeMs memoryKB memoryKb createdAt queuedAt startedAt finishedAt'
      )
      .lean(),
    Submission.countDocuments(filters)
  ]);

  const rows = items.map((submission) => sanitizedGlobalSubmission(submission));

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

  const isAdmin = user?.role === 'admin';
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

const sanitizeSubmission = (submission) => {
  const runtimeMs = submission.runtimeMs ?? submission.execTimeMs ?? null;
  const memoryKB = submission.memoryKB ?? submission.memoryKb ?? null;

  return {
    id: submission._id.toString(),
    user: submission.user?._id
      ? {
          id: submission.user._id.toString(),
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
    language: submission.language,
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
    testCaseResults: submission.testCaseResults,
    resultSummary: submission.resultSummary,
    judge0: submission.judge0
  };
};

const sanitizedGlobalSubmission = (submission, extra = {}) => {
  const runtimeMs = submission.runtimeMs ?? submission.execTimeMs ?? null;
  const memoryKB = submission.memoryKB ?? submission.memoryKb ?? null;

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
    language: submission.language ?? String(submission.languageId ?? ''),
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
    ...extra
  };
};

const buildSubmissionDetail = (submission) => {
  const runtimeMs = submission.runtimeMs ?? submission.execTimeMs ?? null;
  const memoryKB = submission.memoryKB ?? submission.memoryKb ?? null;

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
    language: submission.language,
    sourceLen: submission.sourceLen ?? submission.sourceCode?.length ?? 0,
    source: submission.sourceCode,
    status: submission.status,
    verdict: submission.verdict ?? null,
    score: submission.score,
    runtimeMs,
    memoryKB,
    createdAt: submission.createdAt,
    queuedAt: submission.queuedAt,
    startedAt: submission.startedAt,
    finishedAt: submission.finishedAt
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

const markSubmissionFailed = async (submission, { verdict = 'IE', save = true } = {}) => {
  if (!submission) {
    return;
  }
  submission.status = 'failed';
  submission.verdict = submission.verdict ?? verdict;
  submission.finishedAt = submission.finishedAt ?? new Date();
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
  await submission.save();
  emitSubmissionEvent(submission);

  try {
    const { results, score, maxExecTimeMs, maxMemoryKb } = await executeTestCases({
      sourceCode: submission.sourceCode,
      languageId: submission.languageId,
      testCases: problem.testCases,
      cpuTimeLimit: problem.cpuTimeLimit,
      memoryLimit: problem.memoryLimit
    });

    const summaryCases = buildCaseSummary(results);

    const hasCompileError = results.some((result) => [6, 15].includes(result.statusId));
    const hasRuntimeError = results.some((result) => result.statusId >= 7 && result.statusId <= 12);
    const hasTimeLimit = results.some((result) => result.statusId === 5);
    const hasWrongAnswer = results.some((result) => [4, 13, 14].includes(result.statusId));

    let overallVerdict = 'WA';
    if (hasCompileError) {
      overallVerdict = 'CE';
    } else if (hasRuntimeError) {
      overallVerdict = 'RTE';
    } else if (hasTimeLimit) {
      overallVerdict = 'TLE';
    } else if (score === 100) {
      overallVerdict = 'AC';
    } else if (score > 0) {
      overallVerdict = 'PARTIAL';
    } else if (hasWrongAnswer) {
      overallVerdict = 'WA';
    } else {
      overallVerdict = 'WA';
    }

    submission.verdict = overallVerdict;
    submission.status = verdictToStatus(overallVerdict);
    submission.score = score;

    const resolvedExecMs = Number.isFinite(maxExecTimeMs) ? maxExecTimeMs : null;
    const resolvedMemoryKb = Number.isFinite(maxMemoryKb) ? maxMemoryKb : null;
    submission.execTimeMs = resolvedExecMs;
    submission.runtimeMs = resolvedExecMs;
    submission.memoryKb = resolvedMemoryKb;
    submission.memoryKB = resolvedMemoryKb;
    submission.testCaseResults = results.map((result) => ({
      index: result.index,
      input: result.input,
      output: result.output,
      stdout: result.stdout,
      stderr: result.stderr,
      compileOutput: result.compileOutput,
      message: result.message,
      status: result.status,
      time: result.time,
      memory: result.memory,
      points: result.points,
      passed: result.passed
    }));
    submission.resultSummary = { score, cases: summaryCases };
    submission.judge0 = { rawPayload: results };
    submission.finishedAt = new Date();

    await submission.save();
    emitSubmissionEvent(submission);

    await Problem.updateOne(
      { _id: problem._id },
      {
        $inc: {
          submissionCount: 1,
          acceptedSubmissionCount: overallVerdict === 'AC' ? 1 : 0
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
        acDelta: overallVerdict === 'AC' ? 1 : 0
      });
    }
  } catch (error) {
    console.error(`Failed to process submission ${submissionId}`, error);
    await markSubmissionFailed(submission);
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
      (!problem.isPublic && problem.author?.toString() !== req.user.id && req.user.role !== 'admin')
    ) {
      return res
        .status(404)
        .json({ code: 'PROBLEM_NOT_FOUND', message: 'Problem not available' });
    }

    if (!canSubmitProblem(problem, req.user)) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Problem is not accessible' });
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

    const now = new Date();
    const submissionDoc = await Submission.create({
      user: userId,
      userName: username,
      problem: problem._id,
      problemId: problem.problemId,
      problemTitle: problem.title,
      languageId,
      language: deriveLanguageLabel(languageId),
      sourceCode,
      sourceLen: sourceCode.length,
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
      user: req.user.id
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

    res.json({ items: submissions.map(sanitizeSubmission) });
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

    const { rows, total } = await fetchSubmissionList({
      page,
      limit,
      status,
      userFilter: user,
      problemId,
      dateFrom,
      dateTo,
      sort
    });

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

    const { rows, total } = await fetchSubmissionList({
      page,
      limit,
      status: undefined,
      userFilter,
      problemId: targetProblemId,
      dateFrom: undefined,
      dateTo: undefined,
      sort
    });

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

    if (!submission) {
      return res.status(404).json({ code: 'SUBMISSION_NOT_FOUND', message: 'Submission not found' });
    }

    const ownerId =
      submission.user?._id?.toString() ??
      submission.user?.id ??
      submission.user?.toString() ??
      submission.userId;
    const isOwner = ownerId ? ownerId === req.user?.id : false;
    const isAdmin = req.user?.role === 'admin';
    const canViewSource = isOwner || isAdmin;

    const detail = buildSubmissionDetail(submission);
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
    const original = await Submission.findById(id);

    if (!original) {
      return res.status(404).json({ code: 'SUBMISSION_NOT_FOUND', message: 'Submission not found' });
    }

    const ownerId =
      original.user?._id?.toString() ??
      original.user?.id ??
      original.user?.toString() ??
      original.userId;
    const isOwner = ownerId ? ownerId === req.user.id : false;
    const isAdmin = req.user?.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
    }

    if (!ownerId) {
      return res
        .status(400)
        .json({ code: 'SUBMISSION_ORPHANED', message: 'Submission owner is unavailable' });
    }

    const problem = await Problem.findById(original.problem).select(
      'problemId title judge0LanguageIds testCases cpuTimeLimit memoryLimit'
    );

    if (!problem) {
      return res.status(404).json({ code: 'PROBLEM_NOT_FOUND', message: 'Problem not available' });
    }

    if (!Array.isArray(problem.testCases) || problem.testCases.length === 0) {
      return res
        .status(400)
        .json({ code: 'TEST_CASES_MISSING', message: 'Problem has no test cases configured' });
    }

    const allowedLanguages = Array.isArray(problem.judge0LanguageIds)
      ? problem.judge0LanguageIds
      : [];

    if (allowedLanguages.length && !allowedLanguages.includes(original.languageId)) {
      return res
        .status(400)
        .json({ code: 'INVALID_LANGUAGE', message: 'Language no longer allowed for this problem' });
    }

    const targetUserId = isAdmin ? ownerId : req.user.id;
    const targetUserName = isAdmin
      ? original.userName ?? original.user?.username ?? 'Unknown user'
      : req.user.username || req.user.email || original.userName || 'Unknown user';

    const now = new Date();
    const submissionDoc = await Submission.create({
      user: new mongoose.Types.ObjectId(targetUserId),
      userName: targetUserName,
      problem: problem._id,
      problemId: problem.problemId,
      problemTitle: problem.title,
      languageId: original.languageId,
      language: original.language ?? deriveLanguageLabel(original.languageId),
      sourceCode: original.sourceCode,
      sourceLen: original.sourceLen ?? original.sourceCode?.length ?? 0,
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

    const { rows, total } = await fetchSubmissionList({
      page,
      limit,
      status,
      userFilter: userId,
      problemId,
      dateFrom,
      dateTo,
      sort
    });

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
