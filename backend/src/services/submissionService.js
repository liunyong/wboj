import mongoose from 'mongoose';
import Problem from '../models/Problem.js';
import Submission from '../models/Submission.js';
import { executeTestCases, buildCaseSummary } from './testCaseRunnerService.js';

const buildHttpError = (status, code, message, details) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details) {
    error.details = details;
  }
  return error;
};

export const verdictToStatus = (verdict) => {
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

const deriveOverallVerdict = (results, score) => {
  const hasCompileError = results.some((result) => [6, 15].includes(result.statusId));
  if (hasCompileError) {
    return 'CE';
  }

  const hasRuntimeError = results.some(
    (result) => result.statusId >= 7 && result.statusId <= 12
  );
  if (hasRuntimeError) {
    return 'RTE';
  }

  const hasTimeLimit = results.some((result) => result.statusId === 5);
  if (hasTimeLimit) {
    return 'TLE';
  }

  if (score === 100) {
    return 'AC';
  }

  if (score > 0) {
    return 'PARTIAL';
  }

  const hasWrongAnswer = results.some((result) => [4, 13, 14].includes(result.statusId));
  if (hasWrongAnswer) {
    return 'WA';
  }

  return 'WA';
};

const mapTestCaseResults = (results) =>
  results.map((result) => ({
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

const TRANSACTION_NOT_SUPPORTED_CODES = new Set([20]);
const isTransactionNotSupportedError = (error) =>
  TRANSACTION_NOT_SUPPORTED_CODES.has(error?.code) ||
  /Transaction numbers are only allowed/.test(error?.message ?? '');

const applySessionToQuery = (query, session) => (session ? query.session(session) : query);
const sessionOptions = (session) => (session ? { session } : {});

const runWithOptionalTransaction = async (operation) => {
  const session = await mongoose.startSession();
  let sessionEnded = false;
  let result;

  const execute = async (sessionOpt) => {
    result = await operation(sessionOpt);
  };

  try {
    await session.withTransaction(async () => {
      await execute(session);
    });
  } catch (error) {
    if (isTransactionNotSupportedError(error)) {
      await session.endSession();
      sessionEnded = true;
      await execute(null);
    } else {
      throw error;
    }
  } finally {
    if (!sessionEnded) {
      await session.endSession();
    }
  }

  return result;
};

export const evaluateSubmissionRun = async ({ submission, problem }) => {
  if (!submission) {
    throw buildHttpError(404, 'SUBMISSION_NOT_FOUND', 'Submission not found');
  }
  if (!problem) {
    throw buildHttpError(404, 'PROBLEM_NOT_FOUND', 'Problem not available');
  }

  if (!Array.isArray(problem.testCases) || problem.testCases.length === 0) {
    throw buildHttpError(
      400,
      'TEST_CASES_MISSING',
      'Problem has no test cases configured'
    );
  }

  const { results, score, maxExecTimeMs, maxMemoryKb } = await executeTestCases({
    sourceCode: submission.sourceCode,
    languageId: submission.languageId,
    testCases: problem.testCases,
    cpuTimeLimit: problem.cpuTimeLimit,
    memoryLimit: problem.memoryLimit
  });

  const verdict = deriveOverallVerdict(results, score);
  const status = verdictToStatus(verdict);
  const execTimeMs = Number.isFinite(maxExecTimeMs) ? maxExecTimeMs : null;
  const memoryKb = Number.isFinite(maxMemoryKb) ? maxMemoryKb : null;
  const summaryCases = buildCaseSummary(results);

  return {
    verdict,
    status,
    score,
    execTimeMs,
    memoryKb,
    testCaseResults: mapTestCaseResults(results),
    resultSummary: { score, cases: summaryCases },
    judge0: { rawPayload: results }
  };
};

const isAdminLike = (user) => ['admin', 'super_admin'].includes(user?.role);

export const resubmitAndUpdate = async ({ submissionId, actingUser }) => {
  const submission = await Submission.findById(submissionId)
    .populate('problem', 'problemId title testCases cpuTimeLimit memoryLimit')
    .populate('user', 'username');

  if (!submission || submission.deletedAt) {
    throw buildHttpError(404, 'SUBMISSION_NOT_FOUND', 'Submission not found');
  }

  const ownerId =
    submission.user?._id?.toString() ??
    submission.user?._id ??
    submission.userId ??
    submission.user?.toString();

  const isOwner = ownerId ? ownerId.toString() === actingUser?.id : false;

  if (!isOwner && !isAdminLike(actingUser)) {
    throw buildHttpError(403, 'FORBIDDEN', 'Insufficient permissions');
  }

  if (!submission.sourceCode) {
    throw buildHttpError(
      400,
      'INVALID_SOURCE',
      'Original submission source is unavailable'
    );
  }

  const startedAt = new Date();
  let evaluation;
  let evaluationError = null;

  try {
    evaluation = await evaluateSubmissionRun({
      submission,
      problem: submission.problem
    });
  } catch (error) {
    evaluationError = error;
  }

  const finishedAt = new Date();
  const runEntry = {
    at: finishedAt,
    judge0Token: evaluation?.judge0?.jobId ?? null,
    status: evaluation
      ? {
          verdict: evaluation.verdict,
          status: evaluation.status,
          score: evaluation.score
        }
      : {
          verdict: submission.verdict,
          status: 'failed',
          error: evaluationError?.message ?? 'Judge0 execution failed'
        },
    time: evaluation?.execTimeMs ?? null,
    memory: evaluation?.memoryKb ?? null
  };

  const updatedSubmission = await runWithOptionalTransaction(async (session) => {
    const currentSubmissionQuery = Submission.findById(submissionId).populate('problem', '_id');
    const currentSubmission = await applySessionToQuery(currentSubmissionQuery, session);

    if (!currentSubmission || currentSubmission.deletedAt) {
      throw buildHttpError(404, 'SUBMISSION_NOT_FOUND', 'Submission not found');
    }

    const previousVerdict = currentSubmission.verdict;

    const updateOps = {
      $push: { runs: runEntry },
      $set: {
        lastRunAt: finishedAt
      }
    };

    if (evaluation) {
      Object.assign(updateOps.$set, {
        verdict: evaluation.verdict,
        status: evaluation.status,
        score: evaluation.score,
        execTimeMs: evaluation.execTimeMs,
        runtimeMs: evaluation.execTimeMs,
        memoryKb: evaluation.memoryKb,
        memoryKB: evaluation.memoryKb,
        testCaseResults: evaluation.testCaseResults,
        resultSummary: evaluation.resultSummary,
        judge0: evaluation.judge0,
        queuedAt: startedAt,
        startedAt,
        finishedAt
      });
    }

    const result = await Submission.updateOne(
      { _id: submissionId },
      updateOps,
      sessionOptions(session)
    );

    if (!result.matchedCount) {
      throw buildHttpError(404, 'SUBMISSION_NOT_FOUND', 'Submission not found');
    }

    if (evaluation) {
      const prevWasAC = previousVerdict === 'AC';
      const newIsAC = evaluation.verdict === 'AC';
      const delta = Number(newIsAC) - Number(prevWasAC);

      if (delta !== 0 && currentSubmission.problem) {
        await Problem.updateOne(
          { _id: currentSubmission.problem._id },
          {
            $inc: { acceptedSubmissionCount: delta }
          },
          { ...sessionOptions(session), timestamps: false }
        );
      }
    }

    const updatedQuery = Submission.findById(submissionId)
      .populate('problem', 'title problemId difficulty')
      .populate('user', 'username');

    return applySessionToQuery(updatedQuery, session);
  });

  if (!updatedSubmission) {
    throw buildHttpError(500, 'SUBMISSION_UPDATE_FAILED', 'Failed to update submission');
  }

  if (evaluationError) {
    throw evaluationError;
  }

  return {
    submission: updatedSubmission,
    startedAt,
    finishedAt,
    runEntry
  };
};

export const deleteSubmission = async ({ submissionId, actingUser }) => {
  if (actingUser?.role !== 'super_admin') {
    throw buildHttpError(403, 'FORBIDDEN', 'Insufficient permissions');
  }

  const submission = await Submission.findById(submissionId).populate('problem', '_id');
  if (!submission) {
    throw buildHttpError(404, 'SUBMISSION_NOT_FOUND', 'Submission not found');
  }

  if (submission.deletedAt) {
    return { submission, alreadyDeleted: true };
  }

  const deletedAt = new Date();
  await runWithOptionalTransaction(async (session) => {
    const updateResult = await Submission.updateOne(
      { _id: submissionId, deletedAt: null },
      { $set: { deletedAt } },
      sessionOptions(session)
    );

    if (!updateResult.matchedCount) {
      throw buildHttpError(404, 'SUBMISSION_NOT_FOUND', 'Submission not found');
    }

    const inc = {
      submissionCount: -1
    };

    if (submission.verdict === 'AC') {
      inc.acceptedSubmissionCount = -1;
    }

    if (submission.problem?._id) {
      await Problem.updateOne(
        { _id: submission.problem._id },
        { $inc: inc },
        { ...sessionOptions(session), timestamps: false }
      );
    }
  });

  const updated = await Submission.findById(submissionId);
  return { submission: updated, deletedAt };
};

export const recomputeProblemCounters = async ({ problemId }) => {
  const problem = await Problem.findOne({ problemId }).select('_id submissionCount acceptedSubmissionCount');

  if (!problem) {
    throw buildHttpError(404, 'PROBLEM_NOT_FOUND', 'Problem not found');
  }

  const [submissionCount, acceptedSubmissionCount] = await Promise.all([
    Submission.countDocuments({ problem: problem._id, deletedAt: null }),
    Submission.countDocuments({ problem: problem._id, verdict: 'AC', deletedAt: null })
  ]);

  await Problem.updateOne(
    { _id: problem._id },
    {
      $set: {
        submissionCount,
        acceptedSubmissionCount
      }
    },
    { timestamps: false }
  );

  return {
    problemId,
    submissionCount,
    acceptedSubmissionCount
  };
};
