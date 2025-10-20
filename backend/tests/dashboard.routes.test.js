import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import app from '../src/app.js';
import Problem from '../src/models/Problem.js';
import Submission from '../src/models/Submission.js';
import UserStatsDaily from '../src/models/UserStatsDaily.js';
import { authHeader, authenticateAsUser } from './utils.js';

let mongoServer;

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
  await Promise.all([Submission.deleteMany({}), UserStatsDaily.deleteMany({}), Problem.deleteMany({})]);
});

describe('Dashboard routes', () => {
  it('returns yearly summary and heatmap for the user', async () => {
    const session = await authenticateAsUser();
    const userId = new mongoose.Types.ObjectId(session.user.id);
    const problemId = new mongoose.Types.ObjectId();
    const year = new Date().getUTCFullYear();

    await Submission.create([
      {
        user: userId,
        problem: problemId,
        languageId: 71,
        sourceCode: 'code',
        verdict: 'AC',
        submittedAt: new Date(Date.UTC(year, 0, 10))
      },
      {
        user: userId,
        problem: problemId,
        languageId: 71,
        sourceCode: 'code 2',
        verdict: 'WA',
        submittedAt: new Date(Date.UTC(year, 1, 15))
      }
    ]);

    await UserStatsDaily.create({
      user: userId,
      date: `${year}-01-10`,
      submitCount: 1,
      acCount: 1
    });

    const summaryResponse = await request(app)
      .get(`/api/dashboard/me/summary?year=${year}`)
      .set(authHeader(session.tokens.accessToken));

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.totalSubmissions).toBe(2);
    expect(summaryResponse.body.totalAC).toBe(1);
    expect(summaryResponse.body.totalWA).toBe(1);

    const heatmapResponse = await request(app)
      .get(`/api/dashboard/me/heatmap?year=${year}`)
      .set(authHeader(session.tokens.accessToken));

    expect(heatmapResponse.status).toBe(200);
    expect(heatmapResponse.body.items).toHaveLength(1);
    expect(heatmapResponse.body.items[0].acCount).toBe(1);
  });

  it('returns solved and attempted progress for the user', async () => {
    const session = await authenticateAsUser();
    const userId = new mongoose.Types.ObjectId(session.user.id);

    const problemSolved = await Problem.create({
      title: 'A + B',
      slug: 'a-plus-b',
      problemId: 100000,
      problemNumber: 1,
      statement: 'Add two numbers',
      difficulty: 'BASIC',
      judge0LanguageIds: [71],
      author: new mongoose.Types.ObjectId(),
      isPublic: true,
      algorithms: ['Math'],
      testCases: [{ input: '1 2', output: '3', points: 1 }]
    });

    const problemStuck = await Problem.create({
      title: 'Fibonacci',
      slug: 'fibonacci',
      problemId: 100001,
      problemNumber: 2,
      statement: 'Compute fibonacci',
      difficulty: 'EASY',
      judge0LanguageIds: [71],
      author: new mongoose.Types.ObjectId(),
      isPublic: true,
      algorithms: ['DP'],
      testCases: [{ input: '3', output: '2', points: 1 }]
    });

    const problemMixed = await Problem.create({
      title: 'Sorting',
      slug: 'sorting',
      problemId: 100002,
      problemNumber: 3,
      statement: 'Sort numbers',
      difficulty: 'BASIC',
      judge0LanguageIds: [71],
      author: new mongoose.Types.ObjectId(),
      isPublic: true,
      algorithms: ['Sort'],
      testCases: [{ input: '3\n3 2 1', output: '1 2 3', points: 1 }]
    });

    // Already solved problem (include prior WA to confirm dedupe)
    await Submission.create([
      {
        user: userId,
        problem: problemSolved._id,
        problemId: problemSolved.problemId,
        problemTitle: problemSolved.title,
        languageId: 71,
        language: 'Python',
        sourceCode: 'print()',
        verdict: 'WA',
        status: 'wrong_answer',
        submittedAt: new Date(Date.now() - 1000 * 60 * 60)
      },
      {
        user: userId,
        problem: problemSolved._id,
        problemId: problemSolved.problemId,
        problemTitle: problemSolved.title,
        languageId: 71,
        language: 'Python',
        sourceCode: 'print()',
        verdict: 'AC',
        status: 'accepted',
        submittedAt: new Date()
      }
    ]);

    // Attempted but not yet solved
    await Submission.create({
      user: userId,
      problem: problemStuck._id,
      problemId: problemStuck.problemId,
      problemTitle: problemStuck.title,
      languageId: 71,
      language: 'Python',
      sourceCode: 'print()',
      verdict: 'WA',
      status: 'wrong_answer',
      submittedAt: new Date()
    });

    // Mixed problem: last submission AC so should not appear in attempted
    await Submission.create([
      {
        user: userId,
        problem: problemMixed._id,
        problemId: problemMixed.problemId,
        problemTitle: problemMixed.title,
        languageId: 71,
        language: 'Python',
        sourceCode: 'print()',
        verdict: 'WA',
        status: 'wrong_answer',
        submittedAt: new Date(Date.now() - 1000 * 60)
      },
      {
        user: userId,
        problem: problemMixed._id,
        problemId: problemMixed.problemId,
        problemTitle: problemMixed.title,
        languageId: 71,
        language: 'Python',
        sourceCode: 'print()',
        verdict: 'AC',
        status: 'accepted',
        submittedAt: new Date()
      }
    ]);

    const response = await request(app)
      .get('/api/dashboard/me/progress')
      .set(authHeader(session.tokens.accessToken));

    expect(response.status).toBe(200);
    expect(response.body.solved).toEqual([
      {
        problemId: 100000,
        title: 'A + B',
        slug: 'a-plus-b'
      },
      {
        problemId: 100002,
        title: 'Sorting',
        slug: 'sorting'
      }
    ]);

    expect(response.body.attempted).toEqual([
      {
        problemId: 100001,
        title: 'Fibonacci',
        slug: 'fibonacci',
        latestVerdict: 'WA',
        latestStatus: 'wrong_answer'
      }
    ]);
  });
});
