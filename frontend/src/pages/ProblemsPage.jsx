import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';

import ConfirmDialog from '../components/ConfirmDialog.jsx';
import DifficultyBadge from '../components/DifficultyBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useUserProgress, userProgressQueryKey } from '../hooks/useUserProgress.js';
import { useSubmissionStream } from '../hooks/useSubmissionStream.js';
import { useProblemArchive } from '../hooks/useProblemArchive.js';

const SCROLL_STORAGE_KEY = 'problemsPageScrollY';
const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = [20, 50, 100];
const SORT_COLUMNS = [
  { field: 'id', label: 'ID', defaultDirection: 'asc' },
  { field: 'title', label: 'Title', defaultDirection: 'asc' },
  { field: 'difficulty', label: 'Difficulty Rating', defaultDirection: 'asc' },
  { field: 'submissions', label: 'Submissions', defaultDirection: 'desc' },
  { field: 'acceptance', label: 'AC Rate', defaultDirection: 'desc' }
];

function SortableProblemHeader({ column, sort, onSort }) {
  const { field, label, defaultDirection } = column;
  const [sortField, direction] = sort.split('-');
  const active = sortField === field;
  const nextDirection = active ? (direction === 'asc' ? 'desc' : 'asc') : defaultDirection;

  return (
    <th
      scope="col"
      className="problem-table__sortable-header"
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <button
        type="button"
        className="problem-table__sort-button"
        aria-label={`Sort by ${label}`}
        title={`Sort by ${label}: ${nextDirection === 'asc' ? 'ascending' : 'descending'}`}
        onClick={() => onSort(`${field}-${nextDirection}`)}
      >
        <span>{label}</span>
        <span className="problem-table__sort-icon" aria-hidden="true">
          {active ? (direction === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
}

function compareProblems(a, b, sort) {
  const [field, direction] = sort.split('-');
  const compareId = () => Number(a.problemId) - Number(b.problemId);
  let result = 0;

  if (field === 'title') {
    result = (a.title ?? '').localeCompare(b.title ?? '', undefined, { numeric: true });
  } else if (field === 'difficulty' || field === 'acceptance') {
    const value = (problem) => field === 'difficulty'
      ? problem.difficultyRating
      : problem.submissionCount > 0
        ? (problem.acceptedSubmissionCount ?? 0) / problem.submissionCount
        : null;
    const left = value(a);
    const right = value(b);
    // Keep unrated problems and problems without submissions last in either direction.
    if (!Number.isFinite(left) || !Number.isFinite(right)) {
      if (Number.isFinite(left)) return -1;
      if (Number.isFinite(right)) return 1;
      return compareId();
    }
    result = left - right;
  } else if (field === 'submissions') {
    result = (a.submissionCount ?? 0) - (b.submissionCount ?? 0);
  } else {
    result = compareId();
  }

  return (direction === 'desc' ? -result : result) || compareId();
}

function ProblemsPage() {
  const { authFetch, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdminLike = ['admin', 'super_admin'].includes(user?.role);
  const search = searchParams.get('q') ?? '';
  const requestedVisibility = searchParams.get('visibility');
  const visibility = isAdminLike
    ? (['public', 'private'].includes(requestedVisibility) ? requestedVisibility : 'all')
    : 'public';
  const tagFilter = searchParams.get('tag') ?? '';
  const requestedPage = Number(searchParams.get('page') ?? '1');
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const requestedPageSize = Number(searchParams.get('limit'));
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize) ? requestedPageSize : DEFAULT_PAGE_SIZE;
  const requestedSort = searchParams.get('sort');
  const sort = SORT_COLUMNS.some(({ field }) =>
    requestedSort === `${field}-asc` || requestedSort === `${field}-desc`
  ) ? requestedSort : 'id-asc';
  const [pendingDeletion, setPendingDeletion] = useState(null);
  const [visibilityTarget, setVisibilityTarget] = useState(null);
  const [hasRestoredScroll, setHasRestoredScroll] = useState(false);

  const updateFilters = (updates) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete('page');
      Object.entries(updates).forEach(([key, value]) => {
        if (value === '') next.delete(key);
        else next.set(key, String(value));
      });
      return next;
    }, { replace: true });
  };

  const problemsQuery = useProblemArchive(visibility);

  const progressQuery = useUserProgress();
  const solvedProblemIds = useMemo(() => {
    if (!Array.isArray(progressQuery.solved)) {
      return new Set();
    }
    return new Set(progressQuery.solved.map((item) => item.problemId));
  }, [progressQuery.solved]);

  const toggleVisibilityMutation = useMutation({
    mutationFn: ({ problemId, isPublic }) =>
      authFetch(`/api/problems/${problemId}/visibility`, {
        method: 'PATCH',
        body: { isPublic }
      }),
    onMutate: ({ problemId }) => {
      setVisibilityTarget(problemId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['problems'] });
    },
    onSettled: () => {
      setVisibilityTarget(null);
    }
  });

  useSubmissionStream({
    enabled: Boolean(user?.id),
    onEvent: (event) => {
      if (!event || event.userId !== user?.id) {
        return;
      }
      const verdict = event.verdict ?? null;
      const status = event.status ?? null;
      const hasFinalVerdict =
        verdict && verdict !== 'PENDING'
          ? true
          : status && !['queued', 'running'].includes(status);
      if (hasFinalVerdict) {
        queryClient.invalidateQueries({ queryKey: userProgressQueryKey });
      }
    }
  });

  useEffect(() => {
    if (hasRestoredScroll || problemsQuery.isFetching) {
      return;
    }
    const stored = sessionStorage.getItem(SCROLL_STORAGE_KEY);
    if (stored !== null) {
      const savedScroll = Number(stored);
      if (!Number.isNaN(savedScroll)) {
        window.scrollTo({ top: savedScroll, behavior: 'auto' });
      }
    }
    setHasRestoredScroll(true);
  }, [hasRestoredScroll, problemsQuery.isFetching]);

  useEffect(() => {
    return () => {
      sessionStorage.setItem(SCROLL_STORAGE_KEY, `${window.scrollY}`);
    };
  }, []);

  const deleteMutation = useMutation({
    mutationFn: (problemId) => authFetch(`/api/problems/${problemId}`, { method: 'DELETE' }),
    onSuccess: () => {
      setPendingDeletion(null);
      queryClient.invalidateQueries({ queryKey: ['problems'] });
    }
  });

  const tagOptions = useMemo(() => {
    const items = problemsQuery.data ?? [];
    const tags = new Set();
    items.forEach((problem) => {
      (problem.tags ?? []).forEach((tag) => {
        if (typeof tag === 'string' && tag.trim()) {
          tags.add(tag);
        }
      });
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [problemsQuery.data]);

  const filtered = useMemo(() => {
    const items = problemsQuery.data ?? [];
    const trimmed = search.trim().toLowerCase();
    let results = items;

    if (trimmed) {
      results = results.filter((problem) => {
        const fields = [
          problem.title,
          problem.problemId ? `#${problem.problemId}` : '',
          ...(problem.algorithms ?? []),
          ...(problem.tags ?? [])
        ];
        return fields
          .filter(Boolean)
          .map((value) => value.toString().toLowerCase())
          .some((value) => value.includes(trimmed));
      });
    }

    if (tagFilter) {
      results = results.filter((problem) => (problem.tags ?? []).includes(tagFilter));
    }

    return [...results].sort((a, b) => compareProblems(a, b, sort));
  }, [problemsQuery.data, search, sort, tagFilter]);

  const totalProblems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalProblems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginationItems = useMemo(() => {
    if (totalPages <= 10) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const items = [1];
    let start = Math.max(2, currentPage - 2);
    let end = Math.min(totalPages - 1, currentPage + 2);

    if (start === 2) {
      end = Math.min(totalPages - 1, start + 4);
    }
    if (end === totalPages - 1) {
      start = Math.max(2, end - 4);
    }

    if (start > 2) {
      items.push('ellipsis-left');
    }

    for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
      items.push(pageNumber);
    }

    if (end < totalPages - 1) {
      items.push('ellipsis-right');
    }

    items.push(totalPages);
    return items;
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (problemsQuery.isSuccess && !problemsQuery.isFetching && page !== currentPage) {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        if (currentPage === 1) next.delete('page');
        else next.set('page', String(currentPage));
        return next;
      }, { replace: true });
    }
  }, [currentPage, page, problemsQuery.isSuccess, problemsQuery.isFetching, setSearchParams]);

  const pageItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filtered.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filtered, pageSize]);

  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  const handlePageChange = (nextPage) => {
    if (nextPage === currentPage) {
      return;
    }
    updateFilters({ page: nextPage === 1 ? '' : nextPage });
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const isAdmin = isAdminLike;

  const handleDeleteConfirm = () => {
    if (!pendingDeletion) {
      return;
    }
    deleteMutation.mutate(pendingDeletion.problemId);
  };

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Problem Archive</h1>
          <p>Browse challenges and sharpen your coding skills.</p>
        </div>
        <div className="page-controls">
          <input
            type="search"
            placeholder="Search problems"
            aria-label="Search problems"
            value={search}
            onChange={(event) => updateFilters({ q: event.target.value })}
          />
          {isAdmin && (
            <select
              aria-label="Filter by visibility"
              value={visibility}
              onChange={(event) => updateFilters({ visibility: event.target.value })}
            >
              <option value="all">All</option>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          )}
        </div>
      </header>

      {problemsQuery.isLoading && <div className="page-message">Loading problems…</div>}
      {problemsQuery.isError && (
        <div className="page-message error">Failed to load problems.</div>
      )}

      {!problemsQuery.isLoading && !problemsQuery.isError && (
        <>
          {tagOptions.length > 0 && (
            <div className="problem-tag-filter" role="group" aria-label="Filter by tag">
              <button
                type="button"
                className={`secondary problem-tag-filter__button${
                  !tagFilter ? ' problem-tag-filter__button--active' : ''
                }`}
                aria-pressed={!tagFilter}
                onClick={() => updateFilters({ tag: '' })}
              >
                All
              </button>
              {tagOptions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`secondary problem-tag-filter__button${
                    tagFilter === tag ? ' problem-tag-filter__button--active' : ''
                  }`}
                  aria-pressed={tagFilter === tag}
                  onClick={() => updateFilters({ tag })}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
          <div className="problem-list-toolbar">
            <span className="problem-list-toolbar__summary" role="status">
              {totalProblems} {totalProblems === 1 ? 'problem' : 'problems'}
            </span>
            <div className="problem-list-toolbar__controls">
              <label>
                <span>Per page</span>
                <select value={pageSize} onChange={(event) => updateFilters({ limit: event.target.value })}>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="problem-table-wrapper" role="region" aria-label="Problem list" tabIndex={0}>
            <table className={`problem-table${isAdmin ? ' problem-table--admin' : ''}`}>
              <colgroup>
                <col className="problem-table__col-status" />
                <col className="problem-table__col-id" />
                <col />
                <col className="problem-table__col-difficulty" />
                <col className="problem-table__col-submissions" />
                <col className="problem-table__col-acceptance" />
                {isAdmin && <col className="problem-table__col-actions" />}
              </colgroup>
              <thead>
                <tr>
                  <th className="problem-table__status-header" aria-label="Solved">
                    <span>✓</span>
                  </th>
                  {SORT_COLUMNS.map((column) => (
                    <SortableProblemHeader
                      key={column.field}
                      column={column}
                      sort={sort}
                      onSort={(value) => updateFilters({ sort: value })}
                    />
                  ))}
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((problem) => {
                const total = problem.submissionCount ?? 0;
                const accepted = problem.acceptedSubmissionCount ?? 0;
                const acceptanceRate =
                  total > 0 ? `${Math.round((accepted / total) * 100)}%` : '—';
                const isSolved = solvedProblemIds.has(problem.problemId);

                return (
                  <tr key={problem._id}>
                    <td className="problem-table__status">
                      {isSolved ? (
                        <span className="problem-table__status-icon" role="img" aria-label="Solved">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden="true"
                          >
                            <path
                              d="M8 1.333a6.667 6.667 0 1 0 0 13.334A6.667 6.667 0 0 0 8 1.333Zm3.207 4.94-3.76 3.76a.667.667 0 0 1-.944 0l-1.76-1.76a.667.667 0 1 1 .944-.944L7 8.9l3.287-3.287a.667.667 0 1 1 .94.94Z"
                              fill="currentColor"
                            />
                          </svg>
                        </span>
                      ) : null}
                    </td>
                    <td className="problem-table__id">#{problem.problemId}</td>
                    <td>
                      <div className="problem-table__title">
                        <Link to={`/problems/${problem.problemId}`}>{problem.title}</Link>
                        {!problem.isPublic && <span className="problem-table__badge">Private</span>}
                      </div>
                      {problem.algorithms?.length ? (
                        <div className="problem-table__algorithms">
                          {problem.algorithms.join(', ')}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <DifficultyBadge rating={problem.difficultyRating} />
                    </td>
                    <td>{total}</td>
                    <td>{acceptanceRate}</td>
                    {isAdmin && (
                      <td className="problem-table__actions">
                        <div className="problem-table__action-buttons">
                        <button
                          type="button"
                          className="secondary"
                          disabled={
                            toggleVisibilityMutation.isPending &&
                            visibilityTarget === problem.problemId
                          }
                          onClick={() =>
                            toggleVisibilityMutation.mutate({
                              problemId: problem.problemId,
                              isPublic: !problem.isPublic
                            })
                          }
                        >
                          {problem.isPublic ? 'Make Private' : 'Make Public'}
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => setPendingDeletion(problem)}
                        >
                          Delete
                        </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {!pageItems.length && (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6}>
                    <div className="problem-table__empty">No problems found.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="table-footer table-footer--stacked">
          <div className="pagination problem-pagination">
            <button
              type="button"
              className="secondary"
              disabled={!canPrev}
              onClick={() => handlePageChange(currentPage - 1)}
            >
              Previous
            </button>
            {paginationItems.map((item) => {
              if (typeof item === 'string') {
                return (
                  <span key={item} className="pagination-ellipsis" aria-hidden="true">
                    …
                  </span>
                );
              }

              return (
                <button
                  key={item}
                  type="button"
                  className="secondary"
                  disabled={item === currentPage}
                  aria-current={item === currentPage ? 'page' : undefined}
                  onClick={() => handlePageChange(item)}
                >
                  {item}
                </button>
              );
            })}
            <button
              type="button"
              className="secondary"
              disabled={!canNext}
              onClick={() => handlePageChange(currentPage + 1)}
            >
              Next
            </button>
          </div>
          <div className="table-footer__summary">
            Showing {totalProblems ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, totalProblems)} of {totalProblems} problems
          </div>
        </footer>
        </>
      )}

      <ConfirmDialog
        open={Boolean(pendingDeletion)}
        title="Delete this problem?"
        confirmLabel="Delete"
        onCancel={() => setPendingDeletion(null)}
        onConfirm={handleDeleteConfirm}
        isConfirming={deleteMutation.isLoading}
      >
        {pendingDeletion ? (
          <p>
            This cannot be undone. <strong>{pendingDeletion.title}</strong> (
            #{pendingDeletion.problemId})
          </p>
        ) : null}
      </ConfirmDialog>
    </section>
  );
}

export default ProblemsPage;
