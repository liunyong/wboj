import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import app from '../src/app.js';
import User from '../src/models/User.js';
import { SESSION_INACTIVITY_TTL_MS } from '../src/services/authService.js';
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
  await User.deleteMany({});
});

describe('Session routes', () => {
  it('returns current session state with server time', async () => {
    const session = await authenticateAsUser();

    const response = await request(app)
      .get('/api/session/state')
      .set(authHeader(session.tokens.accessToken));

    expect(response.status).toBe(200);
    expect(typeof response.body.serverNow).toBe('number');
    expect(typeof response.body.inactivityExpiresAt).toBe('number');
    expect(response.body.inactivityExpiresAt).toBeGreaterThan(response.body.serverNow);
  });

  it('extends the session inactivity window on demand', async () => {
    const session = await authenticateAsUser();

    const stateResponse = await request(app)
      .get('/api/session/state')
      .set(authHeader(session.tokens.accessToken));

    expect(stateResponse.status).toBe(200);
    const initialExpiry = stateResponse.body.inactivityExpiresAt;

    const extendResponse = await request(app)
      .post('/api/session/extend')
      .set(authHeader(session.tokens.accessToken));

    expect(extendResponse.status).toBe(200);
    expect(extendResponse.body.inactivityExpiresAt).toBeGreaterThan(initialExpiry);
  });

  it('rejects requests once the inactivity timeout has passed', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2024-03-01T00:00:00Z'));
      const session = await authenticateAsUser();

      vi.advanceTimersByTime(SESSION_INACTIVITY_TTL_MS + 2000);

      const response = await request(app)
        .get('/api/session/state')
        .set(authHeader(session.tokens.accessToken));

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('SESSION_EXPIRED');
    } finally {
      vi.useRealTimers();
    }
  });
});
