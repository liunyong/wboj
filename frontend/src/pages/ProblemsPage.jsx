import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';

import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useUserProgress, userProgressQueryKey } from '../hooks/useUserProgress.js';
import { useSubmissionStream } from '../hooks/useSubmissionStream.js';

const difficulties = ['BASIC', 'EASY', 'MEDIUM', 'HARD'];
const SCROLL_STORAGE_KEY = 'problemsPageScrollY';
const PAGE_SIZE = 20;

function ProblemsPage() {
  const { authFetch, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdminLike = ['admin', 'super_admin'].includes(user?.role);
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [visibility, setVisibility] = useState(
    isAdminLike ? searchParams.get('visibility') || 'all' : 'public'
  );
  const [difficulty, setDifficulty] = useState(searchParams.get('difficulty') ?? '');
  const [tagFilter, setTagFilter] = useState(searchParams.get('tag') ?? '');
  const [page, setPage] = useState(() => {
    const parsed = Number(searchParams.get('page') ?? '1');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  });
  const [pendingDeletion, setPendingDeletion] = useState(null);
  const [visibilityTarget, setVisibilityTarget] = useState(null);
  const [hasRestoredScroll, setHasRestoredScroll] = useState(false);

  useEffect(() => {
    if (!isAdminLike && visibility !== 'public') {
      setVisibility('public');
      return;
    }
    if (isAdminLike && visibility === 'public') {
      setVisibility(searchParams.get('visibility') || 'all');
    }
  }, [isAdminLike, searchParams, visibility]);

  useEffect(() => {
    const paramsSearch = searchParams.get('q') ?? '';
    const paramsDifficulty = searchParams.get('difficulty') ?? '';
    const paramsTag = searchParams.get('tag') ?? '';
    const paramsVisibility = searchParams.get('visibility') || 'all';
    const paramsPage = Number(searchParams.get('page') ?? '1');

    setSearch(paramsSearch);
    setDifficulty(paramsDifficulty);
    setTagFilter(paramsTag);
    if (Number.isFinite(paramsPage) && paramsPage > 0) {
      setPage(paramsPage);
    } else {
      setPage(1);
    }
    if (isAdminLike) {
      setVisibility(paramsVisibility);
    }
  }, [isAdminLike, searchParams]);

  useEffect(() => {
    const next = new URLSearchParams();
    const trimmedSearch = search.trim();
    if (trimmedSearch) {
      next.set('q', trimmedSearch);
    }
    if (difficulty) {
      next.set('difficulty', difficulty);
    }
    if (tagFilter) {
      next.set('tag', tagFilter);
    }
    if (isAdminLike && visibility !== 'all') {
      next.set('visibility', visibility);
    }
    if (page > 1) {
      next.set('page', String(page));
    }

    const currentString = searchParams.toString();
    const nextString = next.toString();
    if (currentString !== nextString) {
      setSearchParams(next, { replace: true });
    }
  }, [difficulty, isAdminLike, page, search, searchParams, setSearchParams, tagFilter, visibility]);

  const problemsQuery = useQuery({
    queryKey: ['problems', visibility, difficulty],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '100', visibility, page: '1' });
      if (difficulty) {
        params.set('difficulty', difficulty);
      }
      const firstResponse = await authFetch(`/api/problems?${params.toString()}`);
      const allItems = Array.isArray(firstResponse?.items) ? [...firstResponse.items] : [];
      const totalPages = Number.isFinite(firstResponse?.totalPages)
        ? Math.max(1, firstResponse.totalPages)
        : 1;

      for (let currentPage = 2; currentPage <= totalPages; currentPage += 1) {
        params.set('page', String(currentPage));
        const pageResponse = await authFetch(`/api/problems?${params.toString()}`);
        if (Array.isArray(pageResponse?.items)) {
          allItems.push(...pageResponse.items);
        }
      }

      return allItems;
    }
  });

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

  useEffect(() => {
    if (tagFilter && !tagOptions.includes(tagFilter)) {
      setTagFilter('');
    }
  }, [tagFilter, tagOptions]);

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

    return results;
  }, [problemsQuery.data, search, tagFilter]);

  const totalProblems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalProblems / PAGE_SIZE));
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
    if (page !== currentPage) {
      setPage(currentPage);
    }
  }, [currentPage, page]);

  const pageItems = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, filtered]);

  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  const handlePageChange = (nextPage) => {
    if (nextPage === currentPage) {
      return;
    }
    setPage(nextPage);
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
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <select
            value={difficulty}
            onChange={(event) => {
              setDifficulty(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All difficulties</option>
            {difficulties.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
          {isAdmin && (
            <select
              value={visibility}
              onChange={(event) => {
                setVisibility(event.target.value);
                setPage(1);
              }}
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
                onClick={() => {
                  setTagFilter('');
                  setPage(1);
                }}
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
                  onClick={() => {
                    setTagFilter(tag);
                    setPage(1);
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
          <div className="problem-table-wrapper">
            <table className="problem-table">
              <thead>
                <tr>
                  <th className="problem-table__status-header" aria-label="Solved">
                    <span>✓</span>
                  </th>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Author</th>
                  <th>Difficulty</th>
                  <th>Submissions</th>
                  <th>AC Rate</th>
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
                const authorUsername =
                  problem.author?.username ?? problem.author?.userName ?? null;
                const authorLabel =
                  problem.author?.profile?.displayName ??
                  problem.author?.displayName ??
                  authorUsername ??
                  '—';

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
                      {authorUsername ? (
                        <Link to={`/u/${authorUsername}`}>{authorLabel}</Link>
                      ) : (
                        <span className="muted">{authorLabel}</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`difficulty-tag difficulty-${problem.difficulty?.toLowerCase()}`}
                      >
                        {problem.difficulty || 'BASIC'}
                      </span>
                    </td>
                    <td>{total}</td>
                    <td>{acceptanceRate}</td>
                    {isAdmin && (
                      <td className="problem-table__actions">
                        <button
                          type="button"
                          className="secondary"
                          disabled={
                            toggleVisibilityMutation.isLoading &&
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
                      </td>
                    )}
                  </tr>
                );
              })}
              {!pageItems.length && (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7}>
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
            Showing {pageItems.length} of {totalProblems} problems
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
