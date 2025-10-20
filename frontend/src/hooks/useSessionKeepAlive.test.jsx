import { render, waitFor } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthFetch = vi.fn();
const mockTokens = { accessToken: 'token-123' };

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    tokens: mockTokens,
    authFetch: mockAuthFetch
  })
}));

import { useSessionKeepAlive } from './useSessionKeepAlive.js';

function HookHarness({ onShowWarning, onHideWarning, onExpire, options, apiRef }) {
  const api = useSessionKeepAlive({
    onShowWarning,
    onHideWarning,
    onExpire,
    ...options
  });

  useEffect(() => {
    if (apiRef) {
      apiRef.current = api;
    }
  }, [api, apiRef]);

  return null;
}

describe('useSessionKeepAlive', () => {
  beforeEach(() => {
    mockAuthFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires warning callbacks when remaining time enters warning window', async () => {
    vi.useFakeTimers();
    const baseTime = new Date('2024-01-01T00:00:00Z');
    vi.setSystemTime(baseTime);

    const initialExpiry = baseTime.getTime() + 60_000;
    mockAuthFetch.mockImplementation(async (path) => {
      if (path === '/api/session/state') {
        return { serverNow: baseTime.getTime(), inactivityExpiresAt: initialExpiry };
      }
      if (path === '/api/session/extend') {
        return { inactivityExpiresAt: initialExpiry + 30_000 };
      }
      return null;
    });

    const onShowWarning = vi.fn();
    const onHideWarning = vi.fn();
    const onExpire = vi.fn();
    const apiRef = { current: null };

    const { unmount } = render(
      <HookHarness
        apiRef={apiRef}
        onShowWarning={onShowWarning}
        onHideWarning={onHideWarning}
        onExpire={onExpire}
        options={{
          warningLeadMs: 30_000,
          minTouchIntervalMs: 1_000,
          statePollIntervalMs: 120_000
        }}
      />
    );

    expect(mockAuthFetch).toHaveBeenCalledWith('/api/session/state');

    await vi.advanceTimersByTimeAsync(31_000);

    expect(onShowWarning).toHaveBeenCalled();
    const lastCall = onShowWarning.mock.calls.at(-1)[0];
    expect(lastCall).toBeLessThanOrEqual(30_000);
    expect(lastCall).toBeGreaterThan(0);
    expect(onHideWarning).not.toHaveBeenCalled();
    expect(onExpire).not.toHaveBeenCalled();
    unmount();
  });

  it('extends the session and hides warnings on demand', async () => {
    vi.useFakeTimers();
    const baseTime = new Date('2024-01-01T01:00:00Z');
    vi.setSystemTime(baseTime);

    let currentExpiry = baseTime.getTime() + 40_000;
    mockAuthFetch.mockImplementation(async (path) => {
      if (path === '/api/session/state') {
        return { serverNow: baseTime.getTime(), inactivityExpiresAt: currentExpiry };
      }
      if (path === '/api/session/extend') {
        currentExpiry += 60_000;
        return { inactivityExpiresAt: currentExpiry };
      }
      return null;
    });

    const onShowWarning = vi.fn();
    const onHideWarning = vi.fn();
    const onExpire = vi.fn();
    const apiRef = { current: null };

    const { unmount } = render(
      <HookHarness
        apiRef={apiRef}
        onShowWarning={onShowWarning}
        onHideWarning={onHideWarning}
        onExpire={onExpire}
        options={{
          warningLeadMs: 30_000,
          minTouchIntervalMs: 1_000,
          statePollIntervalMs: 120_000
        }}
      />
    );

    expect(mockAuthFetch).toHaveBeenCalledWith('/api/session/state');

    await vi.advanceTimersByTimeAsync(15_000);
    expect(onShowWarning).toHaveBeenCalled();

    await apiRef.current.extendSession();
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/session/extend', { method: 'POST' });
    expect(onHideWarning).toHaveBeenCalled();
    unmount();
  });

  it('invokes onExpire when API returns 401', async () => {
    vi.useFakeTimers();
    const baseTime = new Date('2024-01-01T02:00:00Z');
    vi.setSystemTime(baseTime);

    mockAuthFetch.mockImplementation(async (path) => {
      if (path === '/api/session/state') {
        return { serverNow: baseTime.getTime(), inactivityExpiresAt: baseTime.getTime() + 45_000 };
      }
      if (path === '/api/session/extend') {
        const error = new Error('Unauthorized');
        error.status = 401;
        throw error;
      }
      return null;
    });

    const onShowWarning = vi.fn();
    const onHideWarning = vi.fn();
    const onExpire = vi.fn();
    const apiRef = { current: null };

    const { unmount } = render(
      <HookHarness
        apiRef={apiRef}
        onShowWarning={onShowWarning}
        onHideWarning={onHideWarning}
        onExpire={onExpire}
        options={{
          warningLeadMs: 30_000,
          minTouchIntervalMs: 1_000,
          statePollIntervalMs: 120_000
        }}
      />
    );

    expect(mockAuthFetch).toHaveBeenCalledWith('/api/session/state');

    await expect(apiRef.current.extendSession()).rejects.toThrow('Unauthorized');
    expect(onExpire).toHaveBeenCalled();
    unmount();
  });
});
