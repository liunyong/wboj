import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useUserProgress, userProgressQueryKey } from '../hooks/useUserProgress.js';
import { useSubmissionStream } from '../hooks/useSubmissionStream.js';

const difficulties = ['BASIC', 'EASY', 'MEDIUM', 'HARD'];

function ProblemsPage() {
  const { authFetch, user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const isAdminLike = ['admin', 'super_admin'].includes(user?.role);
  const [visibility, setVisibility] = useState(isAdminLike ? 'all' : 'public');
  const [difficulty, setDifficulty] = useState('');
  const [pendingDeletion, setPendingDeletion] = useState(null);
  const [visibilityTarget, setVisibilityTarget] = useState(null);

  useEffect(() => {
    setVisibility(['admin', 'super_admin'].includes(user?.role) ? 'all' : 'public');
  }, [user?.role]);

  const problemsQuery = useQuery({
    queryKey: ['problems', visibility, difficulty],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '100', visibility });
      if (difficulty) {
        params.set('difficulty', difficulty);
      }
      const response = await authFetch(`/api/problems?${params.toString()}`);
      return response?.items ?? [];
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

  const deleteMutation = useMutation({
    mutationFn: (problemId) => authFetch(`/api/problems/${problemId}`, { method: 'DELETE' }),
    onSuccess: () => {
      setPendingDeletion(null);
      queryClient.invalidateQueries({ queryKey: ['problems'] });
    }
  });

  const filtered = useMemo(() => {
    const items = problemsQuery.data ?? [];
    const trimmed = search.trim().toLowerCase();
    if (!trimmed) {
      return items;
    }

    return items.filter((problem) => {
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
  }, [problemsQuery.data, search]);

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
            onChange={(event) => setSearch(event.target.value)}
          />
          <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
            <option value="">All difficulties</option>
            {difficulties.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
          {isAdmin && (
            <select value={visibility} onChange={(event) => setVisibility(event.target.value)}>
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
              {filtered.map((problem) => {
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
              {!filtered.length && (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7}>
                    <div className="problem-table__empty">No problems found.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
