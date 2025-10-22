import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { useSubmissionStream } from '../hooks/useSubmissionStream.js';
import { useResubmitSubmission } from '../hooks/useResubmitSubmission.js';
import { useDeleteSubmission } from '../hooks/useDeleteSubmission.js';
import { useLanguages } from '../hooks/useLanguages.js';
import {
  formatRelativeOrDate,
  formatTooltip,
  getUserTZ
} from '../utils/time.js';
import { detailToEvent } from '../utils/submissions.js';
import SubmissionViewerModal from '../components/SubmissionViewerModal.jsx';

const STATUS_OPTIONS = [
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Grading…' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'wrong_answer', label: 'Wrong Answer' },
  { value: 'tle', label: 'Time Limit' },
  { value: 'rte', label: 'Runtime Error' },
  { value: 'ce', label: 'Compile Error' },
  { value: 'failed', label: 'Failed' }
];

const STATUS_LABELS = {
  queued: 'Queued',
  running: 'Grading…',
  accepted: 'Accepted',
  wrong_answer: 'Wrong Answer',
  tle: 'Time Limit',
  rte: 'Runtime Error',
  ce: 'Compile Error',
  failed: 'Failed'
};

const STATUS_CLASS = {
  queued: 'status-queued',
  running: 'status-running',
  accepted: 'status-accepted',
  wrong_answer: 'status-wrong-answer',
  tle: 'status-tle',
  rte: 'status-rte',
  ce: 'status-ce',
  failed: 'status-failed'
};

const PAGE_SIZE = 20;

const matchesFilters = (event, filters) => {
  if (!filters) {
    return true;
  }
  if (Array.isArray(filters.statuses) && filters.statuses.length) {
    if (!filters.statuses.includes(event.status)) {
      return false;
    }
  }
  if (filters.user) {
    const needle = filters.user.toLowerCase();
    const name = event.userName?.toLowerCase?.() ?? '';
    const userId = event.userId?.toLowerCase?.() ?? '';
    if (!name.includes(needle) && userId !== needle) {
      return false;
    }
  }
  if (filters.problemId) {
    if (String(event.problemId ?? '') !== filters.problemId) {
      return false;
    }
  }
  if (filters.dateFrom) {
    const fromMs = Date.parse(filters.dateFrom);
    if (!Number.isNaN(fromMs)) {
      const eventMs = Date.parse(event.createdAt ?? '') || 0;
      if (eventMs < fromMs) {
        return false;
      }
    }
  }
  if (filters.dateTo) {
    const toMs = Date.parse(filters.dateTo);
    if (!Number.isNaN(toMs)) {
      const inclusiveEnd = toMs + 24 * 60 * 60 * 1000 - 1;
      const eventMs = Date.parse(event.createdAt ?? '') || 0;
      if (eventMs > inclusiveEnd) {
        return false;
      }
    }
  }
  return true;
};

function SubmissionsPage() {
  const { authFetch, user } = useAuth();
  const queryClient = useQueryClient();
  const { resolveLanguageLabel } = useLanguages();
  const userTimeZone = useMemo(() => getUserTZ(), []);
  const [filters, setFilters] = useState({
    statuses: [],
    user: '',
    problemId: '',
    dateFrom: '',
    dateTo: '',
    page: 1
  });
  const [message, setMessage] = useState(null);
  const [activeSubmissionId, setActiveSubmissionId] = useState(null);
  const [resubmittingId, setResubmittingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const isAdmin = ['admin', 'super_admin'].includes(user?.role);
  const isSuperAdmin = user?.role === 'super_admin';
  const currentUserId = user?.id ?? null;

  const queryKey = useMemo(
    () => [
      'submissions',
      'global',
      {
        statuses: filters.statuses.slice().sort().join(','),
        user: filters.user,
        problemId: filters.problemId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        page: filters.page
      }
    ],
    [filters]
  );

  const submissionsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(filters.page));
      params.set('limit', String(PAGE_SIZE));
      params.set('sort', '-createdAt');
      if (filters.statuses.length) {
        params.set('status', filters.statuses.join(','));
      }
      if (filters.user.trim()) {
        params.set('user', filters.user.trim());
      }
      if (filters.problemId.trim()) {
        params.set('problemId', filters.problemId.trim());
      }
      if (filters.dateFrom) {
        params.set('dateFrom', filters.dateFrom);
      }
      if (filters.dateTo) {
        params.set('dateTo', filters.dateTo);
      }

      const response = await authFetch(`/api/submissions?${params.toString()}`);
      const payload = response ?? {
        items: [],
        total: 0,
        totalPages: 1,
        page: filters.page,
        limit: PAGE_SIZE
      };

      return {
        ...payload,
        appliedFilters: {
          statuses: [...filters.statuses],
          user: filters.user.trim().toLowerCase(),
          problemId: filters.problemId.trim(),
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo
        }
      };
    },
    keepPreviousData: true
  });

  const handleStreamEvent = useCallback(
    (event) => {
      if (!event || !event._id) {
        return;
      }
      const isDeletion = event.type === 'submission:deleted' || Boolean(event.deletedAt);
      queryClient.setQueriesData({ queryKey: ['submissions', 'global'] }, (existing) => {
        if (!existing) {
          return existing;
        }
        const limit = existing.limit ?? PAGE_SIZE;
        const appliedFilters = existing.appliedFilters ?? null;
        if (existing.page && existing.page !== 1) {
          return existing;
        }
        if (!isDeletion && !matchesFilters(event, appliedFilters)) {
          return existing;
        }
        const nextItems = Array.isArray(existing.items) ? [...existing.items] : [];
        const existingIndex = nextItems.findIndex((item) => item._id === event._id);
        if (existingIndex >= 0) {
          if (isDeletion) {
            nextItems.splice(existingIndex, 1);
            const nextTotal = Math.max(0, (existing.total ?? nextItems.length) - 1);
            const nextTotalPages = Math.max(1, Math.ceil(Math.max(nextTotal, 1) / limit));
            return { ...existing, items: nextItems, total: nextTotal, totalPages: nextTotalPages };
          }
          nextItems[existingIndex] = { ...nextItems[existingIndex], ...event };
          return { ...existing, items: nextItems };
        }
        if (isDeletion) {
          return existing;
        }
        nextItems.unshift(event);
        if (nextItems.length > limit) {
          nextItems.pop();
        }
        const nextTotal = (existing.total ?? nextItems.length) + 1;
        const nextTotalPages = Math.max(1, Math.ceil(nextTotal / limit));
        return {
          ...existing,
          items: nextItems,
          total: nextTotal,
          totalPages: nextTotalPages
        };
      });
    },
    [queryClient]
  );

  useSubmissionStream({
    enabled: Boolean(user),
    onEvent: handleStreamEvent
  });

  const resubmitMutation = useResubmitSubmission(
    {
      onSuccess: (data, variables) => {
        setResubmittingId(null);
        const submission = data?.submission ?? null;
        if (submission) {
          const event = detailToEvent(submission);
          if (event) {
            handleStreamEvent(event);
          }
          const previousVerdict = variables?.baseSubmission?.verdict ?? null;
          const nextVerdict = submission.verdict ?? null;
          if (previousVerdict && nextVerdict && previousVerdict !== nextVerdict) {
            setMessage({
              type: 'info',
              text: `Verdict updated: ${previousVerdict} → ${nextVerdict}`
            });
          } else {
            setMessage({ type: 'info', text: 'Submission re-run.' });
          }
        } else {
          setMessage({ type: 'info', text: 'Submission re-run.' });
        }
      },
      onError: (error) => {
        setResubmittingId(null);
        setMessage({ type: 'error', text: error.message || 'Failed to re-submit submission.' });
      }
    }
  );

  const deleteMutation = useDeleteSubmission({
    onSuccess: (data) => {
      const submissionId = data?.submissionId;
      setMessage({ type: 'info', text: 'Submission deleted.' });
      if (submissionId) {
        handleStreamEvent({
          _id: submissionId,
          type: 'submission:deleted',
          deletedAt: new Date().toISOString()
        });
      }
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.message || 'Failed to delete submission.' });
    }
  });

  const getSubmissionFromCache = useCallback(
    (id) => {
      if (!id) {
        return null;
      }
      const current = queryClient.getQueryData(queryKey);
      const items = current?.items;
      if (Array.isArray(items)) {
        return items.find((item) => item._id === id) ?? null;
      }
      return null;
    },
    [queryClient, queryKey]
  );

  const handleVerdictClick = useCallback((submissionId) => {
    setActiveSubmissionId(submissionId);
  }, []);

  const handleResubmit = useCallback(
    (submission) => {
      if (!submission?._id) {
        return;
      }
      const isOwner = submission.userId && submission.userId === currentUserId;
      if (!isAdmin && !isOwner) {
        return;
      }
      setMessage(null);
      setResubmittingId(submission._id);
      resubmitMutation.mutate({ submissionId: submission._id, baseSubmission: submission });
    },
    [currentUserId, isAdmin, resubmitMutation]
  );

  const handleDelete = useCallback(
    (submission) => {
      if (!isSuperAdmin || !submission?._id) {
        return;
      }
      setMessage(null);
      setDeletingId(submission._id);
      deleteMutation.mutate(submission._id, {
        onSettled: () => setDeletingId(null)
      });
    },
    [deleteMutation, isSuperAdmin]
  );

  const closeSubmissionModal = useCallback(() => setActiveSubmissionId(null), []);

  const data = submissionsQuery.data ?? {
    items: [],
    total: 0,
    totalPages: 1,
    page: filters.page,
    limit: PAGE_SIZE
  };

  const { items, total, totalPages, page } = data;

  const canPrev = page > 1;
  const canNext = page < totalPages;
  const activeSubmission = activeSubmissionId ? getSubmissionFromCache(activeSubmissionId) : null;
  const canResubmitActiveSubmission = Boolean(
    activeSubmission &&
      (isAdmin || (activeSubmission.userId && activeSubmission.userId === currentUserId))
  );

  const toggleStatus = (value) => {
    setFilters((prev) => {
      const statuses = prev.statuses.includes(value)
        ? prev.statuses.filter((status) => status !== value)
        : [...prev.statuses, value];
      return {
        ...prev,
        statuses,
        page: 1
      };
    });
  };

  const updateFilter = (name, value) => {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
      page: 1
    }));
  };

  const handlePageChange = (nextPage) => {
    setFilters((prev) => ({
      ...prev,
      page: nextPage
    }));
  };

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Submissions</h1>
          <p>Monitor submissions across the platform in real time.</p>
        </div>
      </header>

      <div className="filters-panel">
        <div className="filter-group">
          <span className="filter-label">Status</span>
          <div className="status-filters">
            {STATUS_OPTIONS.map((option) => (
              <label key={option.value} className="checkbox inline">
                <input
                  type="checkbox"
                  checked={filters.statuses.includes(option.value)}
                  onChange={() => toggleStatus(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <label>
            User
            <input
              type="search"
              placeholder="Username or id"
              value={filters.user}
              onChange={(event) => updateFilter('user', event.target.value)}
            />
          </label>
        </div>
        <div className="filter-group">
          <label>
            Problem ID
            <input
              type="number"
              min="1"
              value={filters.problemId}
              onChange={(event) => updateFilter('problemId', event.target.value)}
            />
          </label>
        </div>
        <div className="filter-group date-range">
          <label>
            From
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => updateFilter('dateFrom', event.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => updateFilter('dateTo', event.target.value)}
            />
          </label>
        </div>
      </div>

      {message && (
        <div className={`page-message ${message.type === 'error' ? 'error' : 'info'}`}>
          {message.text}
        </div>
      )}

      {submissionsQuery.isLoading && <div className="page-message">Loading submissions…</div>}
      {submissionsQuery.isError && (
        <div className="page-message error">Failed to fetch submissions.</div>
      )}

      {!submissionsQuery.isLoading && !submissionsQuery.isError && (
        <div className="submissions-table-wrapper">
          <table className="submissions-table">
            <thead>
              <tr>
                <th>Last Run</th>
                <th>User</th>
                <th>Problem</th>
                <th>Language</th>
                <th>Status</th>
                <th>Score</th>
                <th>Runtime (ms)</th>
                <th>Memory (KB)</th>
                {isAdmin ? <th className="actions-header">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const nowMs = Date.now();
                return items.map((submission) => {
                const languageSlug =
                  submission.language ??
                  (submission.languageId != null ? `language-${submission.languageId}` : null);
                const languageLabel =
                  resolveLanguageLabel(
                    submission.languageId,
                    languageSlug ?? (submission.languageId != null ? String(submission.languageId) : null)
                  ) ?? '—';
                const displayUser = submission.userName
                  ? submission.userName
                  : currentUserId && submission.userId === currentUserId
                  ? 'You'
                  : '(deleted user)';
                const lastRunAt =
                  submission.lastRunAt ??
                  submission.finishedAt ??
                  submission.startedAt ??
                  submission.createdAt;
                const isOwner = submission.userId && submission.userId === currentUserId;
                const allowResubmit = submission._id && (isOwner || isAdmin);
                const allowDelete = submission._id && isSuperAdmin;
                const lastRunLabel = formatRelativeOrDate(lastRunAt, nowMs, userTimeZone);
                const lastRunTooltip = lastRunAt ? formatTooltip(lastRunAt, userTimeZone) : '—';

                return (
                  <tr key={submission._id}>
                    <td title={lastRunTooltip}>{lastRunLabel}</td>
                    <td>
                      {submission.userName ? (
                        <Link to={`/u/${submission.userName}`}>{displayUser}</Link>
                      ) : (
                        <span className="muted">{displayUser}</span>
                      )}
                    </td>
                    <td>
                      {submission.problemId ? (
                        <Link to={`/problems/${submission.problemId}`}>
                          #{submission.problemId}{' '}
                          {submission.problemTitle ? `· ${submission.problemTitle}` : ''}
                        </Link>
                      ) : (
                        <span className="muted">Unknown problem</span>
                      )}
                    </td>
                    <td>{languageLabel}</td>
                    <td>
                      <button
                        type="button"
                        className="link-button verdict-link"
                        onClick={() => handleVerdictClick(submission._id)}
                      >
                        <span className={`status-badge ${STATUS_CLASS[submission.status] || ''}`}>
                          {STATUS_LABELS[submission.status] ?? submission.status}
                        </span>
                      </button>
                    </td>
                    <td>{typeof submission.score === 'number' ? `${submission.score}%` : '—'}</td>
                    <td>{submission.runtimeMs ?? '—'}</td>
                    <td>{submission.memoryKB ?? '—'}</td>
                    {isAdmin ? (
                      <td className="submission-actions">
                        {allowResubmit ? (
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => handleResubmit(submission)}
                            disabled={
                              resubmitMutation.isPending && resubmittingId === submission._id
                            }
                          >
                            {resubmitMutation.isPending && resubmittingId === submission._id
                              ? 'Re-submitting…'
                              : 'Re-submit'}
                          </button>
                        ) : !allowDelete ? (
                          <span className="muted">—</span>
                        ) : null}
                        {allowDelete ? (
                          <button
                            type="button"
                            className="danger"
                            onClick={() => handleDelete(submission)}
                            disabled={deleteMutation.isPending && deletingId === submission._id}
                          >
                            {deleteMutation.isPending && deletingId === submission._id
                              ? 'Deleting…'
                              : 'Delete'}
                          </button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                );
              });
              })()}
              {!items.length && (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8}>
                    <div className="page-message">No submissions match the current filters.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!submissionsQuery.isLoading && !submissionsQuery.isError && (
        <footer className="table-footer">
          <div>Showing {items.length} of {total} submissions</div>
          <div className="pagination">
            <button type="button" className="secondary" disabled={!canPrev} onClick={() => handlePageChange(page - 1)}>
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button type="button" className="secondary" disabled={!canNext} onClick={() => handlePageChange(page + 1)}>
              Next
            </button>
          </div>
        </footer>
      )}

      {activeSubmissionId ? (
        <SubmissionViewerModal
          submissionId={activeSubmissionId}
          onClose={closeSubmissionModal}
          allowResubmit={canResubmitActiveSubmission}
          onResubmit={(submissionId) => {
            const baseSubmission = getSubmissionFromCache(submissionId);
            if (baseSubmission) {
              handleResubmit(baseSubmission);
            }
          }}
          isResubmitting={
            resubmitMutation.isPending && resubmittingId === activeSubmissionId
          }
          allowDelete={isSuperAdmin}
          onDelete={(submission) => handleDelete(submission)}
          isDeleting={deleteMutation.isPending && deletingId === activeSubmissionId}
        />
      ) : null}
    </section>
  );
}

export default SubmissionsPage;
