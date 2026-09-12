import { cleanup, fireEvent, render } from '@testing-library/react';
import { useEffect } from 'react';
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
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps an active session alive across polling intervals without showing a warning', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    let expiry = Date.now() + 180_000;
    mockAuthFetch.mockImplementation(async (path) => {
      if (path === '/api/session/extend') expiry = Date.now() + 180_000;
      return { serverNow: Date.now(), inactivityExpiresAt: expiry };
    });
    const onShowWarning = vi.fn();
    const onExpire = vi.fn();
    render(<HookHarness onShowWarning={onShowWarning} onExpire={onExpire} options={{ warningLeadMs: 30_000 }} />);
    for (let tick = 0; tick < 24; tick += 1) {
      await vi.advanceTimersByTimeAsync(10_000);
      fireEvent.keyDown(window, { key: 'a' });
      await vi.advanceTimersByTimeAsync(0);
    }
    const extensions = mockAuthFetch.mock.calls.filter(([path]) => path === '/api/session/extend');
    expect(extensions.length).toBeGreaterThanOrEqual(3);
    expect(extensions.length).toBeLessThanOrEqual(4);
    expect(onShowWarning).not.toHaveBeenCalled();
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('recognizes scrolling inside an editor or table even when the event does not bubble', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    mockAuthFetch.mockImplementation(async () => ({ serverNow: Date.now(), inactivityExpiresAt: Date.now() + 180_000 }));
    const { container } = render(<div><HookHarness options={{ warningLeadMs: 30_000 }} /><div data-testid="scroll-panel" /></div>);
    await vi.advanceTimersByTimeAsync(61_000);
    fireEvent.scroll(container.querySelector('[data-testid="scroll-panel"]'), { bubbles: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/session/extend', { method: 'POST' });
  });

  it('still warns and expires exactly once when only background polling continues', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const expiry = Date.now() + 180_000;
    mockAuthFetch.mockImplementation(async () => ({ serverNow: Date.now(), inactivityExpiresAt: expiry }));
    const onShowWarning = vi.fn();
    const onHideWarning = vi.fn();
    const onExpire = vi.fn();
    render(<HookHarness onShowWarning={onShowWarning} onHideWarning={onHideWarning} onExpire={onExpire} options={{ warningLeadMs: 30_000 }} />);
    await vi.advanceTimersByTimeAsync(151_000);
    expect(onShowWarning).toHaveBeenCalled();
    fireEvent.mouseMove(window);
    expect(mockAuthFetch).not.toHaveBeenCalledWith('/api/session/extend', { method: 'POST' });
    await vi.advanceTimersByTimeAsync(90_000);
    expect(onHideWarning).toHaveBeenCalledTimes(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('does not let unconfirmed activity from another tab suppress local renewal', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    let expiry = Date.now() + 180_000;
    mockAuthFetch.mockImplementation(async (path) => {
      if (path === '/api/session/extend') expiry = Date.now() + 180_000;
      return { serverNow: Date.now(), inactivityExpiresAt: expiry };
    });
    render(<HookHarness options={{ warningLeadMs: 30_000 }} />);
    await vi.advanceTimersByTimeAsync(61_000);
    fireEvent(window, new StorageEvent('storage', { key: 'session-life-sync', newValue: JSON.stringify({ clientId: 'another-tab', type: 'USER_ACTIVITY' }) }));
    fireEvent.click(window);
    await vi.advanceTimersByTimeAsync(0);
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/session/extend', { method: 'POST' });
  });

  it('uses a confirmed renewal from another tab and avoids a duplicate touch', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const expiry = Date.now() + 90_000;
    mockAuthFetch.mockImplementation(async () => ({ serverNow: Date.now(), inactivityExpiresAt: expiry }));
    const onShowWarning = vi.fn();
    const onHideWarning = vi.fn();
    render(<HookHarness onShowWarning={onShowWarning} onHideWarning={onHideWarning} options={{ warningLeadMs: 30_000 }} />);
    await vi.advanceTimersByTimeAsync(61_000);
    expect(onShowWarning).toHaveBeenCalled();
    fireEvent(window, new StorageEvent('storage', { key: 'session-life-sync', newValue: JSON.stringify({ clientId: 'another-tab', type: 'SESSION_EXTENDED', inactivityExpiresAt: Date.now() + 180_000 }) }));
    expect(onHideWarning).toHaveBeenCalledTimes(1);
    onShowWarning.mockClear();
    fireEvent.keyDown(window, { key: 'a' });
    await vi.advanceTimersByTimeAsync(0);
    expect(mockAuthFetch).not.toHaveBeenCalledWith('/api/session/extend', { method: 'POST' });
    expect(onShowWarning).not.toHaveBeenCalled();
  });

  it('ignores an old state response arriving after a successful renewal', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const originalExpiry = Date.now() + 100_000;
    let resolveState;
    let stateCount = 0;
    mockAuthFetch.mockImplementation(async (path) => {
      if (path === '/api/session/extend') return { inactivityExpiresAt: Date.now() + 180_000 };
      if (++stateCount === 1) return { serverNow: Date.now(), inactivityExpiresAt: originalExpiry };
      return new Promise(resolve => { resolveState = resolve; });
    });
    const onShowWarning = vi.fn();
    const onExpire = vi.fn();
    render(<HookHarness onShowWarning={onShowWarning} onExpire={onExpire} options={{ warningLeadMs: 30_000 }} />);
    await vi.advanceTimersByTimeAsync(61_000);
    fireEvent.click(window);
    await vi.advanceTimersByTimeAsync(0);
    resolveState({ serverNow: Date.now(), inactivityExpiresAt: originalExpiry });
    await vi.advanceTimersByTimeAsync(45_000);
    expect(onShowWarning).not.toHaveBeenCalled();
    expect(onExpire).not.toHaveBeenCalled();
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
