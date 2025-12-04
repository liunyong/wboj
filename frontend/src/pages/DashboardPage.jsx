import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import Heatmap from '../components/Heatmap.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  formatRelativeOrDate,
  formatTooltip,
  getUserTZ
} from '../utils/time.js';
import { applyEventToSubmissionList, detailToEvent } from '../utils/submissions.js';
import { useSubmissionStream } from '../hooks/useSubmissionStream.js';
import { useResubmitSubmission } from '../hooks/useResubmitSubmission.js';
import { useLanguages } from '../hooks/useLanguages.js';
import { useUserProgress, userProgressQueryKey } from '../hooks/useUserProgress.js';
import SubmissionViewerModal from '../components/SubmissionViewerModal.jsx';
import { usePageSeo } from '../hooks/useSeo.js';
import { siteMeta } from '../utils/seo.js';

const currentYear = new Date().getUTCFullYear();
const selectableYears = [currentYear, currentYear - 1, currentYear - 2];

function DashboardPage() {
  const queryClient = useQueryClient();
  const { authFetch, user } = useAuth();
  const { resolveLanguageLabel } = useLanguages();
  const userTimeZone = useMemo(() => getUserTZ(), []);
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

  const progressQuery = useUserProgress();
  const solvedProblems = progressQuery.solved;
  const attemptedProblems = progressQuery.attempted;
  const solvedCount = Array.isArray(solvedProblems) ? solvedProblems.length : Number(solvedProblems || 0);
  const attemptedCount = Array.isArray(attemptedProblems)
    ? attemptedProblems.length
    : Number(attemptedProblems || 0);

  const seoConfig = useMemo(
    () => ({
      title: 'WBOJ Dashboard | Progress Overview',
      titleKo: 'WBOJ 대시보드 | 진행 현황',
      description: `You’ve solved ${solvedCount} challenges this year. Track your coding progress and keep your ${year} streak going strong.`,
      descriptionKo: `올해 ${solvedCount}문제를 해결했습니다. 제출 히트맵으로 학습 진행률을 확인하고 ${year} streak을 이어가세요.`,

      path: '/dashboard',
      ogType: 'profile',
      jsonLd: [
        {
          id: 'dashboard-webapp',
          data: {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'WB Online Judge Dashboard',
            url: `${siteMeta.siteUrl}/dashboard`,
            inLanguage: ['en', 'ko'],
            applicationCategory: 'EducationalApplication',
            operatingSystem: 'Web',
            audience: { '@type': 'Audience', audienceType: 'Competitive programming students' },
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            interactionStatistic: [
              {
                '@type': 'InteractionCounter',
                interactionType: { '@type': 'UseAction', name: 'SolvedProblem' },
                userInteractionCount: solvedCount
              },
              {
                '@type': 'InteractionCounter',
                interactionType: { '@type': 'UseAction', name: 'AttemptedProblem' },
                userInteractionCount: attemptedCount
              }
            ],
            featureList: ['Heatmap', 'Submission history', 'Language trends']
          }
        }
      ]
    }),
    [attemptedCount, solvedCount, year]
  );
  usePageSeo(seoConfig);

  const resubmitMutation = useResubmitSubmission({
    onSuccess: (data, variables) => {
      setResubmittingId(null);
      const submission = data?.submission ?? null;
      if (submission) {
        const event = detailToEvent(submission);
        queryClient.setQueryData(['submissions', 'mine', 'dashboard'], (entries) =>
          applyEventToSubmissionList(Array.isArray(entries) ? entries : [], event)
        );
        if (submission.verdict && submission.verdict !== 'PENDING') {
          queryClient.invalidateQueries({ queryKey: userProgressQueryKey });
        }

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
      const verdict = event.verdict ?? null;
      const status = event.status ?? null;
      const finalVerdict =
        verdict && verdict !== 'PENDING'
          ? verdict
          : status && !['queued', 'running'].includes(status)
          ? status
          : null;
      if (finalVerdict) {
        queryClient.invalidateQueries({ queryKey: userProgressQueryKey });
      }
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
  const getAttemptedVerdictBadge = (entry) => {
    const verdict = entry?.latestVerdict ?? null;
    if (verdict && verdict !== 'PENDING') {
      const key = verdict.toLowerCase();
      return {
        label: verdict,
        className: `verdict verdict-${key}`
      };
    }

    const status = entry?.latestStatus ?? null;
    if (!status) {
      return null;
    }

    const normalized = status.toLowerCase();
    const statusMap = {
      accepted: 'AC',
      wrong_answer: 'WA',
      tle: 'TLE',
      rte: 'RTE',
      ce: 'CE',
      mle: 'MLE',
      failed: 'IE'
    };
    const mapped = statusMap[normalized];
    if (!mapped || mapped === 'PENDING') {
      return null;
    }
    return {
      label: mapped,
      className: `verdict verdict-${mapped.toLowerCase()}`
    };
  };

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
        <h2>Problem Progress</h2>
        {progressQuery.isLoading || progressQuery.isIdle ? (
          <div className="page-message">Loading progress…</div>
        ) : progressQuery.isError ? (
          <div className="page-message error">Failed to load progress.</div>
        ) : (
          <div className="dashboard-progress">
            <section className="dashboard-progress__group">
              <header className="dashboard-progress__header">
                <h3>Solved Problems</h3>
                <span className="dashboard-progress__count">{solvedProblems.length}</span>
              </header>
              {solvedProblems.length ? (
                <ul className="dashboard-progress__chips">
                  {solvedProblems.map((problem) => (
                    <li key={problem.problemId}>
                      <Link
                        to={`/problems/${problem.problemId}`}
                        className="dashboard-progress__chip"
                      >
                        <span className="dashboard-progress__chip-id">
                          #{problem.problemId}
                        </span>
                        <span className="dashboard-progress__chip-title">{problem.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dashboard-progress__empty">No solved problems yet.</p>
              )}
            </section>

            <section className="dashboard-progress__group">
              <header className="dashboard-progress__header">
                <h3>Attempted (Not Accepted Yet)</h3>
                <span className="dashboard-progress__count">{attemptedProblems.length}</span>
              </header>
              {attemptedProblems.length ? (
                <ul className="dashboard-progress__list">
                  {attemptedProblems.map((problem) => {
                    const badge = getAttemptedVerdictBadge(problem);
                    return (
                      <li key={problem.problemId} className="dashboard-progress__attempted-item">
                        <Link to={`/problems/${problem.problemId}`}>
                          #{problem.problemId} {problem.title}
                        </Link>
                        {badge ? <span className={badge.className}>{badge.label}</span> : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="dashboard-progress__empty">No pending attempts right now.</p>
              )}
            </section>
          </div>
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
              {(() => {
                const nowMs = Date.now();
                return submissionsQuery.data.map((submission) => {
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
                const lastRunLabel = formatRelativeOrDate(lastRunAt, nowMs, userTimeZone);
                const lastRunTooltip = lastRunAt ? formatTooltip(lastRunAt, userTimeZone) : '—';
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
                    <td title={lastRunTooltip}>{lastRunLabel}</td>
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
                });
              })()}
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
