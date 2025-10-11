import { useEffect, useRef } from 'react';

import { useAuth } from '../context/AuthContext.jsx';

const API_URL = import.meta.env.VITE_API_URL || '';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizePath = (path) => {
  if (!path) {
    return '';
  }
  return path.startsWith('/') ? path : `/${path}`;
};

export function useSubmissionStream({
  enabled,
  onEvent,
  pollInterval = 8000,
  streamPath = '/api/submissions/stream',
  updatesPath = '/api/submissions/updates'
} = {}) {
  const { tokens, refreshTokens, authFetch } = useAuth();
  const onEventRef = useRef(onEvent);
  const lastSinceRef = useRef(null);
  const seenIdsRef = useRef(new Set());
  const seenOrderRef = useRef([]);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const handleEvent = (payload) => {
    if (!payload) {
      return;
    }
    const eventId =
      payload.eventId ??
      (payload._id ? `${payload._id}:${payload.emittedAt ?? ''}` : undefined);

    if (eventId) {
      if (seenIdsRef.current.has(eventId)) {
        return;
      }
      seenIdsRef.current.add(eventId);
      seenOrderRef.current.push(eventId);
      if (seenOrderRef.current.length > 500) {
        const oldest = seenOrderRef.current.shift();
        if (oldest) {
          seenIdsRef.current.delete(oldest);
        }
      }
    }

    if (payload.emittedAt) {
      if (!lastSinceRef.current || payload.emittedAt > lastSinceRef.current) {
        lastSinceRef.current = payload.emittedAt;
      }
    }

    if (onEventRef.current) {
      onEventRef.current(payload);
    }
  };

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let cancelled = false;
    const controller = new AbortController();

    const connect = async () => {
      const targetStreamPath = normalizePath(streamPath);
      const streamUrl = `${API_URL}${targetStreamPath}`;
      while (!cancelled) {
        try {
          let accessToken = tokens.accessToken;
          if (!accessToken) {
            accessToken = await refreshTokens();
            if (!accessToken) {
              break;
            }
          }

          const response = await fetch(streamUrl, {
            headers: {
              Authorization: `Bearer ${accessToken}`
            },
            signal: controller.signal
          });

          if (response.status === 401) {
            accessToken = await refreshTokens();
            if (!accessToken) {
              break;
            }
            continue;
          }

          if (!response.ok || !response.body) {
            throw new Error(`SSE connection failed with status ${response.status}`);
          }

          const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
          let buffer = '';

          while (!cancelled) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            buffer += value;

            let boundary = buffer.indexOf('\n\n');
            while (boundary !== -1) {
              const chunk = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + 2);
              boundary = buffer.indexOf('\n\n');

              if (!chunk.trim()) {
                continue;
              }

              const lines = chunk.split('\n');
              let eventType = 'message';
              const dataLines = [];

              lines.forEach((line) => {
                if (line.startsWith('event:')) {
                  eventType = line.slice(6).trim();
                } else if (line.startsWith('data:')) {
                  dataLines.push(line.slice(5).trim());
                }
              });

              if (!dataLines.length) {
                continue;
              }

              const payloadText = dataLines.join('\n');
              if (eventType === 'heartbeat') {
                continue;
              }

              try {
                const payload = JSON.parse(payloadText);
                payload._eventType = eventType;
                handleEvent(payload);
              } catch (error) {
                // eslint-disable-next-line no-console
                console.warn('Failed to parse SSE payload', error);
              }
            }
          }
        } catch (error) {
          if (controller.signal.aborted || cancelled) {
            return;
          }
          await delay(3000);
        }
      }
    };

    connect();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, refreshTokens, streamPath, tokens.accessToken]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let cancelled = false;

    const interval = setInterval(async () => {
      if (cancelled) {
        return;
      }
      try {
        const params = new URLSearchParams();
        if (lastSinceRef.current) {
          params.set('since', lastSinceRef.current);
        }
        const targetUpdatesPath = `${normalizePath(updatesPath)}?${params.toString()}`;
        const response = await authFetch(targetUpdatesPath, {}, { retry: false });
        const items = response?.items ?? [];
        items.forEach((item) => handleEvent(item));
      } catch (error) {
        // ignore polling errors
      }
    }, pollInterval);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled, authFetch, pollInterval, updatesPath]);
}
