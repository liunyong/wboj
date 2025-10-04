import request from 'supertest';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { clearLanguageCacheSpy, fetchJudge0LanguagesSpy } = vi.hoisted(() => ({
  clearLanguageCacheSpy: vi.fn(),
  fetchJudge0LanguagesSpy: vi.fn(async () => [{ id: 71, name: 'Python 3' }])
}));

vi.mock('../src/services/judge0Service.js', () => ({
  clearLanguageCache: clearLanguageCacheSpy,
  fetchJudge0Languages: fetchJudge0LanguagesSpy,
  runJudge0Submission: vi.fn()
}));

import app from '../src/app.js';

beforeEach(() => {
  clearLanguageCacheSpy.mockClear();
  fetchJudge0LanguagesSpy.mockClear();
});

describe('Language routes', () => {
  it('returns languages list', async () => {
    const response = await request(app).get('/api/languages');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 71, name: 'Python 3' }]);
    expect(fetchJudge0LanguagesSpy).toHaveBeenCalledTimes(1);
  });

  it('respects forceRefresh flag', async () => {
    const response = await request(app).get('/api/languages?forceRefresh=true');

    expect(response.status).toBe(200);
    expect(clearLanguageCacheSpy).toHaveBeenCalledTimes(1);
    expect(fetchJudge0LanguagesSpy).toHaveBeenCalledTimes(1);
  });

  it('validates query parameters', async () => {
    const response = await request(app).get('/api/languages?forceRefresh=notabool');

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation failed');
  });
});
