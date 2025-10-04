import Problem from '../models/Problem.js';
import Submission from '../models/Submission.js';
import { runJudge0Submission } from '../services/judge0Service.js';

const decode = (value) => {
  if (!value) {
    return '';
  }
  try {
    return Buffer.from(value, 'base64').toString('utf8');
  } catch (error) {
    return value;
  }
};

const normalize = (value) => value?.toString().trim() ?? '';

export const listSubmissions = async (req, res, next) => {
  try {
    const { limit = 50, problemId } = req.validated?.query || {};

    const filters = {};
    if (problemId) {
      filters.problem = problemId;
    }

    const submissions = await Submission.find(filters)
      .populate('problem', 'title slug')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(submissions);
  } catch (error) {
    next(error);
  }
};

export const getSubmission = async (req, res, next) => {
  try {
    const { id } = req.validated?.params || req.params;
    const submission = await Submission.findById(id).populate('problem', 'title slug description');

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    res.json(submission);
  } catch (error) {
    next(error);
  }
};

export const createSubmission = async (req, res, next) => {
  try {
    const { problemId, languageId, sourceCode } = req.validated?.body || req.body;

    const problem = await Problem.findById(problemId);

    if (!problem) {
      return res.status(404).json({ message: 'Problem not found' });
    }

    const submission = new Submission({
      problem: problem._id,
      languageId,
      sourceCode
    });

    const testCaseResults = [];
    let verdict = 'Accepted';

    for (const testCase of problem.testCases) {
      const judgeResult = await runJudge0Submission({
        languageId,
        sourceCode,
        stdin: testCase.input
      });

      const stdout = decode(judgeResult.stdout);
      const stderr = decode(judgeResult.stderr);
      const compileOutput = decode(judgeResult.compile_output);
      const message = decode(judgeResult.message);
      const status = judgeResult.status || {};

      const passed =
        status.id === 3 &&
        normalize(stdout) === normalize(testCase.expectedOutput) &&
        !compileOutput &&
        !stderr;

      testCaseResults.push({
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        stdout,
        stderr,
        compileOutput,
        message,
        status,
        time: judgeResult.time,
        memory: judgeResult.memory
      });

      if (!passed) {
        verdict = status.description || 'Wrong Answer';
        break;
      }
    }

    submission.verdict = verdict;
    submission.testCaseResults = testCaseResults;

    await submission.save();

    const populated = await submission.populate('problem', 'title slug');

    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};
