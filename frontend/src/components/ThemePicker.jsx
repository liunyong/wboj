import { useEffect, useState } from 'react';

const STORAGE_KEY = 'wboj-theme';

function readPreference() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return ['light', 'dark'].includes(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

export default function ThemePicker() {
  const [preference, setPreference] = useState(readPreference);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preference]);

  useEffect(() => {
    const sync = (event) => {
      if (event.key === STORAGE_KEY || event.key === null) setPreference(readPreference());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  return (
    <label className="theme-picker">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" />
      </svg>
      <select aria-label="Color theme" value={preference} onChange={(event) => {
        const value = event.target.value;
        setPreference(value);
        try { localStorage.setItem(STORAGE_KEY, value); } catch { /* Keep the selection for this session. */ }
      }}>
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
