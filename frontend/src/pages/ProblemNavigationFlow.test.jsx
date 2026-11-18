import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import ProblemDetailPage from './ProblemDetailPage.jsx';
import ProblemsPage from './ProblemsPage.jsx';

const authFetch = vi.hoisted(() => vi.fn());
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ authFetch, user: null }) }));
vi.mock('../hooks/useSubmissionStream.js', () => ({ useSubmissionStream: () => {} }));
vi.mock('../components/ProblemSubmissionsPanel.jsx', () => ({ default: () => null }));

let problems;
beforeEach(() => {
  problems = [
    { problemId: 101, title: 'Practice Zebra', tags: ['Math', 'Graphs'] },
    { problemId: 108, title: 'Practice Alpha', tags: ['Math'] },
    { problemId: 120, title: 'Practice Beta', tags: ['Graphs'] },
    { problemId: 131, title: 'Other Math', tags: ['Math'] },
    { problemId: 145, title: 'Practice Gamma', tags: ['Math'] }
  ].map((problem) => ({ ...problem, _id: String(problem.problemId), isPublic: true }));
  authFetch.mockReset();
  authFetch.mockImplementation(async (url) => {
    const { pathname, searchParams } = new URL(url, 'http://localhost');
    if (pathname === '/api/problems') {
      const page = Number(searchParams.get('page'));
      // Split the archive across API pages independently of display pagination.
      return { items: page === 1 ? problems.slice(0, 2) : problems.slice(2), totalPages: 2 };
    }
    if (pathname.startsWith('/api/problems/')) {
      const problem = problems.find((item) => item.problemId === Number(pathname.split('/').at(-1)));
      return { ...problem, _id: String(problem.problemId), isPublic: true, statement: 'Solve this problem.' };
    }
    if (pathname === '/api/languages') return [];
    return { items: [] };
  });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Location() {
  const { pathname, search } = useLocation();
  return <output data-testid="location">{pathname}{search}</output>;
}

function mount(entry) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[entry]}>
    <Routes>
      <Route path="/problems" element={<ProblemsPage />} />
      <Route path="/problems/:problemId" element={<ProblemDetailPage />} />
    </Routes>
    <Location />
  </MemoryRouter></QueryClientProvider>);
}

async function expectProblem(id, query = '') {
  await screen.findByRole('heading', { name: new RegExp(`#${id}$`) });
  await waitFor(() => expect(screen.getByRole('navigation', { name: 'Problem navigation' })).toHaveAttribute('aria-busy', 'false'));
  expect(screen.getByTestId('location')).toHaveTextContent(`/problems/${id}${query}`);
}

it('keeps the list search, tag semantics, and sort across repeated arrows and the return link', async () => {
  // The existing single-select control uses the first tag, even for repeated parameters.
  const query = '?tag=Math&tag=Graphs&q=Practice&sort=title-desc&limit=20';
  mount(`/problems${query}`);
  await screen.findByRole('table');
  const titles = within(screen.getByRole('table')).getAllByRole('link');
  expect(titles.map((link) => link.textContent)).toEqual(['Practice Zebra', 'Practice Gamma', 'Practice Alpha']);
  fireEvent.click(titles[0]);
  await expectProblem(101, query);
  expect(screen.getByRole('button', { name: 'Previous problem' })).toBeDisabled();
  fireEvent.click(await screen.findByRole('link', { name: 'Next problem' }));
  await expectProblem(145, query);
  fireEvent.click(await screen.findByRole('link', { name: 'Next problem' }));
  await expectProblem(108, query);
  expect(screen.getByRole('button', { name: 'Next problem' })).toBeDisabled();
  fireEvent.click(screen.getByRole('link', { name: 'Previous problem' }));
  await expectProblem(145, query);
  fireEvent.click(screen.getByRole('link', { name: 'Previous problem' }));
  await expectProblem(101, query);
  expect(screen.getByRole('button', { name: 'Previous problem' })).toBeDisabled();
  fireEvent.click(screen.getByRole('link', { name: 'Problems', exact: true }));
  await screen.findByRole('table');
  expect(screen.getByTestId('location')).toHaveTextContent(`/problems${query}`);
  expect(screen.getByRole('button', { name: 'Math', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('searchbox')).toHaveValue('Practice');
  expect(screen.getByRole('columnheader', { name: 'Title' })).toHaveAttribute('aria-sort', 'descending');
  expect(within(screen.getByRole('table')).getAllByRole('link').map((link) => link.textContent)).toEqual(titles.map((link) => link.textContent));
});

it('crosses display page boundaries and returns to the original list page', async () => {
  problems = Array.from({ length: 22 }, (_, index) => ({
    _id: String(index), problemId: 200 + index * 3, title: `Math ${index + 1}`, tags: ['Math'], isPublic: true
  }));
  const query = '?tag=Math&sort=id-desc&limit=20&page=2';
  mount(`/problems${query}`);
  await screen.findByRole('table');
  fireEvent.click(screen.getByRole('link', { name: 'Math 2', exact: true }));
  await expectProblem(203, query);
  fireEvent.click(await screen.findByRole('link', { name: 'Previous problem' }));
  await expectProblem(206, query);
  fireEvent.click(screen.getByRole('link', { name: 'Next problem' }));
  await expectProblem(203, query);
  fireEvent.click(screen.getByRole('link', { name: 'Next problem' }));
  await expectProblem(200, query);
  expect(screen.getByRole('button', { name: 'Next problem' })).toBeDisabled();
  fireEvent.click(screen.getByRole('link', { name: 'Problems', exact: true }));
  expect(await screen.findByText('Showing 21–22 of 22 problems')).toBeInTheDocument();
  expect(screen.getByTestId('location')).toHaveTextContent(`/problems${query}`);
});

it.each(['/problems', '/problems?sort=title-desc', '/problems/108'])(
  'preserves full-list ID navigation without active filters from %s', async (entry) => {
    mount(entry);
    if (!entry.startsWith('/problems/')) {
      fireEvent.click(await screen.findByRole('link', { name: 'Practice Alpha', exact: true }));
    }
    await expectProblem(108);
    expect(await screen.findByRole('link', { name: 'Previous problem' })).toHaveAttribute('href', expect.stringContaining('/problems/101'));
    fireEvent.click(await screen.findByRole('link', { name: 'Next problem' }));
    await expectProblem(120);
    fireEvent.click(screen.getByRole('link', { name: 'Next problem' }));
    await expectProblem(131);
    fireEvent.click(screen.getByRole('link', { name: 'Previous problem' }));
    await expectProblem(120);
  }
);

it('restores filtered navigation when a detail URL is opened directly', async () => {
  const query = '?tag=Math&q=Practice&sort=title-desc';
  mount(`/problems/145${query}`);
  await expectProblem(145, query);
  expect(await screen.findByRole('link', { name: 'Previous problem' })).toHaveAttribute('href', `/problems/101${query}`);
  expect(screen.getByRole('link', { name: 'Next problem' })).toHaveAttribute('href', `/problems/108${query}`);
});

it.each(['?tag=Math&q=Alpha', '?tag=Graphs'])(
  'disables both arrows for a single match or a problem outside the results: %s', async (query) => {
    mount(`/problems/108${query}`);
    await expectProblem(108);
    expect(screen.getByRole('button', { name: 'Previous problem' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next problem' })).toBeDisabled();
  }
);
