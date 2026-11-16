import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from './AuthContext.jsx';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function PreviewProbe() {
  const { user, actualUser, isUserPreview, setUserPreview, authFetch, refreshTokens } = useAuth();
  const data = useQuery({ queryKey: ['preview-data'], queryFn: () => authFetch('/api/problems') });
  return <>
    <output data-testid="roles">{user?.role}/{actualUser?.role}</output>
    <output data-testid="data">{data.data?.view}</output>
    <button onClick={() => setUserPreview(!isUserPreview)}>Toggle view</button>
    <button onClick={() => refreshTokens()}>Refresh token</button>
  </>;
}

function mount(role) {
  const user = { id: 'admin-1', username: 'tester', role };
  localStorage.setItem('oj.tokens', JSON.stringify({ accessToken: 'test-token' }));
  const fetchMock = vi.fn(async (path, init) => {
    const preview = new Headers(init.headers).get('X-WBOJ-View-As') === 'user';
    if (path === '/api/problems') return new Response(JSON.stringify({ view: preview ? 'public-only' : 'admin-data' }));
    return new Response(JSON.stringify({ user, tokens: { accessToken: 'refreshed-token' } }));
  });
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  client.setQueryData(['me'], user);
  render(<QueryClientProvider client={client}><AuthProvider><PreviewProbe /></AuthProvider></QueryClientProvider>);
  return { client, fetchMock };
}

it('switches UI and request permissions, replaces cached data, and restores admin view after refresh', async () => {
  const { fetchMock } = mount('super_admin');
  await screen.findByText('admin-data');
  fireEvent.click(screen.getByRole('button', { name: 'Toggle view' }));
  await waitFor(() => expect(screen.getByTestId('roles')).toHaveTextContent('user/super_admin'));
  expect(screen.queryByText('admin-data')).not.toBeInTheDocument();
  await screen.findByText('public-only');
  fireEvent.click(screen.getByRole('button', { name: 'Refresh token' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/auth/refresh', expect.anything()));
  expect(screen.getByTestId('roles')).toHaveTextContent('user/super_admin');
  fireEvent.click(screen.getByRole('button', { name: 'Toggle view' }));
  await screen.findByText('admin-data');
  expect(screen.getByTestId('roles')).toHaveTextContent('super_admin/super_admin');
  for (const [path, init] of fetchMock.mock.calls) {
    if (path === '/api/auth/me') expect(init.headers.get('X-WBOJ-View-As')).toBeNull();
  }
});

it('does not allow a regular user to enable the preview', async () => {
  mount('user');
  await screen.findByText('admin-data');
  fireEvent.click(screen.getByRole('button', { name: 'Toggle view' }));
  expect(screen.getByTestId('roles')).toHaveTextContent('user/user');
  expect(screen.queryByText('public-only')).not.toBeInTheDocument();
});
