import mongoose from 'mongoose';
import Problem from '../models/Problem.js';
import Submission from '../models/Submission.js';
import { runJudge0Submission } from '../services/judge0Service.js';
import { incrementUserDailyStats } from '../services/statsService.js';

const decodeBase64 = (value) => {
  if (!value) {
    return '';
  }
  try {
    return Buffer.from(value, 'base64').toString('utf8');
  } catch (error) {
    return value;
  }
};

const normalizeOutput = (value) => value?.toString().trim() ?? '';

const mapStatusToVerdict = (statusId) => {
  switch (statusId) {
    case 3:
      return 'AC';
    case 4:
      return 'WA';
    case 5:
      return 'TLE';
    case 6:
      return 'CE';
    case 7:
    case 8:
    case 9:
    case 10:
    case 11:
    case 12:
      return 'RTE';
    case 13:
      return 'WA';
    case 14:
      return 'WA';
    case 15:
      return 'CE';
    case 16:
    case 17:
    case 18:
      return 'IE';
    default:
      return 'PENDING';
  }
};

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

const sanitizeSubmission = (submission) => ({
  id: submission._id.toString(),
  user: submission.user?._id
    ? {
        id: submission.user._id.toString(),
        username: submission.user.username
      }
    : undefined,
  problem: submission.problem?._id
    ? {
        id: submission.problem._id.toString(),
        title: submission.problem.title,
        problemId: submission.problem.problemId,
        difficulty: submission.problem.difficulty
      }
    : undefined,
  languageId: submission.languageId,
  verdict: submission.verdict,
  execTimeMs: submission.execTimeMs,
  memoryKb: submission.memoryKb,
  sourceLen: submission.sourceLen,
  submittedAt: submission.submittedAt,
  testCaseResults: submission.testCaseResults,
  judge0: submission.judge0
});

export const createSubmission = async (req, res, next) => {
  try {
    const { problemId, languageId, sourceCode } = req.validated?.body || req.body;
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const problem = await Problem.findById(problemId);
    if (!problem || (!problem.isPublic && problem.author?.toString() !== req.user.id && req.user.role !== 'admin')) {
      return res.status(404).json({ code: 'PROBLEM_NOT_FOUND', message: 'Problem not available' });
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

    const submission = new Submission({
      user: userId,
      problem: problem._id,
      languageId,
      sourceCode,
      sourceLen: sourceCode.length,
      submittedAt: new Date()
    });

    const testCaseResults = [];
    let overallVerdict = 'AC';
    let maxExecTimeMs = 0;
    let maxMemoryKb = 0;

    for (const testCase of problem.testCases) {
      const judgeResult = await runJudge0Submission({
        languageId,
        sourceCode,
        stdin: testCase.input
      });

      const stdout = decodeBase64(judgeResult.stdout);
      const stderr = decodeBase64(judgeResult.stderr);
      const compileOutput = decodeBase64(judgeResult.compile_output);
      const message = decodeBase64(judgeResult.message);
      const status = judgeResult.status || {};
      const statusId = Number.isFinite(status.id) ? status.id : 0;

      let verdict = mapStatusToVerdict(statusId);

      const expected = normalizeOutput(testCase.expectedOutput);
      const actual = normalizeOutput(stdout);

      if (verdict === 'AC' && expected !== actual) {
        verdict = 'WA';
      }

      if (compileOutput && verdict === 'AC') {
        verdict = 'CE';
      }

      if (stderr && verdict === 'AC') {
        verdict = 'RTE';
      }

      const execTime = Number.parseFloat(judgeResult.time ?? '0');
      const memory = Number.isFinite(judgeResult.memory) ? judgeResult.memory : 0;

      maxExecTimeMs = Math.max(maxExecTimeMs, Number.isFinite(execTime) ? execTime * 1000 : 0);
      maxMemoryKb = Math.max(maxMemoryKb, memory);

      testCaseResults.push({
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        stdout,
        stderr,
        compileOutput,
        message,
        status,
        verdict,
        time: judgeResult.time,
        memory: judgeResult.memory
      });

      if (verdict !== 'AC') {
        overallVerdict = verdict;
        break;
      }
    }

    submission.verdict = overallVerdict;
    submission.execTimeMs = Number.isFinite(maxExecTimeMs) ? Math.round(maxExecTimeMs) : null;
    submission.memoryKb = Number.isFinite(maxMemoryKb) ? Math.round(maxMemoryKb) : null;
    submission.testCaseResults = testCaseResults;
    submission.judge0 = { rawPayload: testCaseResults };

    await submission.save();

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

    await incrementUserDailyStats(userId, submission.submittedAt, {
      submitDelta: 1,
      acDelta: overallVerdict === 'AC' ? 1 : 0
    });

    const populated = await Submission.findById(submission._id)
      .populate('problem', 'title problemId difficulty')
      .populate('user', 'username');

    res.status(201).json({ submission: sanitizeSubmission(populated) });
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
    const { limit = 100, problemId, userId, verdict } = req.validated?.query || {};
    const filters = {};

    if (problemId) {
      filters.problem = problemId;
    }

    if (userId) {
      filters.user = userId;
    }

    if (verdict) {
      filters.verdict = verdict;
    }

    const submissions = await Submission.find(filters)
      .populate('problem', 'title problemId difficulty')
      .populate('user', 'username email role')
      .sort({ submittedAt: -1 })
      .limit(limit);

    res.json({ items: submissions.map(sanitizeSubmission) });
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

    const isOwner = submission.user?._id?.toString() === req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
    }

    res.json({ submission: sanitizeSubmission(submission) });
  } catch (error) {
    next(error);
  }
};
