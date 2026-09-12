import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ThemePicker from './ThemePicker.jsx';

let media;
let onSystemChange;
beforeEach(() => {
  localStorage.clear();
  media = {
    matches: true,
    addEventListener: vi.fn((_, callback) => { onSystemChange = callback; }),
    removeEventListener: vi.fn()
  };
  vi.stubGlobal('matchMedia', vi.fn(() => media));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('theme preference', () => {
  it('follows system changes until an explicit preference is selected and persists it', () => {
    const { unmount } = render(<ThemePicker />);
    expect(document.documentElement.dataset.theme).toBe('dark');
    media.matches = false;
    onSystemChange();
    expect(document.documentElement.dataset.theme).toBe('light');
    fireEvent.change(screen.getByLabelText('Color theme'), { target: { value: 'dark' } });
    expect(localStorage.getItem('wboj-theme')).toBe('dark');
    onSystemChange();
    expect(document.documentElement.dataset.theme).toBe('dark');
    unmount();
    render(<ThemePicker />);
    expect(screen.getByLabelText('Color theme')).toHaveValue('dark');
    fireEvent.change(screen.getByLabelText('Color theme'), { target: { value: 'system' } });
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('recovers from invalid saved preferences and synchronizes other tabs', () => {
    localStorage.setItem('wboj-theme', 'invalid');
    render(<ThemePicker />);
    expect(screen.getByLabelText('Color theme')).toHaveValue('system');
    localStorage.setItem('wboj-theme', 'light');
    fireEvent(window, new StorageEvent('storage', { key: 'wboj-theme' }));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('still allows changing themes when browser storage is unavailable', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<ThemePicker />);
    fireEvent.change(screen.getByLabelText('Color theme'), { target: { value: 'light' } });
    expect(document.documentElement.dataset.theme).toBe('light');
    get.mockRestore();
    set.mockRestore();
  });
});
