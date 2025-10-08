import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import app from '../src/app.js';
import Problem from '../src/models/Problem.js';
import { authenticateAsAdmin, authenticateAsUser, authHeader } from './utils.js';

let mongoServer;
let problemIdCounter = 100000;
let problemNumberCounter = 1;

const buildProblem = (overrides = {}) => {
  const problemId = overrides.problemId ?? problemIdCounter++;
  const problemNumber = overrides.problemNumber ?? problemNumberCounter++;

  return {
    title: 'Sample Problem',
    statement: 'Add two numbers.',
    inputFormat: 'Two integers a and b',
    outputFormat: 'One integer representing the sum',
    constraints: '0 <= |a|, |b| <= 10^9',
    difficulty: 'BASIC',
    tags: ['math'],
    algorithms: ['Arithmetic'],
    samples: [{ input: '1 2', output: '3', explanation: '1 + 2 = 3' }],
    problemId,
    problemNumber,
    judge0LanguageIds: [71],
    author: new mongoose.Types.ObjectId(),
    isPublic: true,
    testCases: [
      { input: '1 2', output: '3', points: 1 },
      { input: '5 7', output: '12', points: 2 }
    ],
    ...overrides
  };
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: { ip: '127.0.0.1', port: 0 }
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
  problemIdCounter = 100000;
  problemNumberCounter = 1;
});

describe('Problem routes with auth', () => {
  it('lists only public problems to guests and all to admins', async () => {
    await Problem.create([
      buildProblem({ title: 'Public' }),
      buildProblem({ title: 'Private', isPublic: false })
    ]);

    const guestResponse = await request(app).get('/api/problems');
    expect(guestResponse.status).toBe(200);
    expect(guestResponse.body.total).toBe(1);
    expect(guestResponse.body.items[0].title).toBe('Public');
    expect(guestResponse.body.items[0].problemId).toBeGreaterThanOrEqual(100000);

    const { tokens: adminTokens } = await authenticateAsAdmin();
    const adminResponse = await request(app)
      .get('/api/problems?visibility=all')
      .set(authHeader(adminTokens.accessToken));
    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.total).toBe(2);
  });

  it('allows admins to create problems', async () => {
    const { tokens: adminTokens } = await authenticateAsAdmin();

    const response = await request(app)
      .post('/api/problems')
      .set(authHeader(adminTokens.accessToken))
      .send({
        title: 'New Problem',
        statement: 'Compute the difference.',
        difficulty: 'EASY',
        tags: ['math', 'difference'],
        algorithms: ['Math'],
        judge0LanguageIds: [71],
        samples: [{ input: '5 3', output: '2' }],
        testCases: [{ input: '5 3', output: '2', points: 1 }]
      });

    expect(response.status).toBe(201);
    expect(response.body.problemId).toBeGreaterThanOrEqual(100000);
    expect(response.body.author).toBeDefined();
  });

  it('blocks non-admins from creating problems', async () => {
    const { tokens } = await authenticateAsUser();

    const response = await request(app)
      .post('/api/problems')
      .set(authHeader(tokens.accessToken))
      .send({
        title: 'Forbidden',
        statement: 'Nope',
        judge0LanguageIds: [71],
        samples: [{ input: '1', output: '1' }],
        testCases: [{ input: '1', output: '1', points: 1 }]
      });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('reveals private test cases only to admins when requested', async () => {
    const problem = await Problem.create(buildProblem());

    const guestResponse = await request(app).get(`/api/problems/${problem.problemId}`);
    expect(guestResponse.status).toBe(200);
    expect(guestResponse.body.testCases).toBeUndefined();
    expect(guestResponse.body.testCaseCount).toBe(2);

    const { tokens: adminTokens } = await authenticateAsAdmin();
    const adminResponse = await request(app)
      .get(`/api/problems/${problem.problemId}?includePrivate=true`)
      .set(authHeader(adminTokens.accessToken));

    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.testCases).toHaveLength(2);
    expect(adminResponse.body.totalPoints).toBe(3);
  });
});
