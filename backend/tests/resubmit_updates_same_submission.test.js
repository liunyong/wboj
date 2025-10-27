import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockedLanguages = [
  { id: 71, name: 'Python (3.10)' },
  { id: 63, name: 'JavaScript (Node)' }
];

vi.mock('../src/services/judge0Service.js', async () => ({
  runJudge0Submission: vi.fn(async ({ stdin }) => {
    const [a = '0', b = '0'] = String(stdin).split(/\s+/);
    const sum = Number(a) + Number(b);
    return {
      stdout: Buffer.from(String(sum), 'utf8').toString('base64'),
      stderr: null,
      compile_output: null,
      message: null,
      status: { id: 3, description: 'Accepted' },
      time: '0.01',
      memory: 10_240
    };
  }),
  fetchJudge0Languages: vi.fn(async () => mockedLanguages),
  clearLanguageCache: vi.fn()
}));

const { runJudge0Submission } = await import('../src/services/judge0Service.js');

import app from '../src/app.js';
import Problem from '../src/models/Problem.js';
import Submission from '../src/models/Submission.js';
import UserStatsDaily from '../src/models/UserStatsDaily.js';
import { authenticateAsUser, authHeader } from './utils.js';

let mongoServer;

let problemIdCounter = 400000;
let problemNumberCounter = 10_000;

const buildProblem = (overrides = {}) => {
  const problemId = overrides.problemId ?? problemIdCounter++;
  const problemNumber = overrides.problemNumber ?? problemNumberCounter++;
  const statement = overrides.statement ?? 'Sum two numbers.';
  const statementMd = overrides.statementMd ?? statement;

  return {
    title: 'Resubmit Problem',
    statement,
    statementMd,
    difficulty: 'BASIC',
    problemId,
    problemNumber,
    judge0LanguageIds: [71],
    author: new mongoose.Types.ObjectId(),
    isPublic: true,
    algorithms: ['Arithmetic'],
    testCases: [
      { input: '1 2', output: '3', points: 1 },
      { input: '5 7', output: '12', points: 1 }
    ],
    ...overrides
  };
};

const waitForSubmissionCompletion = async (submissionId, timeoutMs = 3000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const doc = await Submission.findById(submissionId);
    if (doc && !['queued', 'running'].includes(doc.status)) {
      return doc;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Submission ${submissionId} did not finish within ${timeoutMs}ms`);
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: { ip: '127.0.0.1', bindIp: '127.0.0.1', port: 0 }
  });
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await Problem.deleteMany({});
  await Submission.deleteMany({});
  await UserStatsDaily.deleteMany({});
  vi.clearAllMocks();
  problemIdCounter = 400000;
  problemNumberCounter = 10_000;
});

describe('resubmitAndUpdate', () => {
  it('updates existing submission, run history, and problem counters when verdict changes', async () => {
    const userSession = await authenticateAsUser();
    const problem = await Problem.create(buildProblem());

    // Force the first submission to fail (WA)
    const wrongAnswerResponse = {
      stdout: Buffer.from('999', 'utf8').toString('base64'),
      stderr: null,
      compile_output: null,
      message: null,
      status: { id: 4, description: 'Wrong Answer' },
      time: '0.01',
      memory: 10_240
    };
    runJudge0Submission.mockImplementationOnce(async () => wrongAnswerResponse);
    runJudge0Submission.mockImplementationOnce(async () => wrongAnswerResponse);

    const createResponse = await request(app)
      .post('/api/submissions')
      .set(authHeader(userSession.tokens.accessToken))
      .send({ problemId: problem._id.toString(), languageId: 71, sourceCode: 'code' });

    expect(createResponse.status).toBe(202);
    const submissionId = createResponse.body.submissionId;
    const initial = await waitForSubmissionCompletion(submissionId);

    expect(initial.verdict).toBe('WA');
    expect(initial.runs).toHaveLength(1);

    let reloadedProblem = await Problem.findById(problem._id).lean();
    expect(reloadedProblem.submissionCount).toBe(1);
    expect(reloadedProblem.acceptedSubmissionCount).toBe(0);

    const dailyStats = await UserStatsDaily.findOne({ user: userSession.user.id });
    expect(dailyStats.submitCount).toBe(1);
    expect(dailyStats.acCount).toBe(0);

    runJudge0Submission.mockClear();

    const resubmitResponse = await request(app)
      .patch(`/api/submissions/${submissionId}/resubmit`)
      .set(authHeader(userSession.tokens.accessToken));

    expect(resubmitResponse.status).toBe(200);
    expect(resubmitResponse.body.submission._id).toBe(submissionId);
    expect(resubmitResponse.body.submission.verdict).toBe('AC');
    expect(resubmitResponse.body.submission.runs.length).toBe(2);

    const updatedSubmission = await Submission.findById(submissionId).lean();
    expect(updatedSubmission.verdict).toBe('AC');
    expect(updatedSubmission.status).toBe('accepted');
    expect(updatedSubmission.runs).toHaveLength(2);
    expect(updatedSubmission.runs[0].status.status).toBe('wrong_answer');
    expect(updatedSubmission.runs[1].status.status).toBe('accepted');
    expect(updatedSubmission.lastRunAt).toBeInstanceOf(Date);

    reloadedProblem = await Problem.findById(problem._id).lean();
    expect(reloadedProblem.submissionCount).toBe(1);
    expect(reloadedProblem.acceptedSubmissionCount).toBe(1);

    const refreshedStats = await UserStatsDaily.findOne({ user: userSession.user.id });
    expect(refreshedStats.submitCount).toBe(1);
    expect(refreshedStats.acCount).toBe(0);
  });
});
