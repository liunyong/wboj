import mongoose from 'mongoose';
import Problem from '../models/Problem.js';
import Submission from '../models/Submission.js';
import { executeTestCases, buildCaseSummary } from '../services/testCaseRunnerService.js';
import { incrementUserDailyStats } from '../services/statsService.js';

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
  score: submission.score,
  execTimeMs: submission.execTimeMs,
  memoryKb: submission.memoryKb,
  sourceLen: submission.sourceLen,
  submittedAt: submission.submittedAt,
  testCaseResults: submission.testCaseResults,
  resultSummary: submission.resultSummary,
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

    if (!Array.isArray(problem.testCases) || problem.testCases.length === 0) {
      return res
        .status(400)
        .json({ code: 'TEST_CASES_MISSING', message: 'Problem has no test cases configured' });
    }

    const submission = new Submission({
      user: userId,
      problem: problem._id,
      languageId,
      sourceCode,
      sourceLen: sourceCode.length,
      submittedAt: new Date()
    });

    const { results, score, maxExecTimeMs, maxMemoryKb } = await executeTestCases({
      sourceCode,
      languageId,
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
    submission.score = score;
    submission.execTimeMs = Number.isFinite(maxExecTimeMs) ? maxExecTimeMs : null;
    submission.memoryKb = Number.isFinite(maxMemoryKb) ? maxMemoryKb : null;
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
