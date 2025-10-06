import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
  })
}));

const { runJudge0Submission } = await import('../src/services/judge0Service.js');

import app from '../src/app.js';
import Problem from '../src/models/Problem.js';
import Submission from '../src/models/Submission.js';
import UserStatsDaily from '../src/models/UserStatsDaily.js';
import { authenticateAsAdmin, authenticateAsUser, authHeader } from './utils.js';

let mongoServer;

let problemNumberCounter = 1;

const buildProblem = (overrides = {}) => ({
  title: 'Submission Problem',
  slug: `submission-problem-${Math.random().toString(36).slice(2, 8)}`,
  statement: 'Sum two numbers.',
  difficulty: 'BASIC',
  problemNumber: problemNumberCounter++,
  judge0LanguageIds: [71],
  author: new mongoose.Types.ObjectId(),
  isPublic: true,
  testCases: [
    { input: '1 2', expectedOutput: '3', isPublic: true },
    { input: '5 7', expectedOutput: '12', isPublic: false }
  ],
  ...overrides
});

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1', port: 0 } });
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
  problemNumberCounter = 1;
});

describe('Submission routes with auth', () => {
  it('creates a submission for an authenticated user', async () => {
    const { user, tokens } = await authenticateAsUser();
    const problem = await Problem.create(buildProblem({ problemNumber: 1, slug: 'sum-problem' }));

    const response = await request(app)
      .post('/api/submissions')
      .set(authHeader(tokens.accessToken))
      .send({
        problemId: problem._id.toString(),
        languageId: 71,
        sourceCode: 'print(sum(map(int, input().split())))'
      });

    expect(response.status).toBe(201);
    expect(response.body.submission.verdict).toBe('AC');
    expect(runJudge0Submission).toHaveBeenCalledTimes(2);

    const updatedProblem = await Problem.findById(problem._id);
    expect(updatedProblem.submissionCount).toBe(1);
    expect(updatedProblem.acceptedSubmissionCount).toBe(1);

    const dailyStats = await UserStatsDaily.findOne({ user: user.id });
    expect(dailyStats.submitCount).toBe(1);
    expect(dailyStats.acCount).toBe(1);
  });

  it('rejects submissions with disallowed languages', async () => {
    const { tokens } = await authenticateAsUser();
    const problem = await Problem.create(buildProblem({ judge0LanguageIds: [63] }));

    const response = await request(app)
      .post('/api/submissions')
      .set(authHeader(tokens.accessToken))
      .send({ problemId: problem._id.toString(), languageId: 71, sourceCode: 'print(0)' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_LANGUAGE');
  });

  it('lists submissions for the authenticated user only', async () => {
    const { user, tokens } = await authenticateAsUser();
    const problem = await Problem.create(buildProblem());

    await request(app)
      .post('/api/submissions')
      .set(authHeader(tokens.accessToken))
      .send({ problemId: problem._id.toString(), languageId: 71, sourceCode: 'code' });

    const myResponse = await request(app)
      .get('/api/submissions/mine')
      .set(authHeader(tokens.accessToken));

    expect(myResponse.status).toBe(200);
    expect(myResponse.body.items).toHaveLength(1);
    expect(myResponse.body.items[0].problem.slug).toBe(problem.slug);
    expect(myResponse.body.items[0].user).toBeUndefined();

    const adminSession = await authenticateAsAdmin();
    const adminResponse = await request(app)
      .get('/api/submissions')
      .set(authHeader(adminSession.tokens.accessToken));
    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.items.length).toBeGreaterThanOrEqual(1);
    expect(adminResponse.body.items[0].user.id).toBeDefined();
  });

  it('allows owners to fetch their submission detail', async () => {
    const { tokens } = await authenticateAsUser();
    const problem = await Problem.create(buildProblem());

    const createResponse = await request(app)
      .post('/api/submissions')
      .set(authHeader(tokens.accessToken))
      .send({ problemId: problem._id.toString(), languageId: 71, sourceCode: 'code' });

    const submissionId = createResponse.body.submission.id;
    const detailResponse = await request(app)
      .get(`/api/submissions/${submissionId}`)
      .set(authHeader(tokens.accessToken));

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.submission.id).toBe(submissionId);
  });

  it('prevents unauthenticated submissions', async () => {
    const problem = await Problem.create(buildProblem());

    const response = await request(app).post('/api/submissions').send({
      problemId: problem._id.toString(),
      languageId: 71,
      sourceCode: 'print(0)'
    });

    expect(response.status).toBe(401);
  });
});
