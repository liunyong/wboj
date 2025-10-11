import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import app from '../src/app.js';
import User from '../src/models/User.js';
import { authHeader, authenticateAsUser, createUser, loginUser } from './utils.js';

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

describe('Auth routes', () => {
  it('registers and logs in a user with tokens', async () => {
    const registerResponse = await request(app).post('/api/auth/register').send({
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123!',
      confirmPassword: 'Password123!'
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.tokens.accessToken).toBeDefined();
    expect(registerResponse.body.user.username).toBe('testuser');

    const loginResponse = await request(app).post('/api/auth/login').send({
      usernameOrEmail: 'test@example.com',
      password: 'Password123!'
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.tokens.refreshToken).toBeDefined();
  });

  it('rejects registration when passwords do not match', async () => {
    const response = await request(app).post('/api/auth/register').send({
      username: 'mismatch',
      email: 'mismatch@example.com',
      password: 'Password123!',
      confirmPassword: 'Password1234!'
    });

    expect(response.status).toBe(400);
    expect(response.body.errors[0].path).toBe('confirmPassword');
    expect(response.body.errors[0].message).toBe('Passwords do not match');
  });

  it('rejects weak passwords during registration', async () => {
    const response = await request(app).post('/api/auth/register').send({
      username: 'weakling',
      email: 'weak@example.com',
      password: 'weakweakwe',
      confirmPassword: 'weakweakwe'
    });

    expect(response.status).toBe(400);
    expect(response.body.errors[0].path).toBe('password');
    expect(response.body.errors[0].message).toContain('Password must include at least three');
  });

  it('refreshes tokens and rotates sessions', async () => {
    const registerResponse = await request(app).post('/api/auth/register').send({
      username: 'refreshuser',
      email: 'refresh@example.com',
      password: 'Password123!',
      confirmPassword: 'Password123!'
    });

    const { tokens } = registerResponse.body;

    const refreshResponse = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: tokens.refreshToken });

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.tokens.accessToken).not.toBe(tokens.accessToken);
  });

  it('allows authenticated users to update profile and password', async () => {
    const session = await authenticateAsUser();
    const userBefore = await User.findById(session.user.id);

    const profileResponse = await request(app)
      .patch('/api/auth/me/profile')
      .set(authHeader(session.tokens.accessToken))
      .send({ displayName: 'Tester' });

    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.user.profile.displayName).toBe('Tester');

    const passwordResponse = await request(app)
      .patch('/api/auth/me/password')
      .set(authHeader(session.tokens.accessToken))
      .send({
        currentPassword: 'StrongPass123!',
        newPassword: 'NewStrongPass123!',
        confirmNewPassword: 'NewStrongPass123!'
      });

    expect(passwordResponse.status).toBe(204);
    const userAfter = await User.findById(session.user.id);
    expect(userAfter.passwordChangedAt.getTime()).toBeGreaterThan(
      userBefore.passwordChangedAt.getTime()
    );

    const loginResponse = await request(app).post('/api/auth/login').send({
      usernameOrEmail: session.user.username,
      password: 'NewStrongPass123!'
    });

    expect(loginResponse.status).toBe(200);
  });

  it('rejects password changes that violate policy', async () => {
    const username = 'policyuser';
    const email = 'policy@example.com';
    await createUser({ username, email, password: 'StrongPolicy123!' });
    const session = await loginUser({ usernameOrEmail: username, password: 'StrongPolicy123!' });

    const response = await request(app)
      .patch('/api/auth/me/password')
      .set(authHeader(session.tokens.accessToken))
      .send({
        currentPassword: 'StrongPolicy123!',
        newPassword: 'Policyuser123!',
        confirmNewPassword: 'Policyuser123!'
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('WEAK_PASSWORD');
    expect(response.body.message).toBe('Password must not contain your username or email handle');
  });
});
