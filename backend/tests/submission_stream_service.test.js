import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetSubmissionStream,
  getSubmissionUpdatesSince,
  publishSubmissionEvent,
  subscribeSubmissionStream
} from '../src/services/submissionStreamService.js';

describe('submissionStreamService', () => {
  beforeEach(() => {
    __resetSubmissionStream();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    __resetSubmissionStream();
  });

  it('emits distinct event ids for rapid successive updates', () => {
    const received = [];
    const unsubscribe = subscribeSubmissionStream((event) => {
      received.push(event);
    });

    publishSubmissionEvent({ _id: 'sub-id', status: 'running' });
    publishSubmissionEvent({ _id: 'sub-id', status: 'accepted' });

    unsubscribe();

    expect(received).toHaveLength(2);
    expect(received[0].eventId).toBeDefined();
    expect(received[1].eventId).toBeDefined();
    expect(received[0].eventId).not.toBe(received[1].eventId);
    expect(received[0].status).toBe('running');
    expect(received[1].status).toBe('accepted');

    const updates = getSubmissionUpdatesSince();
    expect(updates).toHaveLength(2);
    expect(updates[0].eventId).not.toBe(updates[1].eventId);
  });
});
