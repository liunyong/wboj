import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import Heatmap from '../components/Heatmap.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDateTime } from '../utils/date.js';
import { applyEventToSubmissionList, detailToEvent } from '../utils/submissions.js';
import { useSubmissionStream } from '../hooks/useSubmissionStream.js';
import { useResubmitSubmission } from '../hooks/useResubmitSubmission.js';
import { useLanguages } from '../hooks/useLanguages.js';
import SubmissionViewerModal from '../components/SubmissionViewerModal.jsx';

const currentYear = new Date().getUTCFullYear();
const selectableYears = [currentYear, currentYear - 1, currentYear - 2];

function DashboardPage() {
  const queryClient = useQueryClient();
  const { authFetch, user } = useAuth();
  const { resolveLanguageLabel } = useLanguages();
  const [year, setYear] = useState(currentYear);
  const [message, setMessage] = useState(null);
  const [activeSubmissionId, setActiveSubmissionId] = useState(null);
  const [resubmittingId, setResubmittingId] = useState(null);

  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary', year],
    queryFn: async () => authFetch(`/api/dashboard/me/summary?year=${year}`)
  });

  const heatmapQuery = useQuery({
    queryKey: ['dashboard', 'heatmap', year],
    queryFn: async () => authFetch(`/api/dashboard/me/heatmap?year=${year}`)
  });

  const submissionsQuery = useQuery({
    queryKey: ['submissions', 'mine', 'dashboard'],
    queryFn: async () => {
      const response = await authFetch('/api/submissions/mine');
      return response?.items ?? [];
    }
  });

  const resubmitMutation = useResubmitSubmission({
    onSuccess: (data, variables) => {
      setResubmittingId(null);
      const submission = data?.submission ?? null;
      if (submission) {
        const event = detailToEvent(submission);
        queryClient.setQueryData(['submissions', 'mine', 'dashboard'], (entries) =>
          applyEventToSubmissionList(Array.isArray(entries) ? entries : [], event)
        );

        const previousVerdict = variables?.baseSubmission?.verdict ?? null;
        const nextVerdict = submission.verdict ?? null;
        if (previousVerdict && nextVerdict && previousVerdict !== nextVerdict) {
          setMessage({ type: 'info', text: `Verdict updated: ${previousVerdict} → ${nextVerdict}` });
        } else {
          setMessage({ type: 'info', text: 'Submission re-run.' });
        }
      } else {
        setMessage({ type: 'info', text: 'Submission re-run.' });
      }
    },
    onError: (error) => {
      setResubmittingId(null);
      setMessage({ type: 'error', text: error.message || 'Failed to re-submit solution.' });
    }
  });

  const handleSubmissionEvent = useCallback(
    (event) => {
      if (!event || !user?.id || event.userId !== user.id) {
        return;
      }
      queryClient.setQueryData(['submissions', 'mine', 'dashboard'], (entries) =>
        applyEventToSubmissionList(Array.isArray(entries) ? entries : [], event)
      );
    },
    [queryClient, user?.id]
  );

  useSubmissionStream({
    enabled: Boolean(user),
    onEvent: handleSubmissionEvent
  });

  const getSubmissionFromCache = useCallback(
    (id) => {
      if (!id) {
        return null;
      }
      const data = queryClient.getQueryData(['submissions', 'mine', 'dashboard']);
      if (Array.isArray(data)) {
        return data.find((item) => (item.id ?? item._id) === id) ?? null;
      }
      return null;
    },
    [queryClient]
  );

  const handleVerdictClick = useCallback((submissionId) => {
    setActiveSubmissionId(submissionId);
  }, []);

  const handleResubmit = useCallback(
    (submission) => {
      const submissionId = submission?.id ?? submission?._id;
      if (!submissionId) {
        return;
      }
      setMessage(null);
      setResubmittingId(submissionId);
      resubmitMutation.mutate({ submissionId, baseSubmission: submission });
    },
    [resubmitMutation]
  );

  const closeSubmissionModal = useCallback(() => setActiveSubmissionId(null), []);

  const activeSubmission = activeSubmissionId ? getSubmissionFromCache(activeSubmissionId) : null;
  const canResubmitActiveSubmission = Boolean(activeSubmission);

  const summary = summaryQuery.data ?? {};
  const heatmapData = heatmapQuery.data?.items ?? [];

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Track your yearly progress and submission history.</p>
        </div>
        <div className="page-controls">
          <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {selectableYears.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </header>

      {summaryQuery.isLoading ? (
        <div className="page-message">Loading summary…</div>
      ) : (
        <div className="summary-grid">
          <SummaryCard label="Total Submissions" value={summary.totalSubmissions ?? 0} />
          <SummaryCard label="Accepted" value={summary.totalAC ?? 0} accent="success" />
          <SummaryCard label="Wrong Answer" value={summary.totalWA ?? 0} />
          <SummaryCard label="Time Limit" value={summary.totalTLE ?? 0} />
          <SummaryCard label="Runtime Error" value={summary.totalRTE ?? 0} />
          <SummaryCard label="Compile Error" value={summary.totalCE ?? 0} />
        </div>
      )}

      <article className="dashboard-section">
        <h2>Yearly Activity</h2>
        {heatmapQuery.isLoading ? (
          <div className="page-message">Loading activity…</div>
        ) : (
          <Heatmap year={year} items={heatmapData} />
        )}
      </article>

      <article className="dashboard-section">
        <h2>Recent Submissions</h2>
        {message && (
          <div className={`page-message ${message.type === 'error' ? 'error' : 'info'}`}>
            {message.text}
          </div>
        )}
        {submissionsQuery.isLoading && <div className="page-message">Loading…</div>}
        {!submissionsQuery.isLoading && !submissionsQuery.data?.length && (
          <div className="page-message">No submissions recorded yet.</div>
        )}
        {submissionsQuery.data?.length ? (
          <table className="submissions-table">
            <thead>
              <tr>
                <th>Problem</th>
                <th>Status</th>
                <th>Score</th>
                <th>Language</th>
                <th>Last Run</th>
                <th className="actions-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissionsQuery.data.map((submission) => {
                const submissionKey = submission.id ?? submission._id;
                const problemLinkId = submission.problem?.problemId;
                const isProcessing =
                  submission.status === 'queued' || submission.status === 'running';
                const displayVerdict = isProcessing
                  ? 'Grading…'
                  : submission.verdict ?? submission.status;
                const verdictClassKey = submission.verdict
                  ? submission.verdict.toLowerCase()
                  : submission.status ?? 'pending';
                const languageSlug =
                  submission.language ??
                  (submission.languageId != null ? `language-${submission.languageId}` : null);
                const displayLanguage =
                  resolveLanguageLabel(
                    submission.languageId,
                    languageSlug ?? (submission.languageId != null ? String(submission.languageId) : null)
                  ) ?? '—';
                const submittedAt = submission.submittedAt ?? submission.createdAt;
                const lastRunAt =
                  submission.lastRunAt ??
                  submission.finishedAt ??
                  submission.startedAt ??
                  submittedAt;
                const isResubmitPending =
                  resubmittingId === submissionKey && resubmitMutation.isPending;

                return (
                  <tr key={submissionKey}>
                    <td>
                      {submission.problem?.title && problemLinkId ? (
                        <Link to={`/problems/${problemLinkId}`}>
                          {submission.problem.title} (#{problemLinkId})
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="link-button verdict-link"
                        onClick={() => handleVerdictClick(submissionKey)}
                      >
                        <span className={`verdict verdict-${verdictClassKey}`}>{displayVerdict}</span>
                      </button>
                    </td>
                    <td>{
                      typeof submission.score === 'number' ? `${submission.score}%` : '—'
                    }</td>
                    <td>{displayLanguage}</td>
                    <td>{formatDateTime(lastRunAt)}</td>
                    <td className="submission-actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => handleResubmit(submission)}
                        disabled={isResubmitPending}
                      >
                        {isResubmitPending ? 'Re-submitting…' : 'Re-submit'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </article>
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
        />
      ) : null}
    </section>
  );
}

function SummaryCard({ label, value, accent }) {
  return (
    <div className={`summary-card ${accent ? `summary-${accent}` : ''}`}>
      <div className="summary-card__value">{value}</div>
      <div className="summary-card__label">{label}</div>
    </div>
  );
}

export default DashboardPage;
