import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import app from '../src/app.js';
import User from '../src/models/User.js';
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
  await User.deleteMany({});
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

  it('allows only super_admin to soft delete users', async () => {
    const adminSession = await authenticateAsAdmin();
    const superSession = await authenticateAsSuperAdmin();

    const targetUser = await createUser({
      username: 'delete_user',
      email: 'delete@example.com',
      password: 'Password123!',
      role: 'user'
    });

    const adminDeleteAttempt = await request(app)
      .delete(`/api/admin/users/${targetUser._id.toString()}`)
      .set(authHeader(adminSession.tokens.accessToken));

    expect(adminDeleteAttempt.status).toBe(403);

    const superDelete = await request(app)
      .delete(`/api/admin/users/${targetUser._id.toString()}`)
      .set(authHeader(superSession.tokens.accessToken));

    expect(superDelete.status).toBe(204);

    const refreshed = await User.findById(targetUser._id);
    expect(refreshed.deletedAt).toBeInstanceOf(Date);
    expect(refreshed.isActive).toBe(false);
  });
});
