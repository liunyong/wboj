import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import app from '../src/app.js';
import Problem from '../src/models/Problem.js';
import Submission from '../src/models/Submission.js';
import User from '../src/models/User.js';
import { authenticateAsAdmin, authenticateAsUser, authHeader } from './utils.js';

let mongoServer;

const buildProblem = (overrides = {}) => {
  const baseId = overrides.problemId ?? Math.floor(Math.random() * 100000);
  return {
    title: `Problem ${baseId}`,
    statement: 'Sample statement',
    difficulty: 'BASIC',
    problemId: baseId,
    problemNumber: baseId,
    judge0LanguageIds: [71],
    author: new mongoose.Types.ObjectId(),
    isPublic: true,
    algorithms: ['Math'],
    testCases: [{ input: '1 2', output: '3', points: 1 }],
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
  await Promise.all([Submission.deleteMany({}), Problem.deleteMany({}), User.deleteMany({})]);
});

describe('User privacy and dashboard', () => {
  it('allows users to toggle profile visibility', async () => {
    const session = await authenticateAsUser();

    const response = await request(app)
      .put('/api/users/me/profile')
      .set(authHeader(session.tokens.accessToken))
      .send({ profilePublic: true });

    expect(response.status).toBe(200);
    expect(response.body.profilePublic).toBe(true);

    const updatedUser = await User.findById(session.user.id);
    expect(updatedUser.profilePublic).toBe(true);
  });

  it('enforces profile privacy while allowing admins and owners to view dashboards', async () => {
    const primarySession = await authenticateAsUser();
    const secondarySession = await authenticateAsUser();
    const adminSession = await authenticateAsAdmin();

    const problemSolved = await Problem.create(buildProblem());
    const problemAttempted = await Problem.create(buildProblem());

    const baseDates = {
      queuedAt: new Date(Date.now() - 1000 * 60 * 60),
      startedAt: new Date(Date.now() - 1000 * 60 * 55),
      finishedAt: new Date(Date.now() - 1000 * 60 * 50)
    };

    await Submission.create({
      user: primarySession.user.id,
      userName: primarySession.user.username,
      problem: problemSolved._id,
      problemId: problemSolved.problemId,
      problemTitle: problemSolved.title,
      languageId: 71,
      language: 'language-71',
      sourceCode: 'code',
      status: 'accepted',
      verdict: 'AC',
      score: 100,
      execTimeMs: 10,
      runtimeMs: 10,
      memoryKb: 1024,
      memoryKB: 1024,
      queuedAt: baseDates.queuedAt,
      startedAt: baseDates.startedAt,
      finishedAt: baseDates.finishedAt,
      submittedAt: baseDates.queuedAt
    });

    await Submission.create({
      user: primarySession.user.id,
      userName: primarySession.user.username,
      problem: problemAttempted._id,
      problemId: problemAttempted.problemId,
      problemTitle: problemAttempted.title,
      languageId: 71,
      language: 'language-71',
      sourceCode: 'code',
      status: 'wrong_answer',
      verdict: 'WA',
      score: 0,
      queuedAt: new Date(),
      finishedAt: new Date(),
      submittedAt: new Date()
    });

    const ownerResponse = await request(app)
      .get(`/api/users/${primarySession.user.username}/dashboard`)
      .set(authHeader(primarySession.tokens.accessToken));

    expect(ownerResponse.status).toBe(200);
    expect(ownerResponse.body.solved).toHaveLength(1);
    expect(ownerResponse.body.attempted).toHaveLength(1);

    const otherResponse = await request(app)
      .get(`/api/users/${primarySession.user.username}/dashboard`)
      .set(authHeader(secondarySession.tokens.accessToken));

    expect(otherResponse.status).toBe(403);

    const adminResponse = await request(app)
      .get(`/api/users/${primarySession.user.username}/dashboard`)
      .set(authHeader(adminSession.tokens.accessToken));

    expect(adminResponse.status).toBe(200);

    await request(app)
      .put('/api/users/me/profile')
      .set(authHeader(primarySession.tokens.accessToken))
      .send({ profilePublic: true });

    const publicResponse = await request(app)
      .get(`/api/users/${primarySession.user.username}/dashboard`)
      .set(authHeader(secondarySession.tokens.accessToken));

    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body.solved).toHaveLength(1);
  });

  it('allows admins to delete a user while keeping submissions', async () => {
    const adminSession = await authenticateAsAdmin();
    const userSession = await authenticateAsUser();

    const problem = await Problem.create(buildProblem());

    await Submission.create({
      user: userSession.user.id,
      userName: userSession.user.username,
      problem: problem._id,
      problemId: problem.problemId,
      problemTitle: problem.title,
      languageId: 71,
      language: 'language-71',
      sourceCode: 'code',
      status: 'accepted',
      verdict: 'AC',
      score: 100,
      queuedAt: new Date(),
      startedAt: new Date(),
      finishedAt: new Date(),
      submittedAt: new Date()
    });

    const deleteResponse = await request(app)
      .delete(`/api/admin/users/${userSession.user.id}`)
      .set(authHeader(adminSession.tokens.accessToken));

    expect(deleteResponse.status).toBe(204);

    const remaining = await Submission.find({ problemId: problem.problemId });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].userName).toBe(userSession.user.username);
  });
});
