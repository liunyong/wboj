import { runJudge0Submission } from './judge0Service.js';

const TERMINATE_STATUSES = new Set([6, 15]);

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

const DEFAULT_TIME_LIMIT = Number.parseFloat(process.env.DEFAULT_PROBLEM_TIME_LIMIT ?? '2');
const DEFAULT_MEMORY_LIMIT = Number.parseInt(process.env.DEFAULT_PROBLEM_MEMORY_LIMIT ?? '128', 10);

export const executeTestCases = async ({
  sourceCode,
  languageId,
  testCases,
  cpuTimeLimit,
  memoryLimit
}) => {
  const results = [];
  let passedPoints = 0;
  let maxExecTimeMs = 0;
  let maxMemoryKb = 0;

  const effectiveTimeLimit = Number.isFinite(cpuTimeLimit) ? cpuTimeLimit : DEFAULT_TIME_LIMIT;
  const effectiveMemoryLimit = Number.isFinite(memoryLimit) ? memoryLimit : DEFAULT_MEMORY_LIMIT;

  let index = 0;

  for (; index < testCases.length; index += 1) {
    const testCase = testCases[index];
    const judgeResult = await runJudge0Submission({
      languageId,
      sourceCode,
      stdin: testCase.input,
      expectedOutput: testCase.output,
      cpuTimeLimit: effectiveTimeLimit,
      memoryLimit: effectiveMemoryLimit,
      enableNetwork: false
    });

    const stdout = decodeBase64(judgeResult.stdout);
    const stderr = decodeBase64(judgeResult.stderr);
    const compileOutput = decodeBase64(judgeResult.compile_output);
    const message = decodeBase64(judgeResult.message);
    const status = judgeResult.status || {};
    const statusId = Number.isFinite(status.id) ? status.id : 0;
    const points = Number.isFinite(testCase.points) ? testCase.points : 1;

    let passed = statusId === 3;
    if (passed) {
      const expected = normalizeOutput(testCase.output);
      const actual = normalizeOutput(stdout);
      if (expected !== actual) {
        passed = false;
      }
    }

    const execTime = Number.parseFloat(judgeResult.time ?? '0');
    const memory = Number.isFinite(judgeResult.memory) ? judgeResult.memory : 0;

    maxExecTimeMs = Math.max(maxExecTimeMs, Number.isFinite(execTime) ? execTime * 1000 : 0);
    maxMemoryKb = Math.max(maxMemoryKb, memory);

    if (passed) {
      passedPoints += points;
    }

    results.push({
      index: index + 1,
      input: testCase.input,
      output: testCase.output,
      stdout,
      stderr,
      compileOutput,
      message,
      status,
      statusId,
      time: judgeResult.time,
      memory: judgeResult.memory,
      points,
      passed
    });

    if (TERMINATE_STATUSES.has(statusId)) {
      index += 1;
      break;
    }
  }

  for (let cursor = index; cursor < testCases.length; cursor += 1) {
    const remaining = testCases[cursor];
    results.push({
      index: cursor + 1,
      input: remaining.input,
      output: remaining.output,
      stdout: '',
      stderr: '',
      compileOutput: '',
      message: 'Skipped due to earlier failure',
      status: { id: 0, description: 'SKIPPED' },
      statusId: 0,
      time: null,
      memory: null,
      points: remaining.points || 0,
      passed: false
    });
  }

  const totalPoints = testCases.reduce((sum, testCase) => sum + (testCase.points || 0), 0);
  const score = totalPoints > 0 ? Math.round((passedPoints / totalPoints) * 100) : 0;

  return {
    results,
    totalPoints,
    passedPoints,
    score,
    maxExecTimeMs: Number.isFinite(maxExecTimeMs) ? Math.round(maxExecTimeMs) : null,
    maxMemoryKb: Number.isFinite(maxMemoryKb) ? Math.round(maxMemoryKb) : null
  };
};

export const buildCaseSummary = (results) =>
  results.map((result) => ({
    i: result.index,
    s: result.statusId,
    t: result.time ?? null,
    m: result.memory ?? null,
    p: result.points,
    pass: result.passed
  }));
