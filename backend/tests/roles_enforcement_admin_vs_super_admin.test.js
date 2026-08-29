import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import app from '../src/app.js';
import User from '../src/models/User.js';
import Problem from '../src/models/Problem.js';
import Submission from '../src/models/Submission.js';
import UserStatsDaily from '../src/models/UserStatsDaily.js';
import {
  authHeader,
  authenticateAsAdmin,
  authenticateAsSuperAdmin,
  createUser
} from './utils.js';

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
  await Promise.all([
    User.deleteMany({}),
    Problem.deleteMany({}),
    Submission.deleteMany({}),
    UserStatsDaily.deleteMany({})
  ]);
});

describe('role enforcement for admin vs super_admin', () => {
  it('allows only super_admin to manage user roles and activation', async () => {
    const adminSession = await authenticateAsAdmin();
    const superSession = await authenticateAsSuperAdmin();

    const targetUser = await createUser({
      username: 'managed_user',
      email: 'managed@example.com',
      password: 'Password123!',
      role: 'user'
    });

    const adminRoleAttempt = await request(app)
      .patch(`/api/admin/users/${targetUser._id.toString()}/role`)
      .set(authHeader(adminSession.tokens.accessToken))
      .send({ role: 'admin' });

    expect(adminRoleAttempt.status).toBe(403);

    const superRoleUpdate = await request(app)
      .patch(`/api/admin/users/${targetUser._id.toString()}/role`)
      .set(authHeader(superSession.tokens.accessToken))
      .send({ role: 'admin' });

    expect(superRoleUpdate.status).toBe(200);
    expect(superRoleUpdate.body.user.role).toBe('admin');

    const adminDeactivateAttempt = await request(app)
      .patch(`/api/admin/users/${targetUser._id.toString()}/deactivate`)
      .set(authHeader(adminSession.tokens.accessToken))
      .send();

    expect(adminDeactivateAttempt.status).toBe(403);

    const superDeactivate = await request(app)
      .patch(`/api/admin/users/${targetUser._id.toString()}/deactivate`)
      .set(authHeader(superSession.tokens.accessToken))
      .send();

    expect(superDeactivate.status).toBe(200);
    expect(superDeactivate.body.user.isActive).toBe(false);

    const refreshedTarget = await User.findById(targetUser._id);
    expect(refreshedTarget.isActive).toBe(false);
    expect(refreshedTarget.deletedAt).toBeNull();
  });

  it('allows only super_admin to permanently delete users and their activity', async () => {
    const adminSession = await authenticateAsAdmin();
    const superSession = await authenticateAsSuperAdmin();

    const targetUser = await createUser({
      username: 'delete_user',
      email: 'delete@example.com',
      password: 'Password123!',
      role: 'user'
    });
    const problem = await Problem.create({
      title: 'Deletion accounting',
      problemId: 910001,
      problemNumber: 910001,
      statement: 'Test',
      testCases: [{ input: '1', output: '1' }],
      submissionCount: 1,
      acceptedSubmissionCount: 1
    });
    await Submission.create({
      user: targetUser._id,
      problem: problem._id,
      problemId: problem.problemId,
      problemTitle: problem.title,
      languageId: 71,
      sourceCode: 'print(1)',
      verdict: 'AC',
      status: 'accepted',
      finishedAt: new Date()
    });
    await UserStatsDaily.create({
      user: targetUser._id,
      date: '2026-08-17',
      submitCount: 1,
      acCount: 1
    });

    const adminDeleteAttempt = await request(app)
      .delete(`/api/admin/users/${targetUser._id.toString()}`)
      .set(authHeader(adminSession.tokens.accessToken));

    expect(adminDeleteAttempt.status).toBe(403);

    const superDelete = await request(app)
      .delete(`/api/admin/users/${targetUser._id.toString()}`)
      .set(authHeader(superSession.tokens.accessToken));

    expect(superDelete.status).toBe(204);

    expect(await User.findById(targetUser._id)).toBeNull();
    expect(await Submission.countDocuments({ user: targetUser._id })).toBe(0);
    expect(await UserStatsDaily.countDocuments({ user: targetUser._id })).toBe(0);
    const recounted = await Problem.findById(problem._id);
    expect(recounted.submissionCount).toBe(0);
    expect(recounted.acceptedSubmissionCount).toBe(0);
  });

  it('supports search, pagination, and bulk deletion', async () => {
    const superSession = await authenticateAsSuperAdmin();
    const first = await createUser({
      username: 'search_alpha', email: 'alpha@example.com', password: 'Password123!'
    });
    const second = await createUser({
      username: 'search_beta', email: 'beta@example.com', password: 'Password123!'
    });

    const page = await request(app)
      .get('/api/admin/users?search=search&page=1&limit=1')
      .set(authHeader(superSession.tokens.accessToken));
    expect(page.status).toBe(200);
    expect(page.body.items).toHaveLength(1);
    expect(page.body.total).toBe(2);
    expect(page.body.totalPages).toBe(2);

    const deleted = await request(app)
      .delete('/api/admin/users/bulk')
      .set(authHeader(superSession.tokens.accessToken))
      .send({ ids: [first._id.toString(), second._id.toString()] });
    expect(deleted.status).toBe(200);
    expect(deleted.body.deletedCount).toBe(2);
    expect(await User.countDocuments({ _id: { $in: [first._id, second._id] } })).toBe(0);
  });
});
