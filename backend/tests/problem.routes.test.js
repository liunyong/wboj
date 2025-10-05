import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import app from '../src/app.js';
import Problem from '../src/models/Problem.js';

let mongoServer;
let nextProblemNumber = 1;

const buildProblem = (overrides = {}) => {
  const hasOverrideNumber = typeof overrides.problemNumber === 'number';
  const assignedNumber = hasOverrideNumber ? overrides.problemNumber : nextProblemNumber;

  if (hasOverrideNumber) {
    nextProblemNumber = Math.max(nextProblemNumber, overrides.problemNumber + 1);
  } else {
    nextProblemNumber += 1;
  }

  return {
    title: 'Sample Problem',
    slug: 'sample-problem',
    description: 'Add two numbers',
    judge0LanguageIds: [71],
    testCases: [
      {
        input: '1 2',
        expectedOutput: '3',
        isPublic: true,
        inputFileName: 'input1.txt',
        outputFileName: 'output1.txt'
      },
      {
        input: '2 3',
        expectedOutput: '5',
        isPublic: false,
        inputFileName: 'input2.txt',
        outputFileName: 'output2.txt'
      }
    ],
    problemNumber: assignedNumber,
    ...overrides
  };
};

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
  nextProblemNumber = 1;
});

describe('Problem routes', () => {
  it('lists problems with pagination metadata', async () => {
    await Problem.create([
      buildProblem(),
      buildProblem({ slug: 'sample-problem-2', title: 'Sample 2' }),
      buildProblem({ slug: 'sample-problem-3', title: 'Sample 3' })
    ]);

    const response = await request(app).get('/api/problems?limit=2&page=2');

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.page).toBe(2);
    expect(response.body.limit).toBe(2);
   expect(response.body.total).toBe(3);
   expect(response.body.totalPages).toBe(2);
   expect(response.body.items[0].problemNumber).toBeDefined();
    expect(response.body.items[0].submissionCount).toBe(0);
    expect(response.body.items[0].acceptedSubmissionCount).toBe(0);
    expect(response.body.items[0].acceptanceRate).toBe(0);
  });

  it('filters problems by visibility', async () => {
    await Problem.create([
      buildProblem(),
      buildProblem({
        slug: 'private-problem',
        title: 'Private Only',
        testCases: [
          { input: '3 4', expectedOutput: '7', isPublic: false }
        ]
      })
    ]);

    const publicResponse = await request(app).get('/api/problems?visibility=public');
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body.total).toBe(1);

    const privateResponse = await request(app).get('/api/problems?visibility=private');
    expect(privateResponse.status).toBe(200);
    expect(privateResponse.body.total).toBe(1);
    expect(privateResponse.body.items[0].slug).toBe('private-problem');
  });

  it('creates a problem with valid payload', async () => {
    const response = await request(app)
      .post('/api/problems')
      .send({
        title: 'New Problem',
        slug: 'new-problem',
        description: 'Simple addition',
        judge0LanguageIds: [71, 63],
        testCases: [
          {
            input: '1 1',
            expectedOutput: '2',
            isPublic: true,
            inputFileName: 'case1.in',
            outputFileName: 'case1.out'
          }
        ]
      });

    expect(response.status).toBe(201);
    expect(response.body.slug).toBe('new-problem');
    expect(response.body.problemNumber).toBe(1);
    expect(response.body.testCases[0].inputFileName).toBe('case1.in');
    expect(response.body.submissionCount).toBe(0);
    expect(response.body.acceptedSubmissionCount).toBe(0);
    expect(response.body.acceptanceRate).toBe(0);
    expect(await Problem.countDocuments()).toBe(1);
  });

  it('rejects invalid payloads', async () => {
    const response = await request(app)
      .post('/api/problems')
      .send({
        title: 'Bad Problem',
        slug: 'INVALID',
        description: 'broken',
        testCases: []
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation failed');
    expect(response.body.errors).toBeDefined();
  });

  it('updates an existing problem', async () => {
    const problem = await Problem.create(buildProblem());

    const response = await request(app)
      .patch(`/api/problems/${problem._id}`)
      .send({ title: 'Updated Title' });

    expect(response.status).toBe(200);
    expect(response.body.title).toBe('Updated Title');
    expect(response.body.problemNumber).toBe(problem.problemNumber);
  });

  it('deletes a problem by id', async () => {
    const problem = await Problem.create(buildProblem());

    const response = await request(app).delete(`/api/problems/${problem._id}`);

    expect(response.status).toBe(204);
    expect(await Problem.countDocuments()).toBe(0);
  });

  it('controls exposure of private test cases', async () => {
    await Problem.create(buildProblem());

    const publicResponse = await request(app).get('/api/problems/sample-problem');
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body.testCases).toHaveLength(1);
    expect(publicResponse.body.testCases[0].isPublic).toBe(true);

    const privateResponse = await request(app).get(
      '/api/problems/sample-problem?includePrivate=true'
    );
    expect(privateResponse.status).toBe(200);
    expect(privateResponse.body.testCases).toHaveLength(2);
  });

  it('reuses freed problem numbers when creating new problems', async () => {
    const first = await request(app)
      .post('/api/problems')
      .send({
        title: 'First Problem',
        slug: 'first-problem',
        description: 'First',
        judge0LanguageIds: [71],
        testCases: [
          {
            input: '1 1',
            expectedOutput: '2',
            isPublic: true
          }
        ]
      });

    const second = await request(app)
      .post('/api/problems')
      .send({
        title: 'Second Problem',
        slug: 'second-problem',
        description: 'Second',
        judge0LanguageIds: [71],
        testCases: [
          {
            input: '2 2',
            expectedOutput: '4',
            isPublic: true
          }
        ]
      });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.problemNumber).toBe(1);
    expect(second.body.problemNumber).toBe(2);

    await request(app).delete(`/api/problems/${first.body._id}`);

    const third = await request(app)
      .post('/api/problems')
      .send({
        title: 'Third Problem',
        slug: 'third-problem',
        description: 'Third',
        judge0LanguageIds: [71],
        testCases: [
          {
            input: '3 3',
            expectedOutput: '6',
            isPublic: true
          }
        ]
      });

    expect(third.status).toBe(201);
    expect(third.body.problemNumber).toBe(1);
  });
});
