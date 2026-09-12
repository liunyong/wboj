import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';

import ProblemNavigation from './ProblemNavigation.jsx';

const authFetch = vi.hoisted(() => vi.fn());
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ authFetch }) }));
afterEach(cleanup);
function mount(problemId, isAdmin = false) {
  authFetch.mockImplementation(async (url) => ({
    items: url.includes('page=2') ? [{ problemId: 120, title: 'Last' }] : [
      { problemId: 108, title: 'Middle' }, { problemId: 101, title: 'First' }
    ], totalPages: 2
  }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><MemoryRouter><ProblemNavigation problemId={problemId} isAdmin={isAdmin} /></MemoryRouter></QueryClientProvider>);
}
it('finds adjacent IDs across API pages without assuming consecutive IDs', async () => {
  mount(108);
  expect(await screen.findByRole('link', { name: 'Previous problem' })).toHaveAttribute('href', '/problems/101');
  expect(await screen.findByRole('link', { name: 'Next problem' })).toHaveAttribute('href', '/problems/120');
  expect(authFetch).toHaveBeenCalledWith(expect.stringContaining('visibility=public'));
});
it('disables previous on the first problem', async () => {
  mount(101);
  await screen.findByRole('link', { name: 'Next problem' });
  expect(screen.getByRole('button', { name: 'Previous problem' })).toBeDisabled();
});
it('disables next on the last problem and includes admin-visible problems', async () => {
  mount(120, true);
  await screen.findByRole('link', { name: 'Previous problem' });
  expect(screen.getByRole('button', { name: 'Next problem' })).toBeDisabled();
  expect(authFetch).toHaveBeenCalledWith(expect.stringContaining('visibility=all'));
});
