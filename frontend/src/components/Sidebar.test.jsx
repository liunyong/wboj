import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';

const auth = vi.hoisted(() => ({ user: null, logout: vi.fn().mockResolvedValue(), isLoading: false }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth }));
beforeEach(() => {
  auth.user = null;
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function mount() {
  return render(<MemoryRouter initialEntries={['/problems/100']}><Sidebar collapsed={false} onToggle={vi.fn()} /><div className="app-workspace">Content</div></MemoryRouter>);
}
it('keeps the problem section active on detail pages and hides admin routes from guests', () => {
  mount();
  expect(screen.getByRole('link', { name: 'Problems' })).toHaveAttribute('aria-current', 'page');
  expect(screen.queryByRole('link', { name: 'User Management' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
});
it('exposes account and all administration routes to admins', () => {
  auth.user = { username: 'admin', role: 'super_admin' };
  mount();
  for (const name of ['Settings', 'Create Problem', 'User Management', 'Manage Uploads']) expect(screen.getByRole('link', { name })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
  expect(auth.logout).toHaveBeenCalled();
});
it('locks background interaction and restores focus when dismissing the mobile drawer', () => {
  const { container } = mount();
  const trigger = screen.getByRole('button', { name: 'Open navigation' });
  fireEvent.click(trigger);
  expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  expect(container.querySelector('.app-workspace')).toHaveAttribute('inert');
  expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(container.querySelector('.app-workspace')).not.toHaveAttribute('inert');
  expect(trigger).toHaveFocus();
  expect(document.body.style.overflow).toBe('');
});
it('closes the drawer after selecting a route', () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
  fireEvent.click(screen.getByRole('link', { name: 'Leaderboard' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
