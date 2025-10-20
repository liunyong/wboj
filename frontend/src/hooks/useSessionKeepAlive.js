import { useCallback, useEffect, useRef } from 'react';

import { useAuth } from '../context/AuthContext.jsx';

const DEFAULT_WARNING_LEAD_MS = 15 * 60 * 1000;
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
  const broadcastImplRef = useRef(() => {});

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
    expiredRef.current = true;
    resetState();
    if (warningVisibleRef.current && onHideWarning) {
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
      if (!inactivityExpiresAt || typeof inactivityExpiresAt !== 'number') {
        return;
      }
      const localExpiry = inactivityExpiresAt + skewRef.current;
      expiresAtRef.current = localExpiry;
      expiredRef.current = false;
      lastExtendRef.current = Date.now();

      if (warningVisibleRef.current && onHideWarning) {
        warningVisibleRef.current = false;
        onHideWarning();
      }

      if (broadcast) {
        broadcastMessage({ type: 'SESSION_EXTENDED', inactivityExpiresAt });
      }

      updateTimers();
    },
    [broadcastMessage, onHideWarning, updateTimers]
  );

  const fetchSessionState = useCallback(async () => {
    if (!tokens.accessToken) {
      return;
    }
    try {
      const response = await authFetch('/api/session/state');
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
        case 'USER_ACTIVITY':
          lastExtendRef.current = Date.now();
          break;
        case 'SESSION_EXTENDED':
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
      broadcastMessage({ type: 'USER_ACTIVITY' });
      attemptExtend().catch(() => {
        // errors handled in attemptExtend -> extendSessionRequest
      });
    };

    const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    events.forEach((eventName) => window.addEventListener(eventName, handleActivity, { passive: true }));

    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        handleActivity();
      }
    };

    if (hasDocument) {
      document.addEventListener('visibilitychange', visibilityHandler);
    }

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, handleActivity));
      if (hasDocument) {
        document.removeEventListener('visibilitychange', visibilityHandler);
      }
    };
  }, [attemptExtend, broadcastMessage, tokens.accessToken]);

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
    }, statePollIntervalMs);

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
  }, [fetchSessionState, onHideWarning, resetState, statePollIntervalMs, tokens.accessToken, updateTimers]);

  return {
    extendSession,
    notifySessionExpired
  };
}
