import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import User from '../src/models/User.js';
import {
  SESSION_INACTIVITY_TTL_MS,
  SESSION_MIN_TOUCH_INTERVAL_MS,
  createAuthTokens,
  decodeAccessToken,
  getSessionMeta,
  touchSession
} from '../src/services/authService.js';
import { createUser } from './utils.js';

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

describe('Session service', () => {
  it('touchSession respects rate limits but updates when forced or interval passes', async () => {
    vi.useFakeTimers();
    try {
      const start = new Date('2024-01-01T00:00:00Z');
      vi.setSystemTime(start);

      const user = await createUser({
        username: 'session-user',
        email: 'session@example.com',
        password: 'Password123!'
      });

      const tokens = await createAuthTokens(user);
      const payload = decodeAccessToken(tokens.accessToken);

      const initialMeta = await getSessionMeta(user._id, payload.sid);
      expect(initialMeta?.inactivityExpiresAt).toBeGreaterThan(start.getTime());

      const firstTouch = await touchSession(user._id, payload.sid);
      expect(firstTouch?.touched).toBe(false);
      expect(firstTouch?.inactivityExpiresAt).toBe(initialMeta?.inactivityExpiresAt);

      vi.advanceTimersByTime(SESSION_MIN_TOUCH_INTERVAL_MS + 1000);

      const secondTouch = await touchSession(user._id, payload.sid);
      expect(secondTouch?.touched).toBe(true);
      expect(secondTouch?.inactivityExpiresAt).toBeGreaterThan(firstTouch.inactivityExpiresAt);

      vi.advanceTimersByTime(10);

      const forcedTouch = await touchSession(user._id, payload.sid, { force: true });
      expect(forcedTouch?.touched).toBe(true);
      expect(forcedTouch.inactivityExpiresAt).toBeGreaterThan(secondTouch.inactivityExpiresAt);
    } finally {
      vi.useRealTimers();
    }
  });

  it('prunes expired sessions and getSessionMeta returns null once inactivity window lapses', async () => {
    vi.useFakeTimers();
    try {
      const start = new Date('2024-02-01T00:00:00Z');
      vi.setSystemTime(start);

      const user = await createUser({
        username: 'expiry-user',
        email: 'expiry@example.com',
        password: 'Password123!'
      });

      const tokens = await createAuthTokens(user);
      const payload = decodeAccessToken(tokens.accessToken);

      const meta = await getSessionMeta(user._id, payload.sid);
      expect(meta).not.toBeNull();

      vi.advanceTimersByTime(SESSION_INACTIVITY_TTL_MS + 2000);

      const expiredMeta = await getSessionMeta(user._id, payload.sid);
      expect(expiredMeta).toBeNull();

      const touchAfterExpiry = await touchSession(user._id, payload.sid);
      expect(touchAfterExpiry).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
