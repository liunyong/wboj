import EventEmitter from 'node:events';

const emitter = new EventEmitter();
const recentEvents = [];
const MAX_EVENTS = 500;
let eventSequence = 0;

const generateEventId = (payload) => {
  eventSequence = (eventSequence + 1) % Number.MAX_SAFE_INTEGER;
  const base = payload?._id ?? payload?.id ?? 'submission';
  return `${base}:${Date.now()}:${eventSequence.toString(36)}`;
};

const pruneOldEvents = () => {
  while (recentEvents.length > MAX_EVENTS) {
    recentEvents.shift();
  }
};

export const publishSubmissionEvent = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return;
  }
  const enriched = {
    ...payload,
    eventId: payload.eventId ?? generateEventId(payload),
    emittedAt: new Date().toISOString()
  };
  recentEvents.push(enriched);
  pruneOldEvents();
  emitter.emit('submission', enriched);
};

export const subscribeSubmissionStream = (listener) => {
  emitter.on('submission', listener);
  return () => {
    emitter.off('submission', listener);
  };
};

export const getSubmissionUpdatesSince = (isoDate) => {
  if (!isoDate) {
    return [...recentEvents];
  }
  const since = Date.parse(isoDate);
  if (Number.isNaN(since)) {
    return [...recentEvents];
  }
  return recentEvents.filter((event) => Date.parse(event.emittedAt) > since);
};

// Test helper to clear accumulated events between unit tests.
export const __resetSubmissionStream = () => {
  recentEvents.length = 0;
  eventSequence = 0;
  emitter.removeAllListeners('submission');
};
