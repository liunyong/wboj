import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ProblemsPage from './ProblemsPage.jsx';

const auth = vi.hoisted(() => ({ user: null, authFetch: vi.fn() }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth }));
vi.mock('../hooks/useSubmissionStream.js', () => ({ useSubmissionStream: () => {} }));

const problems = Array.from({ length: 125 }, (_, index) => ({
  _id: String(index + 1),
  problemId: 100001 + index,
  title: `Problem ${index + 1}`,
  tags: [index < 65 ? 'Math' : 'Graphs'],
  algorithms: [],
  isPublic: true,
  difficultyRating: 800 + index * 10,
  submissionCount: index + 1,
  acceptedSubmissionCount: 1
}));

function LocationControls() {
  const location = useLocation();
  const navigate = useNavigate();
  return <>
    <output data-testid="location">{location.search}</output>
    <button onClick={() => navigate('/problems?tag=Graphs&sort=id-desc&limit=20&page=2')}>Open saved view</button>
    <button onClick={() => navigate(-1)}>Back</button>
  </>;
}

function renderPage(entry = '/problems') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <ProblemsPage />
        <LocationControls />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);
const visibleIds = () => rows().map((row) => within(row).getAllByRole('cell')[1].textContent);
const params = () => new URLSearchParams(screen.getByTestId('location').textContent);
const sortLabels = {
  id: 'ID', title: 'Title', author: 'Author', difficulty: 'Difficulty Rating',
  submissions: 'Submissions', acceptance: 'AC Rate'
};
const selectSort = (value) => {
  const [field, direction] = value.split('-');
  const header = screen.getByRole('columnheader', { name: sortLabels[field] });
  const expectedDirection = direction === 'asc' ? 'ascending' : 'descending';
  if (header.getAttribute('aria-sort') !== expectedDirection) {
    fireEvent.click(within(header).getByRole('button'));
  }
  if (header.getAttribute('aria-sort') !== expectedDirection) {
    fireEvent.click(within(header).getByRole('button'));
  }
  expect(header).toHaveAttribute('aria-sort', expectedDirection);
};

beforeEach(() => {
  auth.user = null;
  auth.authFetch.mockReset();
  auth.authFetch.mockImplementation(async (url) => {
    const page = Number(new URL(url, 'http://localhost').searchParams.get('page'));
    return { items: problems.slice((page - 1) * 100, page * 100), totalPages: 2 };
  });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Problem archive controls', () => {
  it('toggles sorting from headers using clicks, Enter, and Space', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('table');
    expect(screen.queryByRole('combobox', { name: 'Sort by' })).not.toBeInTheDocument();
    const idHeader = screen.getByRole('columnheader', { name: 'ID' });
    expect(idHeader).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(within(idHeader).getByRole('button'));
    expect(idHeader).toHaveAttribute('aria-sort', 'descending');
    expect(visibleIds()[0]).toBe('#100125');
    fireEvent.click(within(idHeader).getByRole('button'));
    expect(idHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(visibleIds()[0]).toBe('#100001');

    const titleHeader = screen.getByRole('columnheader', { name: 'Title' });
    within(titleHeader).getByRole('button').focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(titleHeader).toHaveAttribute('aria-sort', 'ascending'));
    expect(idHeader).not.toHaveAttribute('aria-sort');
    await user.keyboard(' ');
    await waitFor(() => expect(titleHeader).toHaveAttribute('aria-sort', 'descending'));
    expect(visibleIds()[0]).toBe('#100125');
    expect(params().get('sort')).toBe('title-desc');
    fireEvent.click(screen.getByRole('button', { name: 'Sort by Submissions' }));
    expect(screen.getByRole('columnheader', { name: 'Submissions' })).toHaveAttribute('aria-sort', 'descending');
    expect(titleHeader).not.toHaveAttribute('aria-sort');
  });

  it('shows 50 problems by default and paginates through every API page', async () => {
    renderPage();
    await screen.findByRole('table');
    expect(rows()).toHaveLength(50);
    expect(screen.getByRole('combobox', { name: 'Per page' })).toHaveValue('50');
    expect(screen.getByText('Showing 1–50 of 125 problems')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Author' })).not.toBeInTheDocument();
    expect(within(rows()[0]).getAllByRole('cell')).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(visibleIds()[0]).toBe('#100051');
    expect(params().get('page')).toBe('2');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(rows()).toHaveLength(25);
    expect(screen.getByText('Showing 101–125 of 125 problems')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('sorts the entire archive before slicing and resets the page when controls change', async () => {
    renderPage('/problems?page=2');
    await screen.findByRole('table');
    selectSort('id-desc');
    expect(visibleIds()[0]).toBe('#100125');
    expect(params().has('page')).toBe(false);
    fireEvent.change(screen.getByRole('combobox', { name: 'Per page' }), { target: { value: '20' } });
    expect(rows()).toHaveLength(20);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(visibleIds()[0]).toBe('#100105');
    fireEvent.change(screen.getByRole('combobox', { name: 'Per page' }), { target: { value: '100' } });
    expect(rows()).toHaveLength(100);
    expect(visibleIds()[0]).toBe('#100125');
    expect(params().get('sort')).toBe('id-desc');
    expect(params().get('limit')).toBe('100');
    // Display controls operate on the complete cached archive.
    expect(auth.authFetch).toHaveBeenCalledTimes(2);
  });

  it('marks the chosen category and combines category, search, and sorting', async () => {
    renderPage('/problems?page=2');
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Graphs' }));
    expect(screen.getByRole('button', { name: 'Graphs' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Graphs' })).toHaveClass('problem-tag-filter__button--active');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Showing 1–50 of 60 problems')).toBeInTheDocument();
    selectSort('title-desc');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Problem 12' } });
    expect(visibleIds()).toEqual(['#100125', '#100124', '#100123', '#100122', '#100121', '#100120']);
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(rows()).toHaveLength(7);
  });

  it('restores URL selections after loading and synchronizes browser navigation', async () => {
    renderPage('/problems?tag=Math&sort=id-desc&limit=20&page=2');
    await screen.findByRole('table');
    expect(visibleIds()[0]).toBe('#100045');
    expect(screen.getByRole('button', { name: 'Math' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('combobox', { name: 'Per page' })).toHaveValue('20');
    expect(params().get('page')).toBe('2');
    fireEvent.click(screen.getByRole('button', { name: 'Open saved view' }));
    expect(visibleIds()[0]).toBe('#100105');
    expect(screen.getByRole('button', { name: 'Graphs' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Back', exact: true }));
    expect(visibleIds()[0]).toBe('#100045');
    expect(screen.getByRole('button', { name: 'Math' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('sorts numeric statistics accurately and keeps missing values last in both directions', async () => {
    auth.authFetch.mockResolvedValue({ items: [
      { ...problems[0], title: 'Zebra', author: null, difficultyRating: null, submissionCount: 0 },
      { ...problems[1], title: 'Alpha', author: { username: 'z', profile: { displayName: 'Alice' } }, difficultyRating: 1200, submissionCount: 10, acceptedSubmissionCount: 9 },
      { ...problems[2], title: 'Beta', author: { username: 'Bob' }, difficultyRating: 800, submissionCount: 200, acceptedSubmissionCount: 20 },
      { ...problems[3], title: 'Gamma', author: { displayName: 'Alice' }, difficultyRating: 1200, submissionCount: 100, acceptedSubmissionCount: 90 }
    ], totalPages: 1 });
    renderPage();
    await screen.findByRole('table');
    const expected = {
      'id-asc': [1, 2, 3, 4], 'id-desc': [4, 3, 2, 1],
      'title-asc': [2, 3, 4, 1], 'title-desc': [1, 4, 3, 2],
      'difficulty-asc': [3, 2, 4, 1], 'difficulty-desc': [2, 4, 3, 1],
      'submissions-asc': [1, 2, 4, 3], 'submissions-desc': [3, 4, 2, 1],
      'acceptance-asc': [3, 2, 4, 1], 'acceptance-desc': [2, 4, 3, 1]
    };
    Object.entries(expected).forEach(([sort, ids]) => {
      selectSort(sort);
      expect(visibleIds()).toEqual(ids.map((id) => `#${100000 + id}`));
    });
  });

  it('falls back from invalid URL values and handles empty results', async () => {
    renderPage('/problems?page=1.5&limit=0&sort=unknown');
    await screen.findByRole('table');
    expect(rows()).toHaveLength(50);
    expect(visibleIds()[0]).toBe('#100001');
    expect(screen.getByRole('columnheader', { name: 'ID' })).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'no matching problem' } });
    expect(screen.getByText('No problems found.')).toBeInTheDocument();
    expect(screen.getByText('Showing 0–0 of 0 problems')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('clamps an out-of-range page only after the archive loads', async () => {
    renderPage('/problems?page=999');
    await screen.findByRole('table');
    expect(visibleIds()[0]).toBe('#100101');
    await waitFor(() => expect(params().get('page')).toBe('3'));
    expect(screen.getByRole('button', { name: '3', exact: true })).toHaveAttribute('aria-current', 'page');
  });

  it('preserves display controls when an admin changes visibility', async () => {
    auth.user = { role: 'admin' };
    renderPage('/problems?sort=id-desc&limit=20&page=2');
    await screen.findByRole('table');
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by visibility' }), { target: { value: 'private' } });
    await screen.findByRole('table');
    expect(screen.getByRole('combobox', { name: 'Filter by visibility' })).toHaveValue('private');
    expect(params().get('sort')).toBe('id-desc');
    expect(params().get('limit')).toBe('20');
    expect(params().has('page')).toBe(false);
    expect(auth.authFetch.mock.calls.some(([url]) => url.includes('visibility=private'))).toBe(true);
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by visibility' }), { target: { value: 'public' } });
    await screen.findByRole('table');
    expect(screen.getByRole('combobox', { name: 'Filter by visibility' })).toHaveValue('public');
  });
});
