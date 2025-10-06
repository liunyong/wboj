import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import app from '../src/app.js';
import Submission from '../src/models/Submission.js';
import UserStatsDaily from '../src/models/UserStatsDaily.js';
import { authHeader, authenticateAsUser } from './utils.js';

let mongoServer;

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
  await Submission.deleteMany({});
  await UserStatsDaily.deleteMany({});
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
});
