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
import {
  authHeader,
  authenticateAsSuperAdmin,
  authenticateAsUser
} from './utils.js';

let mongoServer;

let problemIdCounter = 500000;
let problemNumberCounter = 20_000;

const buildProblem = (overrides = {}) => {
  const problemId = overrides.problemId ?? problemIdCounter++;
  const problemNumber = overrides.problemNumber ?? problemNumberCounter++;
  const statement = overrides.statement ?? 'Sum two numbers.';
  const statementMd = overrides.statementMd ?? statement;

  return {
    title: 'Delete Submission Problem',
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
  vi.clearAllMocks();
  problemIdCounter = 500000;
  problemNumberCounter = 20_000;
});

describe('DELETE /api/submissions/:id', () => {
  it('soft deletes AC submissions and updates counters', async () => {
    const userSession = await authenticateAsUser();
    const superSession = await authenticateAsSuperAdmin();
    const problem = await Problem.create(buildProblem());

    const createResponse = await request(app)
      .post('/api/submissions')
      .set(authHeader(userSession.tokens.accessToken))
      .send({ problemId: problem._id.toString(), languageId: 71, sourceCode: 'code' });

    expect(createResponse.status).toBe(202);
    const submissionId = createResponse.body.submissionId;
    await waitForSubmissionCompletion(submissionId);

    let problemDoc = await Problem.findById(problem._id).lean();
    expect(problemDoc.submissionCount).toBe(1);
    expect(problemDoc.acceptedSubmissionCount).toBe(1);

    const deleteResponse = await request(app)
      .delete(`/api/submissions/${submissionId}`)
      .set(authHeader(superSession.tokens.accessToken));

    expect(deleteResponse.status).toBe(204);

    const deletedSubmission = await Submission.findById(submissionId).lean();
    expect(deletedSubmission.deletedAt).toBeInstanceOf(Date);

    problemDoc = await Problem.findById(problem._id).lean();
    expect(problemDoc.submissionCount).toBe(0);
    expect(problemDoc.acceptedSubmissionCount).toBe(0);

    const detailResponse = await request(app)
      .get(`/api/submissions/${submissionId}`)
      .set(authHeader(userSession.tokens.accessToken));
    expect(detailResponse.status).toBe(404);

    const listResponse = await request(app)
      .get(`/api/submissions/mine`)
      .set(authHeader(userSession.tokens.accessToken));
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.items).toHaveLength(0);
  });

  it('soft deletes non-AC submissions without touching accepted counters', async () => {
    const userSession = await authenticateAsUser();
    const superSession = await authenticateAsSuperAdmin();
    const problem = await Problem.create(buildProblem());

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
    await waitForSubmissionCompletion(submissionId);

    let problemDoc = await Problem.findById(problem._id).lean();
    expect(problemDoc.submissionCount).toBe(1);
    expect(problemDoc.acceptedSubmissionCount).toBe(0);

    const deleteResponse = await request(app)
      .delete(`/api/submissions/${submissionId}`)
      .set(authHeader(superSession.tokens.accessToken));

    expect(deleteResponse.status).toBe(204);

    const deletedSubmission = await Submission.findById(submissionId).lean();
    expect(deletedSubmission.deletedAt).toBeInstanceOf(Date);
    expect(deletedSubmission.verdict).toBe('WA');

    problemDoc = await Problem.findById(problem._id).lean();
    expect(problemDoc.submissionCount).toBe(0);
    expect(problemDoc.acceptedSubmissionCount).toBe(0);
  });
});
