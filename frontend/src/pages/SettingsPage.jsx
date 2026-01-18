import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext.jsx';
import { useSessionPolicy } from '../hooks/useSessionPolicy.js';
import { formatRelativeOrDate, formatTooltip, getUserTZ } from '../utils/time.js';

function SettingsPage() {
  const { user, authFetch } = useAuth();
  const queryClient = useQueryClient();
  const [profileForm, setProfileForm] = useState({
    displayName: user?.profile?.displayName ?? '',
    bio: user?.profile?.bio ?? '',
    avatarUrl: user?.profile?.avatarUrl ?? ''
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  });
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [profilePublic, setProfilePublic] = useState(Boolean(user?.profilePublic));
  const [visibilityMessage, setVisibilityMessage] = useState('');
  const [isVisibilitySaving, setIsVisibilitySaving] = useState(false);
  const [sessionsMessage, setSessionsMessage] = useState('');
  const [sessionActionId, setSessionActionId] = useState(null);
  const userTimeZone = getUserTZ();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const sessionPolicyQuery = useSessionPolicy({ enabled: Boolean(user) });

  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'me'],
    queryFn: async () => {
      const response = await authFetch('/api/session/sessions');
      return response?.sessions ?? [];
    },
    enabled: Boolean(user),
    refetchInterval: 10000,
    refetchOnWindowFocus: true
  });

  useEffect(() => {
    setProfilePublic(Boolean(user?.profilePublic));
  }, [user?.profilePublic]);

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
    setPasswordError('');
    setPasswordMessage('');
  };

  const submitProfile = async (event) => {
    event.preventDefault();
    setProfileMessage('');
    setIsProfileSaving(true);
    try {
      const response = await authFetch('/api/auth/me/profile', {
        method: 'PATCH',
        body: profileForm
      });
      queryClient.setQueryData(['me'], response.user);
      setProfileMessage('Profile updated successfully.');
    } catch (error) {
      setProfileMessage(error.message || 'Failed to update profile.');
    } finally {
      setIsProfileSaving(false);
    }
  };

  const toggleProfileVisibility = async (event) => {
    const nextValue = event.target.checked;
    setProfilePublic(nextValue);
    setVisibilityMessage('');
    setIsVisibilitySaving(true);
    try {
      const response = await authFetch('/api/users/me/profile', {
        method: 'PUT',
        body: { profilePublic: nextValue }
      });
      queryClient.setQueryData(['me'], (prev) => ({
        ...(prev ?? {}),
        profilePublic: response?.profilePublic ?? nextValue
      }));
      setVisibilityMessage(
        response?.profilePublic
          ? 'Your profile is now public.'
          : 'Your profile is now private.'
      );
    } catch (error) {
      setVisibilityMessage(error.message || 'Failed to update profile visibility.');
      setProfilePublic((prev) => !prev);
    } finally {
      setIsVisibilitySaving(false);
    }
  };

  const submitPassword = async (event) => {
    event.preventDefault();
    setPasswordMessage('');
    setPasswordError('');
    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setPasswordError('New passwords must match.');
      return;
    }
    setIsPasswordSaving(true);
    try {
      await authFetch('/api/auth/me/password', {
        method: 'PATCH',
        body: passwordForm
      });
      setPasswordMessage('Password updated. Please log in again on other devices.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    } catch (error) {
      setPasswordError(error.message || 'Failed to update password.');
    } finally {
      setIsPasswordSaving(false);
    }
  };

  const refreshSessions = async () => {
    await queryClient.invalidateQueries({ queryKey: ['sessions', 'me'] });
  };

  const handleRevokeSession = async (sessionId) => {
    if (!sessionId) {
      return;
    }
    setSessionsMessage('');
    setSessionActionId(sessionId);
    try {
      await authFetch(`/api/session/sessions/${sessionId}`, { method: 'DELETE' });
      setSessionsMessage('Session revoked.');
      await refreshSessions();
    } catch (error) {
      setSessionsMessage(error.message || 'Failed to revoke session.');
    } finally {
      setSessionActionId(null);
    }
  };

  const handleRevokeOthers = async () => {
    setSessionsMessage('');
    setSessionActionId('others');
    try {
      await authFetch('/api/session/sessions', { method: 'DELETE', body: { scope: 'others' } });
      setSessionsMessage('Logged out other sessions.');
      await refreshSessions();
    } catch (error) {
      setSessionsMessage(error.message || 'Failed to log out other sessions.');
    } finally {
      setSessionActionId(null);
    }
  };

  const sessions = Array.isArray(sessionsQuery.data) ? sessionsQuery.data : [];
  const sortedSessions = sessions
    .slice()
    .sort((a, b) => new Date(b.lastTouchedAt ?? 0) - new Date(a.lastTouchedAt ?? 0));

  const formatRemaining = useMemo(
    () => (targetMs) => {
      if (!targetMs) {
        return '—';
      }
      const remaining = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    },
    [nowMs]
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    let channel;
    const handleMessage = (event) => {
      const payload = event?.data ?? null;
      if (!payload || typeof payload.type !== 'string') {
        return;
      }
      if (payload.type === 'SESSION_EXTENDED' || payload.type === 'SESSION_EXPIRED') {
        refreshSessions();
      }
    };

    if (typeof window.BroadcastChannel === 'function') {
      channel = new BroadcastChannel('session-life');
      channel.onmessage = handleMessage;
      return () => channel.close();
    }

    const storageHandler = (event) => {
      if (event.key !== 'session-life-sync' || !event.newValue) {
        return;
      }
      try {
        const payload = JSON.parse(event.newValue);
        handleMessage({ data: payload });
      } catch (error) {
        // ignore malformed payload
      }
    };
    window.addEventListener('storage', storageHandler);
    return () => window.removeEventListener('storage', storageHandler);
  }, [refreshSessions]);

  return (
    <section className="page settings-page">
      <header className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Manage your profile and account security.</p>
        </div>
      </header>

      <div className="settings-stack">
        <form className="settings-card" onSubmit={submitProfile}>
          <h2>Profile</h2>
          <label>
            Display Name
            <input
              type="text"
              name="displayName"
              value={profileForm.displayName}
              onChange={handleProfileChange}
            />
          </label>
          <label>
            Bio
            <textarea
              name="bio"
              value={profileForm.bio}
              onChange={handleProfileChange}
              rows={4}
            />
          </label>
          <label>
            Avatar URL
            <input
              type="url"
              name="avatarUrl"
              value={profileForm.avatarUrl}
              onChange={handleProfileChange}
            />
          </label>
          <button type="submit" disabled={isProfileSaving}>
            {isProfileSaving ? 'Saving…' : 'Save changes'}
          </button>
          {profileMessage && <div className="form-message info">{profileMessage}</div>}
        </form>

        <form className="settings-card" onSubmit={submitPassword}>
          <h2>Password</h2>
          <label>
            Current Password
            <input
              type="password"
              name="currentPassword"
              value={passwordForm.currentPassword}
              onChange={handlePasswordChange}
              required
              autoComplete="current-password"
            />
          </label>
          <label>
            New Password
            <input
              type="password"
              name="newPassword"
              value={passwordForm.newPassword}
              onChange={handlePasswordChange}
              required
              autoComplete="new-password"
            />
          </label>
          <label>
            Confirm New Password
            <input
              type="password"
              name="confirmNewPassword"
              value={passwordForm.confirmNewPassword}
              onChange={handlePasswordChange}
              required
              autoComplete="new-password"
            />
          </label>
          {passwordForm.newPassword &&
            passwordForm.confirmNewPassword &&
            passwordForm.newPassword !== passwordForm.confirmNewPassword && (
              <div className="form-message error">New passwords do not match.</div>
            )}
          <button type="submit" disabled={isPasswordSaving}>
            {isPasswordSaving ? 'Updating…' : 'Update password'}
          </button>
          {passwordError && <div className="form-message error">{passwordError}</div>}
          {passwordMessage && <div className="form-message info">{passwordMessage}</div>}
        </form>

        <div className="settings-card">
          <h2>Privacy</h2>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={profilePublic}
              onChange={toggleProfileVisibility}
              disabled={isVisibilitySaving}
            />
            Make my profile public
          </label>
          <p className="muted">
            Public profiles can be viewed by anyone. Private profiles are visible only to you and
            administrators.
          </p>
          {visibilityMessage && <div className="form-message info">{visibilityMessage}</div>}
        </div>

        <div className="settings-card">
          <h2>Sessions</h2>
          <p className="muted">
            Manage active sessions across devices. Inactive sessions expire automatically.
          </p>
          {sessionPolicyQuery.data && (
            <p className="muted">
              Session timeout: {Math.round(sessionPolicyQuery.data.inactivityTtlMs / 60000)} min ·
              Warning at {Math.round(sessionPolicyQuery.data.warningLeadMs / 60000)} min
            </p>
          )}
          <button
            type="button"
            className="secondary"
            onClick={handleRevokeOthers}
            disabled={sessionActionId === 'others' || sessionsQuery.isLoading}
          >
            {sessionActionId === 'others' ? 'Logging out…' : 'Log out other devices'}
          </button>
          {sessionsMessage && <div className="form-message info">{sessionsMessage}</div>}
          {sessionsQuery.isLoading && <div className="page-message">Loading sessions…</div>}
          {sessionsQuery.isError && (
            <div className="page-message error">Failed to load sessions.</div>
          )}
          {!sessionsQuery.isLoading && !sessionsQuery.isError && (
            <ul className="settings-sessions">
              {sortedSessions.length ? (
                sortedSessions.map((session) => {
                  const lastTouched = session.lastTouchedAt ?? session.createdAt;
                  const lastSeenLabel = formatRelativeOrDate(lastTouched, Date.now(), userTimeZone);
                  const lastSeenTooltip = formatTooltip(lastTouched, userTimeZone);
                  const expiresAtMs = session.inactivityExpiresAt
                    ? new Date(session.inactivityExpiresAt).getTime()
                    : null;
                  const expiresLabel = expiresAtMs ? formatRemaining(expiresAtMs) : '—';
                  const expiresTooltip = session.inactivityExpiresAt
                    ? formatTooltip(session.inactivityExpiresAt, userTimeZone)
                    : '—';
                  const deviceLabel = session.userAgent
                    ? session.userAgent.split(')')[0]?.slice(0, 80)
                    : 'Unknown device';
                  const isCurrent = Boolean(session.isCurrent);
                  return (
                    <li key={session.id} className="settings-session">
                      <div>
                        <div className="settings-session__device">
                          {deviceLabel}
                          {isCurrent ? <span className="badge">Current</span> : null}
                        </div>
                        <div className="settings-session__meta">
                          <span title={lastSeenTooltip}>Last active: {lastSeenLabel}</span>
                          <span title={expiresTooltip}>· Expires in: {expiresLabel}</span>
                          {session.ip ? <span>· IP: {session.ip}</span> : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => handleRevokeSession(session.id)}
                        disabled={isCurrent || sessionActionId === session.id}
                      >
                        {sessionActionId === session.id ? 'Logging out…' : 'Log out'}
                      </button>
                    </li>
                  );
                })
              ) : (
                <li className="muted">No active sessions.</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

export default SettingsPage;
