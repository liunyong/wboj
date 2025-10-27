import fs from 'fs/promises';
import path from 'path';

import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import sharp from 'sharp';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import app from '../src/app.js';
import { authenticateAsAdmin, authHeader } from './utils.js';

let mongoServer;

const createImageBuffer = async (format) =>
  sharp({
    create: {
      width: 16,
      height: 16,
      channels: 3,
      background: { r: 120, g: 45, b: 200 }
    }
  })
    .toFormat(format)
    .toBuffer();

const uploadsRoot = path.resolve('uploads');

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: { ip: '127.0.0.1', bindIp: '127.0.0.1', port: 0 }
  });
  await mongoose.connect(mongoServer.getUri());
});

afterEach(async () => {
  await fs.rm(uploadsRoot, { recursive: true, force: true });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('Uploads routes', () => {
  it('accepts supported image formats and stores them on disk', async () => {
    const { tokens } = await authenticateAsAdmin();
    const formats = ['png', 'jpeg', 'webp', 'avif'];

    for (const format of formats) {
      const buffer = await createImageBuffer(format);
      const response = await request(app)
        .post('/api/uploads/images')
        .set(authHeader(tokens.accessToken))
        .attach('file', buffer, `sample.${format === 'jpeg' ? 'jpg' : format}`);

      expect(response.status).toBe(201);
      expect(typeof response.body.url).toBe('string');
      expect(response.body.url.startsWith('http://')).toBe(true);
      expect(typeof response.body.path).toBe('string');
      expect(response.body.path.startsWith('/uploads/problems/')).toBe(true);
      expect(response.body.apiPath.startsWith('/api/uploads/problems/')).toBe(true);

      const relativePath = response.body.path.replace(/^\/uploads\//, '');
      const absolutePath = path.join(uploadsRoot, relativePath);
      const stats = await fs.stat(absolutePath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(0);
    }
  });

  it('rejects unsupported images', async () => {
    const { tokens } = await authenticateAsAdmin();
    const gifBuffer = Buffer.from('47494638396101000100800000ffffff00000021f90401000001002c00000000010001000002024401003b', 'hex');
    const svgBuffer = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="#000"/></svg>',
      'utf8'
    );

    const gifResponse = await request(app)
      .post('/api/uploads/images')
      .set(authHeader(tokens.accessToken))
      .attach('file', gifBuffer, 'sample.gif');

    expect(gifResponse.status).toBe(415);

    const svgResponse = await request(app)
      .post('/api/uploads/images')
      .set(authHeader(tokens.accessToken))
      .attach('file', svgBuffer, 'sample.svg');

    expect(svgResponse.status).toBe(415);
  });

  it('requires authentication', async () => {
    const pngBuffer = await createImageBuffer('png');
    const response = await request(app)
      .post('/api/uploads/images')
      .attach('file', pngBuffer, 'sample.png');

    expect(response.status).toBe(401);
  });

  it('lists uploaded images with metadata for admins', async () => {
    const { tokens } = await authenticateAsAdmin();
    const fileName = 'example.png';
    const dirPath = path.join(uploadsRoot, 'problems');
    await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(path.join(dirPath, fileName), await createImageBuffer('png'));

    const response = await request(app)
      .get('/api/uploads/images')
      .set(authHeader(tokens.accessToken));

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.items)).toBe(true);
    const item = response.body.items.find((image) => image.name === fileName);
    expect(item).toBeDefined();
    expect(item.url).toContain('/uploads/problems/');
    expect(item.apiPath).toBe(`/api/uploads/problems/${fileName}`);
    expect(typeof item.size).toBe('number');
  });

  it('allows admins to delete uploaded images', async () => {
    const { tokens } = await authenticateAsAdmin();
    const dirPath = path.join(uploadsRoot, 'problems');
    await fs.mkdir(dirPath, { recursive: true });
    const filePath = path.join(dirPath, 'delete-me.png');
    await fs.writeFile(filePath, await createImageBuffer('png'));

    const response = await request(app)
      .delete('/api/uploads/images/delete-me.png')
      .set(authHeader(tokens.accessToken));

    expect(response.status).toBe(204);
    await expect(fs.stat(filePath)).rejects.toHaveProperty('code', 'ENOENT');
  });
});
