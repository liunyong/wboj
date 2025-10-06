import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext.jsx';

function SettingsPage() {
  const { user, authFetch } = useAuth();
  const queryClient = useQueryClient();
  const [profileForm, setProfileForm] = useState({
    displayName: user?.profile?.displayName ?? '',
    bio: user?.profile?.bio ?? '',
    avatarUrl: user?.profile?.avatarUrl ?? ''
  });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
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

  const submitPassword = async (event) => {
    event.preventDefault();
    setPasswordMessage('');
    setIsPasswordSaving(true);
    try {
      await authFetch('/api/auth/me/password', {
        method: 'PATCH',
        body: passwordForm
      });
      setPasswordMessage('Password updated. Please log in again on other devices.');
      setPasswordForm({ currentPassword: '', newPassword: '' });
    } catch (error) {
      setPasswordMessage(error.message || 'Failed to update password.');
    } finally {
      setIsPasswordSaving(false);
    }
  };

  return (
    <section className="page settings-page">
      <header className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Manage your profile and account security.</p>
        </div>
      </header>

      <div className="settings-grid">
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
          <button type="submit" disabled={isPasswordSaving}>
            {isPasswordSaving ? 'Updating…' : 'Update password'}
          </button>
          {passwordMessage && <div className="form-message info">{passwordMessage}</div>}
        </form>
      </div>
    </section>
  );
}

export default SettingsPage;
