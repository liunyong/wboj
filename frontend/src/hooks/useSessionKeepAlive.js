import { useCallback, useEffect, useRef } from 'react';

import { useAuth } from '../context/AuthContext.jsx';

const DEFAULT_WARNING_LEAD_MS = 5 * 60 * 1000;
const DEFAULT_MIN_TOUCH_INTERVAL_MS = 60 * 1000;
const DEFAULT_STATE_POLL_MS = 60 * 1000;
const TIMER_INTERVAL_MS = 1000;
const CHANNEL_NAME = 'session-life';
const STORAGE_KEY = 'session-life-sync';

const hasWindow = typeof window !== 'undefined';
const hasDocument = typeof document !== 'undefined';

const createClientId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `session-${Math.random().toString(36).slice(2, 10)}`;
};

export function useSessionKeepAlive({
  onShowWarning,
  onHideWarning,
  onExpire,
  warningLeadMs = DEFAULT_WARNING_LEAD_MS,
  minTouchIntervalMs = DEFAULT_MIN_TOUCH_INTERVAL_MS,
  statePollIntervalMs = DEFAULT_STATE_POLL_MS
} = {}) {
  const { tokens, authFetch } = useAuth();

  const clientIdRef = useRef(createClientId());
  const expiresAtRef = useRef(null);
  const skewRef = useRef(0);
  const warningVisibleRef = useRef(false);
  const expiredRef = useRef(false);
  const lastExtendRef = useRef(0);
  const pendingExtendRef = useRef(null);
  const pendingStateRef = useRef(null);
  const lastStateFetchRef = useRef(0);
  const broadcastImplRef = useRef(() => {});
  const safeStatePollIntervalMs = Number.isFinite(Number(statePollIntervalMs))
    ? Math.max(Number(statePollIntervalMs), 5000)
    : DEFAULT_STATE_POLL_MS;

  const resetState = useCallback(() => {
    expiresAtRef.current = null;
    warningVisibleRef.current = false;
    expiredRef.current = false;
    lastExtendRef.current = 0;
  }, []);

  const broadcastMessage = useCallback((message) => {
    if (!hasWindow) {
      return;
    }
    const payload = {
      ...message,
      clientId: clientIdRef.current,
      timestamp: Date.now()
    };
    broadcastImplRef.current(payload);
  }, []);

  const handleExpire = useCallback(() => {
    if (expiredRef.current) {
      return;
    }
    const wasWarningVisible = warningVisibleRef.current;
    resetState();
    expiredRef.current = true;
    if (wasWarningVisible && onHideWarning) {
      onHideWarning();
    }
    broadcastMessage({ type: 'SESSION_EXPIRED' });
    if (onExpire) {
      onExpire();
    }
  }, [broadcastMessage, onExpire, onHideWarning, resetState]);

  const updateTimers = useCallback(() => {
    const expiresAt = expiresAtRef.current;
    if (!expiresAt) {
      if (warningVisibleRef.current && onHideWarning) {
        warningVisibleRef.current = false;
        onHideWarning();
      }
      return;
    }

    const remainingMs = expiresAt - Date.now();
    if (remainingMs <= 0) {
      handleExpire();
      return;
    }

    if (remainingMs <= warningLeadMs) {
      warningVisibleRef.current = true;
      if (onShowWarning) {
        onShowWarning(Math.max(0, remainingMs));
      }
    } else if (warningVisibleRef.current) {
      warningVisibleRef.current = false;
      if (onHideWarning) {
        onHideWarning();
      }
    }
  }, [handleExpire, onHideWarning, onShowWarning, warningLeadMs]);

  const applyNewExpiry = useCallback(
    (inactivityExpiresAt, { broadcast = false } = {}) => {
      if (!Number.isFinite(inactivityExpiresAt) || expiredRef.current) {
        return;
      }
      const localExpiry = inactivityExpiresAt + skewRef.current;
      // A state request started before an extension can finish after it.
      if (expiresAtRef.current !== null && localExpiry < expiresAtRef.current) {
        return;
      }
      expiresAtRef.current = localExpiry;
      // Reading the deadline is not a renewal and must not reset the throttle.

      if (broadcast) {
        broadcastMessage({ type: 'SESSION_EXTENDED', inactivityExpiresAt });
      }

      updateTimers();
    },
    [broadcastMessage, updateTimers]
  );

  const fetchSessionState = useCallback(async () => {
    if (!tokens.accessToken) {
      return;
    }
    const now = Date.now();
    if (pendingStateRef.current) {
      return pendingStateRef.current;
    }
    if (now - lastStateFetchRef.current < 5000) {
      return null;
    }
    lastStateFetchRef.current = now;
    try {
      pendingStateRef.current = authFetch('/api/session/state');
      const response = await pendingStateRef.current;
      if (!response) {
        return;
      }
      if (typeof response.serverNow === 'number') {
        skewRef.current = Date.now() - response.serverNow;
      }
      if (typeof response.inactivityExpiresAt === 'number') {
        applyNewExpiry(response.inactivityExpiresAt, { broadcast: false });
      }
    } catch (error) {
      if (error?.status === 401) {
        handleExpire();
      }
    } finally {
      pendingStateRef.current = null;
    }
  }, [applyNewExpiry, authFetch, handleExpire, tokens.accessToken]);

  const extendSessionRequest = useCallback(async () => {
    if (!tokens.accessToken) {
      return null;
    }
    if (!pendingExtendRef.current) {
      pendingExtendRef.current = (async () => {
        try {
          const response = await authFetch('/api/session/extend', { method: 'POST' });
          if (response?.inactivityExpiresAt) {
            applyNewExpiry(response.inactivityExpiresAt, { broadcast: true });
            return response.inactivityExpiresAt;
          }
          return null;
        } catch (error) {
          if (error?.status === 401) {
            handleExpire();
          }
          throw error;
        } finally {
          pendingExtendRef.current = null;
        }
      })();
    }
    return pendingExtendRef.current;
  }, [applyNewExpiry, authFetch, handleExpire, tokens.accessToken]);

  const attemptExtend = useCallback(
    async ({ bypassThrottle = false } = {}) => {
      if (!tokens.accessToken) {
        return null;
      }
      const now = Date.now();
      if (!bypassThrottle && now - lastExtendRef.current < minTouchIntervalMs) {
        return null;
      }
      const previous = lastExtendRef.current;
      lastExtendRef.current = now;
      try {
        return await extendSessionRequest();
      } catch (error) {
        lastExtendRef.current = previous;
        throw error;
      }
    },
    [extendSessionRequest, minTouchIntervalMs, tokens.accessToken]
  );

  const extendSession = useCallback(
    async () => attemptExtend({ bypassThrottle: true }),
    [attemptExtend]
  );

  const notifySessionExpired = useCallback(() => {
    broadcastMessage({ type: 'SESSION_EXPIRED' });
  }, [broadcastMessage]);

  useEffect(() => {
    if (!hasWindow) {
      return undefined;
    }

    const handleInbound = (payload) => {
      if (!payload || payload.clientId === clientIdRef.current) {
        return;
      }

      switch (payload.type) {
        case 'SESSION_EXTENDED':
          // Only a confirmed, newer renewal in another tab suppresses a touch.
          if (Number.isFinite(payload.inactivityExpiresAt) &&
              payload.inactivityExpiresAt + skewRef.current > (expiresAtRef.current ?? 0)) {
            lastExtendRef.current = Date.now();
          }
          applyNewExpiry(payload.inactivityExpiresAt, { broadcast: false });
          break;
        case 'SESSION_EXPIRED':
          handleExpire();
          break;
        default:
          break;
      }
    };

    if (typeof window.BroadcastChannel === 'function') {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        handleInbound(event?.data);
      };
      broadcastImplRef.current = (payload) => channel.postMessage(payload);
      return () => {
        broadcastImplRef.current = () => {};
        channel.close();
      };
    }

    const storageHandler = (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) {
        return;
      }
      try {
        const payload = JSON.parse(event.newValue);
        handleInbound(payload);
      } catch (error) {
        // ignore malformed storage payloads
      }
    };

    window.addEventListener('storage', storageHandler);
    broadcastImplRef.current = (payload) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        // ignore storage write failures (private mode, etc.)
      }
    };

    return () => {
      broadcastImplRef.current = () => {};
      window.removeEventListener('storage', storageHandler);
    };
  }, [applyNewExpiry, handleExpire]);

  useEffect(() => {
    if (!hasWindow || !tokens.accessToken) {
      return undefined;
    }

    const handleActivity = () => {
      if (warningVisibleRef.current || expiredRef.current) return;
      attemptExtend().catch(() => {
        // errors handled in attemptExtend -> extendSessionRequest
      });
    };

    const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    // Capture includes non-bubbling scrolls in editors, tables, and the sidebar.
    events.forEach((eventName) => window.addEventListener(eventName, handleActivity, { passive: true, capture: true }));

    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        handleActivity();
      }
    };

    if (hasDocument) {
      document.addEventListener('visibilitychange', visibilityHandler);
    }

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, handleActivity, { capture: true }));
      if (hasDocument) {
        document.removeEventListener('visibilitychange', visibilityHandler);
      }
    };
  }, [attemptExtend, tokens.accessToken]);

  useEffect(() => {
    if (!tokens.accessToken) {
      resetState();
      if (onHideWarning) {
        onHideWarning();
      }
      return undefined;
    }

    let cancelled = false;

    fetchSessionState();
    updateTimers();

    if (!hasWindow) {
      return () => {
        cancelled = true;
      };
    }

    const stateIntervalId = window.setInterval(() => {
      if (!cancelled) {
        fetchSessionState();
      }
    }, safeStatePollIntervalMs);

    const timerIntervalId = window.setInterval(() => {
      if (!cancelled) {
        updateTimers();
      }
    }, TIMER_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(stateIntervalId);
      window.clearInterval(timerIntervalId);
    };
  }, [fetchSessionState, onHideWarning, resetState, safeStatePollIntervalMs, tokens.accessToken, updateTimers]);

  return {
    extendSession,
    notifySessionExpired
  };
}
