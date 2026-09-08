import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [avatarPreviewFailed, setAvatarPreviewFailed] = useState(false);
  const avatarInputRef = useRef(null);
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

  useEffect(() => {
    setAvatarPreviewFailed(false);
  }, [profileForm.avatarUrl]);

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

  // 파일 업로드 → 절대 URL로 변환 → avatarUrl 채움 (저장은 아래 Save 버튼)
  const handleAvatarFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      setAvatarError('이미지 파일만 업로드할 수 있습니다.');
      event.target.value = '';
      return;
    }
    setAvatarError('');
    setIsAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await authFetch('/api/uploads/images', { method: 'POST', body: formData });
      const rawUrl = response?.apiPath ?? response?.url ?? response?.path;
      if (!rawUrl) {
        throw new Error('업로드 실패');
      }
      // apiPath는 상대경로 — API 베이스에 붙여 절대 URL로
      const base = import.meta.env.VITE_API_URL || '';
      const absolute = /^https?:\/\//.test(rawUrl)
        ? rawUrl
        : base
          ? new URL(rawUrl, base).toString()
          : rawUrl;
      setProfileForm((prev) => ({ ...prev, avatarUrl: absolute }));
    } catch (error) {
      setAvatarError(error.message || '이미지 업로드에 실패했습니다.');
    } finally {
      setIsAvatarUploading(false);
      if (event.target) {
        event.target.value = '';
      }
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
            Profile Photo
            <div className="avatar-uploader">
              {profileForm.avatarUrl && !avatarPreviewFailed ? (
                <img
                  className="avatar-uploader__preview"
                  src={profileForm.avatarUrl}
                  alt="Avatar preview"
                  onError={() => setAvatarPreviewFailed(true)}
                />
              ) : (
                <div className="avatar-uploader__preview avatar-uploader__preview--empty">
                  {(profileForm.displayName || user?.username || '?').trim().charAt(0).toUpperCase()}
                </div>
              )}
              {profileForm.avatarUrl && avatarPreviewFailed && (
                <p className="form-message error">Could not load this image. Check the URL or upload a new photo.</p>
              )}
              <div className="avatar-uploader__actions">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleAvatarFile}
                />
                <button
                  type="button"
                  className="secondary"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isAvatarUploading}
                >
                  {isAvatarUploading ? 'Uploading…' : 'Upload photo'}
                </button>
                {profileForm.avatarUrl && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setProfileForm((prev) => ({ ...prev, avatarUrl: '' }))}
                    disabled={isAvatarUploading}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </label>
          <label>
            Avatar URL
            <input
              type="url"
              name="avatarUrl"
              value={profileForm.avatarUrl}
              onChange={handleProfileChange}
              placeholder="Upload above, or paste an image URL"
            />
          </label>
          {avatarError && <div className="form-message error">{avatarError}</div>}
          <button type="submit" disabled={isProfileSaving || isAvatarUploading}>
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
