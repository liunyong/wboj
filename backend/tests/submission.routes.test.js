import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/judge0Service.js', async () => {
  return {
    runJudge0Submission: vi.fn(async ({ stdin }) => {
      const [a = '0', b = '0'] = String(stdin).split(/\s+/);
      const sum = Number(a) + Number(b);
      const stdout = Buffer.from(String(sum), 'utf8').toString('base64');

      return {
        stdout,
        stderr: null,
        compile_output: null,
        message: null,
        status_id: 3,
        status: { id: 3, description: 'Accepted' },
        time: '0.01',
        memory: 1024
      };
    }),
    fetchJudge0Languages: vi.fn(async () => [{ id: 71, name: 'Python' }]),
    clearLanguageCache: vi.fn()
  };
});

const { runJudge0Submission } = await import('../src/services/judge0Service.js');

import app from '../src/app.js';
import Problem from '../src/models/Problem.js';
import Submission from '../src/models/Submission.js';

let mongoServer;

const buildProblem = (overrides = {}) => ({
  title: 'Submission Problem',
  slug: 'submission-problem',
  description: 'Sum two numbers',
  judge0LanguageIds: [71],
  testCases: [
    { input: '1 2', expectedOutput: '3', isPublic: true },
    { input: '2 5', expectedOutput: '7', isPublic: false }
  ],
  ...overrides
});

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: {
      ip: '127.0.0.1',
      port: 0
    }
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
});

afterEach(async () => {
  await Submission.deleteMany({});
});

describe('Submission routes', () => {
  it('creates a submission and stores Judge0 results', async () => {
    const problem = await Problem.create(buildProblem());

    const response = await request(app)
      .post('/api/submissions')
      .send({
        problemId: problem._id.toString(),
        languageId: 71,
        sourceCode: 'print(sum(map(int, input().split())))'
      });

    expect(response.status).toBe(201);
    expect(response.body.problem.slug).toBe('submission-problem');
    expect(response.body.verdict).toBe('Accepted');
    expect(runJudge0Submission).toHaveBeenCalledTimes(2);
    expect(response.body.testCaseResults).toHaveLength(2);
  });

  it('validates submission payloads', async () => {
    const response = await request(app).post('/api/submissions').send({
      problemId: 'invalid',
      languageId: 'abc'
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation failed');
  });

  it('returns 404 when problem is missing', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();

    const response = await request(app)
      .post('/api/submissions')
      .send({
        problemId: fakeId,
        languageId: 71,
        sourceCode: 'print(0)'
      });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Problem not found');
  });

  it('lists submissions with optional filters', async () => {
    const problem = await Problem.create(buildProblem());

    await Submission.create([
      {
        problem: problem._id,
        languageId: 71,
        sourceCode: 'code',
        verdict: 'Accepted'
      },
      {
        problem: problem._id,
        languageId: 71,
        sourceCode: 'code2',
        verdict: 'Accepted'
      }
    ]);

    const response = await request(app).get(
      `/api/submissions?limit=1&problemId=${problem._id.toString()}`
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
  });

  it('validates submission identifiers', async () => {
    const response = await request(app).get('/api/submissions/not-an-id');

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation failed');
  });
});
