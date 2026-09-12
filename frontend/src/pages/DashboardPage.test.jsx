import { cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from './DashboardPage.jsx';
import Header from '../components/Header.jsx';

const auth = vi.hoisted(() => ({ user: null, isLoading: false, authFetch: vi.fn(), logout: vi.fn() }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth }));
vi.mock('../components/ThemePicker.jsx', () => ({ default: () => null }));
afterEach(cleanup);

describe('Unified dashboard', () => {
  it('offers a single Dashboard navigation entry and public announcements to guests', async () => {
    auth.authFetch.mockResolvedValue({ items: [{ id: 'news', title: 'Welcome to the season', body: 'Start solving.', createdAt: '2026-09-01T00:00:00Z' }] });
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/']}><Header /><Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes></MemoryRouter>
    </QueryClientProvider>);
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(await screen.findByText('Welcome to the season')).toBeInTheDocument();
    const nav = within(screen.getByRole('navigation', { name: 'Main navigation' }));
    expect(nav.getAllByRole('link', { name: 'Dashboard' })).toHaveLength(1);
    expect(nav.queryByRole('link', { name: 'Home' })).toBeNull();
    expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(auth.authFetch.mock.calls.every(([url]) => url.startsWith('/api/announcements'))).toBe(true);
  });
});
