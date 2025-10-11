import EventEmitter from 'node:events';

const emitter = new EventEmitter();
const recentEvents = [];
const MAX_EVENTS = 500;

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
    eventId: payload.eventId ?? `${payload._id}:${Date.now()}`,
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
