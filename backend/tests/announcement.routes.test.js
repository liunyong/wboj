import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import app from '../src/app.js';
import Announcement from '../src/models/Announcement.js';
import { authenticateAsAdmin, authHeader } from './utils.js';

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
  await Announcement.deleteMany({});
});

describe('Announcements API', () => {
  it('returns public announcements pinned first', async () => {
    await Announcement.create([
      { title: 'Pinned', body: 'Pinned body', pinned: true },
      { title: 'Regular', body: 'Regular body', pinned: false }
    ]);

    const response = await request(app).get('/api/announcements?limit=5&pinnedFirst=true');

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.items[0].pinned).toBe(true);
    expect(response.body.items[0].title).toBe('Pinned');
  });

  it('allows admins to create, update, and delete announcements', async () => {
    const adminSession = await authenticateAsAdmin();

    const createResponse = await request(app)
      .post('/api/announcements')
      .set(authHeader(adminSession.tokens.accessToken))
      .send({ title: 'System Update', body: 'We shipped new features.', pinned: true });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.announcement.pinned).toBe(true);

    const announcementId = createResponse.body.announcement.id;

    const updateResponse = await request(app)
      .put(`/api/announcements/${announcementId}`)
      .set(authHeader(adminSession.tokens.accessToken))
      .send({ pinned: false });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.announcement.pinned).toBe(false);

    const deleteResponse = await request(app)
      .delete(`/api/announcements/${announcementId}`)
      .set(authHeader(adminSession.tokens.accessToken));

    expect(deleteResponse.status).toBe(204);
  });
});
