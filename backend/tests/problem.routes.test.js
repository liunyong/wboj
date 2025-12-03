import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import app from '../src/app.js';
import Problem from '../src/models/Problem.js';
import User from '../src/models/User.js';
import Submission from '../src/models/Submission.js';
import { authenticateAsAdmin, authenticateAsUser, authHeader } from './utils.js';

let mongoServer;
let problemIdCounter = 100000;
let problemNumberCounter = 1;

const buildProblem = (overrides = {}) => {
  const problemId = overrides.problemId ?? problemIdCounter++;
  const problemNumber = overrides.problemNumber ?? problemNumberCounter++;
  const statement = overrides.statement ?? 'Add two numbers.';
  const statementMd = overrides.statementMd ?? statement;

  return {
    title: 'Sample Problem',
    statement,
    statementMd,
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
  await Promise.all([Problem.deleteMany({}), Submission.deleteMany({}), User.deleteMany({})]);
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

  it('includes author metadata in listings', async () => {
    const author = await User.create({
      username: 'problem_author',
      email: 'author@example.com',
      passwordHash: 'hashed'
    });

    await Problem.create(buildProblem({ title: 'Authored', author: author._id }));

    const response = await request(app).get('/api/problems');
    expect(response.status).toBe(200);
    expect(response.body.items[0].author).toMatchObject({
      username: 'problem_author'
    });
    expect(response.body.items[0].author.profile?.displayName).toBeUndefined();
  });

  it('allows admins to create problems', async () => {
    const { tokens: adminTokens } = await authenticateAsAdmin();

    const response = await request(app)
      .post('/api/problems')
      .set(authHeader(adminTokens.accessToken))
      .send({
        title: 'New Problem',
        statementMd: 'Compute the difference.',
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
    expect(response.body.statementMd).toBe('Compute the difference.');
    expect(response.body.statement).toBe('Compute the difference.');
  });

  it('blocks non-admins from creating problems', async () => {
    const { tokens } = await authenticateAsUser();

    const response = await request(app)
      .post('/api/problems')
      .set(authHeader(tokens.accessToken))
      .send({
        title: 'Forbidden',
        statementMd: 'Nope',
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

  it('allows admins to update problems via PUT while keeping identifiers immutable', async () => {
    const original = await Problem.create(
      buildProblem({
        title: 'Original Title',
        statement: 'Original statement.',
        tags: ['math'],
        algorithms: ['Arithmetic']
      })
    );

    const { tokens: adminTokens } = await authenticateAsAdmin();

    const response = await request(app)
      .put(`/api/problems/${original.problemId}`)
      .set(authHeader(adminTokens.accessToken))
      .send({
        title: ' Updated Title ',
        statementMd: '<script>alert(1)</script>Safe statement',
        inputFormat: '  Updated input format ',
        outputFormat: 'Updated output format',
        constraints: 'Updated constraints',
        difficulty: 'MEDIUM',
        tags: ['graphs', ' shortest path '],
        algorithms: ['Graph Theory'],
        isPublic: false,
        judge0LanguageIds: [71, 75],
        samples: [{ input: '1', output: '1', explanation: '  Example ' }],
        testCases: [
          { input: '1', output: '1', points: 10 },
          { input: '2', output: '2', points: 5 }
        ],
        cpuTimeLimit: 1.5,
        memoryLimit: 256
      });

    expect(response.status).toBe(200);
    expect(response.body.problemId).toBe(original.problemId);
    expect(response.body.title).toBe('Updated Title');
    expect(response.body.statement).toBe('Safe statement');
    expect(response.body.statementMd).toBe('Safe statement');
    expect(response.body.statement.includes('<script')).toBe(false);
    expect(response.body.inputFormat).toBe('Updated input format');
    expect(response.body.tags).toEqual(['graphs', 'shortest path']);
    expect(response.body.algorithms).toEqual(['Graph Theory']);
    expect(response.body.judge0LanguageIds).toEqual([71, 75]);
    expect(response.body.testCases).toHaveLength(2);
    expect(response.body.samples[0].explanation).toBe('Example');
  });

  it('allows problem authors to update their own problems', async () => {
    const session = await authenticateAsUser();
    const authorId = new mongoose.Types.ObjectId(session.user.id);

    const problem = await Problem.create(
      buildProblem({
        author: authorId,
        title: 'Author Problem'
      })
    );

    const response = await request(app)
      .put(`/api/problems/${problem.problemId}`)
      .set(authHeader(session.tokens.accessToken))
      .send({
        title: 'Author Updated',
        statementMd: 'Updated by owner.',
        difficulty: 'HARD'
      });

    expect(response.status).toBe(200);
    expect(response.body.title).toBe('Author Updated');
    expect(response.body.difficulty).toBe('HARD');
    expect(response.body.statementMd).toBe('Updated by owner.');
  });

  it('rejects updates from users who are neither admin nor owner', async () => {
    const owner = new mongoose.Types.ObjectId();
    const problem = await Problem.create(buildProblem({ author: owner }));
    const { tokens } = await authenticateAsUser();

    const response = await request(app)
      .put(`/api/problems/${problem.problemId}`)
      .set(authHeader(tokens.accessToken))
      .send({
        title: 'Nope',
        statementMd: 'Should be blocked'
      });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('sanitizes unsafe image links and attributes within markdown statements', async () => {
    const original = await Problem.create(
      buildProblem({
        title: 'Image Problem',
        statement: 'Original'
      })
    );

    const { tokens: adminTokens } = await authenticateAsAdmin();

    const payload = {
      title: 'Image Problem',
      statementMd:
        '![should-remove](javascript:alert(1))\n\n<img src="/uploads/problems/demo.png" onerror="alert(1)" style="width:9999px" width="9000" height="2000">'
    };

    const response = await request(app)
      .put(`/api/problems/${original.problemId}`)
      .set(authHeader(adminTokens.accessToken))
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.statement.includes('javascript')).toBe(false);
    expect(response.body.statement.includes('onerror')).toBe(false);
    expect(response.body.statement.includes('style=')).toBe(false);
    expect(response.body.statement).toContain('<img');
    expect(response.body.statement).toContain('/uploads/problems/demo.png');
  });

  it('cascades submissions when a problem is deleted', async () => {
    const { tokens: adminTokens } = await authenticateAsAdmin();
    const author = new mongoose.Types.ObjectId();
    const problem = await Problem.create(buildProblem({ author }));

    await Submission.create([
      {
        user: author,
        problem: problem._id,
        languageId: 71,
        sourceCode: 'print(1)',
        verdict: 'AC'
      },
      {
        user: author,
        problem: problem._id,
        languageId: 71,
        sourceCode: 'print(2)',
        verdict: 'WA'
      }
    ]);

    const response = await request(app)
      .delete(`/api/problems/${problem.problemId}`)
      .set(authHeader(adminTokens.accessToken));

    expect(response.status).toBe(204);
    const remaining = await Submission.countDocuments({ problem: problem._id });
    expect(remaining).toBe(0);
  });
});
