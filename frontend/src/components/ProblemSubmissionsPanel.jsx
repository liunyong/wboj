import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { useSubmissionStream } from '../hooks/useSubmissionStream.js';
import { applyEventToSubmissionList } from '../utils/submissions.js';
import { formatDateTime } from '../utils/date.js';

const PAGE_SIZE = 20;

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

const DEFAULT_RESULT = {
  items: [],
  total: 0,
  totalPages: 1,
  page: 1,
  limit: PAGE_SIZE,
  scope: 'mine'
};

const buildQueryKey = (problemId, scope, page) => [
  'problemSubmissions',
  problemId,
  scope,
  { page }
];

const mapSubmissionRow = (row, problem) => ({
  ...row,
  id: row.id ?? row._id,
  _id: row._id ?? row.id,
  problemId: row.problemId ?? problem.problemId,
  problemTitle: row.problemTitle ?? problem.title ?? row.problemTitle,
  userName: row.userName ?? row.user?.username ?? row.userName,
  status: row.status ?? row.verdict ?? 'queued'
});

function ProblemSubmissionsPanel({
  problem,
  currentUserId,
  isAdmin,
  onVerdictClick,
  onResubmit,
  resubmittingId,
  isResubmitPending
}) {
  const problemId = problem?.problemId;
  const queryClient = useQueryClient();
  const { authFetch } = useAuth();
  const [activeScope, setActiveScope] = useState('mine');
  const [pageByScope, setPageByScope] = useState({ mine: 1, all: 1 });

  const isReady = Boolean(problemId && currentUserId);

  const fetchSubmissions = useCallback(
    async ({ scope, page }) => {
      if (!problemId) {
        return { ...DEFAULT_RESULT, scope, page };
      }
      const params = new URLSearchParams();
      params.set('scope', scope);
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));
      params.set('sort', '-createdAt');
      const response = await authFetch(
        `/api/problems/${problemId}/submissions?${params.toString()}`
      );
      const payload =
        response ?? {
          items: [],
          total: 0,
          totalPages: 1,
          page,
          limit: PAGE_SIZE,
          scope
        };

      return {
        ...payload,
        scope,
        items: Array.isArray(payload.items)
          ? payload.items.map((item) => mapSubmissionRow(item, problem))
          : []
      };
    },
    [authFetch, problem, problemId]
  );

  const currentPage = pageByScope[activeScope] ?? 1;

  const queryKey = useMemo(
    () => buildQueryKey(problemId, activeScope, currentPage),
    [problemId, activeScope, currentPage]
  );

  const submissionsQuery = useQuery({
    queryKey,
    queryFn: () => fetchSubmissions({ scope: activeScope, page: currentPage }),
    enabled: isReady,
    keepPreviousData: true,
    staleTime: 0
  });

  const applyEventToQueries = useCallback(
    (event) => {
      if (!event || event.problemId !== problemId) {
        return;
      }

      queryClient.setQueriesData(
        { queryKey: ['problemSubmissions', problemId] },
        (existing, query) => {
          if (!existing) {
            return existing;
          }

          const scopeKey = query.queryKey?.[2] ?? 'mine';
          const params = query.queryKey?.[3] ?? {};
          const pageValue = params?.page ?? existing.page ?? 1;
          const limit = existing.limit ?? PAGE_SIZE;
          const items = Array.isArray(existing.items) ? existing.items : [];
          const isMineScope = scopeKey === 'mine';
          const belongsToUser = event.userId && event.userId === currentUserId;

          if (isMineScope && !belongsToUser) {
            return existing;
          }

          const allowInsert = pageValue === 1;
          const existed = items.some((item) => (item.id ?? item._id) === event._id);

          const nextItems = applyEventToSubmissionList(items, event, {
            maxItems: allowInsert ? limit : null,
            allowInsert,
            problem
          });

          if (nextItems === items) {
            return existing;
          }

          let nextTotal = existing.total ?? items.length;
          let nextTotalPages = existing.totalPages ?? Math.max(1, Math.ceil(nextTotal / limit));
          if (!existed && allowInsert) {
            nextTotal += 1;
            nextTotalPages = Math.max(1, Math.ceil(nextTotal / limit));
          }

          return {
            ...existing,
            items: nextItems,
            total: nextTotal,
            totalPages: nextTotalPages
          };
        }
      );

      if (event.userId === currentUserId) {
        queryClient.setQueryData(['submissions', 'mine', 'dashboard'], (entries) =>
          applyEventToSubmissionList(Array.isArray(entries) ? entries : [], event, {
            problem
          })
        );
      }
    },
    [currentUserId, problem, problemId, queryClient]
  );

  useSubmissionStream({
    enabled: isReady,
    onEvent: applyEventToQueries,
    streamPath: problemId ? `/api/problems/${problemId}/submissions/stream` : undefined
  });

  const handleScopeChange = (scope) => {
    if (scope === activeScope) {
      return;
    }
    setActiveScope(scope);
  };

  const handlePageChange = (scope, page) => {
    setPageByScope((prev) => ({
      ...prev,
      [scope]: page
    }));
  };

  const data = submissionsQuery.data ?? {
    ...DEFAULT_RESULT,
    scope: activeScope,
    page: currentPage
  };

  const { items, total, totalPages, page } = data;
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <article className="problem-section">
      <header className="submissions-panel__header">
        <h3>Submissions</h3>
        <div className="submissions-panel__tabs">
          <button
            type="button"
            className={activeScope === 'mine' ? 'active' : ''}
            onClick={() => handleScopeChange('mine')}
          >
            My Submissions
          </button>
          <button
            type="button"
            className={activeScope === 'all' ? 'active' : ''}
            onClick={() => handleScopeChange('all')}
          >
            All Submissions
          </button>
        </div>
      </header>

      {submissionsQuery.isLoading && <div className="page-message">Loading submissions…</div>}
      {submissionsQuery.isError && (
        <div className="page-message error">Failed to load submissions.</div>
      )}

      {!submissionsQuery.isLoading && !submissionsQuery.isError && (
        <div className="submissions-table-wrapper">
          <table className="submissions-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Language</th>
                <th>Status</th>
                <th>Score</th>
                <th>Runtime (ms)</th>
                <th>Memory (KB)</th>
                {(isAdmin || activeScope === 'mine') && <th className="actions-header">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((submission) => {
                const isOwner = submission.userId === currentUserId;
                const displayUser = submission.userName || (isOwner ? 'You' : '(unknown)');
                const languageLabel =
                  submission.language ??
                  (submission.languageId != null ? `language-${submission.languageId}` : '—');

                const allowResubmit =
                  (isOwner || isAdmin) && (activeScope === 'mine' ? isOwner : true);

                return (
                  <tr key={submission._id}>
                    <td>{formatDateTime(submission.createdAt)}</td>
                    <td>
                      {submission.userName ? (
                        <Link to={`/u/${submission.userName}`}>{displayUser}</Link>
                      ) : (
                        <span className="muted">{displayUser}</span>
                      )}
                    </td>
                    <td>{languageLabel}</td>
                    <td>
                      <button
                        type="button"
                        className="link-button verdict-link"
                        onClick={() => onVerdictClick(submission._id)}
                      >
                        <span
                          className={`status-badge ${STATUS_CLASS[submission.status] || ''}`}
                        >
                          {STATUS_LABELS[submission.status] ?? submission.status}
                        </span>
                      </button>
                    </td>
                    <td>
                      {typeof submission.score === 'number' ? `${submission.score}%` : '—'}
                    </td>
                    <td>{submission.runtimeMs ?? '—'}</td>
                    <td>{submission.memoryKB ?? '—'}</td>
                    {(isAdmin || activeScope === 'mine') && (
                      <td className="submission-actions">
                        {allowResubmit ? (
                          <button
                            type="button"
                            className="secondary"
                            onClick={() =>
                              onResubmit({
                                ...submission,
                                id: submission.id ?? submission._id,
                                problem: {
                                  id: problem?._id ?? problem?.id ?? null,
                                  title: problem?.title ?? submission.problemTitle ?? null,
                                  problemId: problem?.problemId ?? submission.problemId ?? null
                                }
                              })
                            }
                            disabled={
                              isResubmitPending && resubmittingId === submission._id
                            }
                          >
                            {isResubmitPending && resubmittingId === submission._id
                              ? 'Re-submitting…'
                              : 'Re-submit'}
                          </button>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {!items.length && (
                <tr>
                  <td colSpan={(isAdmin || activeScope === 'mine') ? 8 : 7}>
                    <div className="page-message">No submissions to display.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!submissionsQuery.isLoading && !submissionsQuery.isError && items.length > 0 && (
        <footer className="table-footer">
          <div>
            Showing {items.length} of {total} submissions
          </div>
          <div className="pagination">
            <button
              type="button"
              className="secondary"
              disabled={!canPrev}
              onClick={() => handlePageChange(activeScope, page - 1)}
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="secondary"
              disabled={!canNext}
              onClick={() => handlePageChange(activeScope, page + 1)}
            >
              Next
            </button>
          </div>
        </footer>
      )}
    </article>
  );
}

export default ProblemSubmissionsPanel;
