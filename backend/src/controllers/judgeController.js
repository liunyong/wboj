import { executeTestCases, buildCaseSummary } from '../services/testCaseRunnerService.js';

const sanitizeTestCases = (testCases = []) =>
  testCases.map((testCase) => ({
    input: testCase.input,
    output: testCase.output,
    points: Number.isFinite(testCase.points) ? testCase.points : 1
  }));

export const validateSolution = async (req, res, next) => {
  try {
    const { sourceCode, languageId, testCases, cpuTimeLimit, memoryLimit } =
      req.validated?.body || req.body;

    const sanitizedTestCases = sanitizeTestCases(testCases);

    const { results, score, maxExecTimeMs, maxMemoryKb } = await executeTestCases({
      sourceCode,
      languageId,
      testCases: sanitizedTestCases,
      cpuTimeLimit,
      memoryLimit
    });

    res.json({
      score,
      maxExecTimeMs,
      maxMemoryKb,
      cases: buildCaseSummary(results),
      results
    });
  } catch (error) {
    next(error);
  }
};
