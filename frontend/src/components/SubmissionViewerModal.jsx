import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import {
  formatRelativeOrDate,
  formatTooltip,
  getUserTZ
} from '../utils/time.js';
import { useLanguages } from '../hooks/useLanguages.js';
import CodeBlock from './CodeBlock.jsx';

const RUN_STATUS_LABELS = {
  accepted: 'Accepted',
  wrong_answer: 'Wrong Answer',
  tle: 'Time Limit',
  rte: 'Runtime Error',
  ce: 'Compile Error',
  failed: 'Failed',
  queued: 'Queued',
  running: 'Grading…'
};

function SubmissionViewerModal({
  submissionId,
  onClose,
  allowResubmit = false,
  onResubmit,
  isResubmitting = false,
  allowDelete = false,
  onDelete,
  isDeleting = false
}) {
  const { authFetch } = useAuth();

  const submissionQuery = useQuery({
    queryKey: ['submission', submissionId],
    queryFn: async () => {
      const response = await authFetch(`/api/submissions/${submissionId}`);
      return response?.submission ?? null;
    },
    enabled: Boolean(submissionId),
    staleTime: 0
  });

  const { resolveLanguageLabel } = useLanguages();

  const submission = submissionQuery.data;
  const userTimeZone = getUserTZ();
  const nowMs = Date.now();
  const canViewSource = submission?.canViewSource ?? Boolean(submission?.source);
  const codeText =
    canViewSource && typeof submission?.source === 'string' && submission.source.length
      ? submission.source
      : '';
  const runHistory = Array.isArray(submission?.runs)
    ? submission.runs
        .slice()
        .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
    : [];
  const languageSlug =
    submission?.language ??
    (submission?.languageId != null ? `language-${submission.languageId}` : null);

  const lastRunAtIso =
    submission?.lastRunAt ??
    submission?.finishedAt ??
    submission?.startedAt ??
    submission?.createdAt ??
    null;
  const submittedAtIso = submission?.createdAt ?? submission?.queuedAt ?? null;
  const lastRunLabel = lastRunAtIso ? formatRelativeOrDate(lastRunAtIso, nowMs, userTimeZone) : '—';
  const lastRunTooltip = lastRunAtIso ? formatTooltip(lastRunAtIso, userTimeZone) : '—';
  const submittedLabel = submittedAtIso
    ? formatRelativeOrDate(submittedAtIso, nowMs, userTimeZone)
    : '—';
  const submittedTooltip = submittedAtIso ? formatTooltip(submittedAtIso, userTimeZone) : '—';

  let displayLanguageLabel = '—';
  if (submission) {
    const fallbackLabel =
      languageSlug ??
      (submission.languageId != null ? String(submission.languageId) : submission.languageCode ?? null);
    const resolvedLabel = resolveLanguageLabel(submission.languageId, fallbackLabel);
    displayLanguageLabel =
      resolvedLabel ??
      (submission.languageId != null ? `language-${submission.languageId}` : submission.language ?? '—');
  }

  const handleResubmit = () => {
    if (!submissionId || !onResubmit) {
      return;
    }
    onResubmit(submissionId);
  };

  return (
    <div className="confirm-modal-backdrop" role="presentation">
      <div className="confirm-modal submission-modal" role="dialog" aria-modal="true">
        <header className="submission-modal__header">
          <h2>Submission Details</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </header>

        {submissionQuery.isLoading && <div className="submission-modal__status">Loading…</div>}
        {submissionQuery.isError && (
          <div className="submission-modal__status error">Failed to load submission.</div>
        )}

        {submission && (
          <div className="submission-modal__body">
            <div className="submission-modal__meta">
              <div>
                <span className="label">Problem</span>
                {submission.problemId ? (
                  <Link to={`/problems/${submission.problemId}`} onClick={onClose}>
                    #{submission.problemId}{' '}
                    {submission.problemTitle ? `· ${submission.problemTitle}` : ''}
                  </Link>
                ) : (
                  <span>—</span>
                )}
              </div>
              <div>
                <span className="label">Language</span>
                <span>{displayLanguageLabel}</span>
              </div>
              <div>
                <span className="label">Status</span>
                <span className={`status-text status-${submission.status}`}>
                  {submission.status}
                </span>
              </div>
              <div>
                <span className="label">Score</span>
                <span>{typeof submission.score === 'number' ? `${submission.score}%` : '—'}</span>
              </div>
              <div>
                <span className="label">Runtime</span>
                <span>{submission.runtimeMs != null ? `${submission.runtimeMs} ms` : '—'}</span>
              </div>
              <div>
                <span className="label">Memory</span>
                <span>{submission.memoryKB != null ? `${submission.memoryKB} KB` : '—'}</span>
              </div>
              <div>
                <span className="label">Last Run</span>
                <span title={lastRunTooltip}>{lastRunLabel}</span>
              </div>
              <div>
                <span className="label">Submitted</span>
                <span title={submittedTooltip}>{submittedLabel}</span>
              </div>
            </div>

            {runHistory.length ? (
              <div className="submission-modal__history">
                <h3>Run History</h3>
                <ul>
                  {runHistory.map((run, index) => {
                    const runStatus = run.status?.status ?? run.status ?? '';
                    const statusLabel = RUN_STATUS_LABELS[runStatus] ?? runStatus ?? '—';
                    return (
                      <li key={`${run.at ?? index}`}
                        className="submission-modal__history-item"
                      >
                        <div className="history-row">
                          <span
                            className="history-time"
                            title={run.at ? formatTooltip(run.at, userTimeZone) : undefined}
                          >
                            {run.at ? formatRelativeOrDate(run.at, nowMs, userTimeZone) : 'Unknown time'}
                          </span>
                          <span className={`status-badge ${runStatus ? `status-${runStatus}` : ''}`}>
                            {statusLabel}
                          </span>
                          {run.status?.verdict && (
                            <span className="history-verdict">{run.status.verdict}</span>
                          )}
                        </div>
                        <div className="history-metrics">
                          <span>{run.time != null ? `${run.time} ms` : '—'}</span>
                          <span>·</span>
                          <span>{run.memory != null ? `${run.memory} KB` : '—'}</span>
                          {run.status?.error ? (
                            <span className="history-error">{run.status.error}</span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div className="submission-modal__code">
              {canViewSource ? (
                <CodeBlock
                  code={codeText || '/* No source available */'}
                  language={languageSlug}
                />
              ) : (
                <div className="submission-modal__private">
                  Source is private to the owner and administrators.
                </div>
              )}
            </div>
          </div>
        )}

        <div className="confirm-modal__actions submission-modal__actions">
          {allowResubmit && onResubmit ? (
            <button
              type="button"
              className="primary"
              onClick={handleResubmit}
              disabled={isResubmitting || submissionQuery.isLoading}
            >
              {isResubmitting ? 'Re-submitting…' : 'Re-submit'}
            </button>
          ) : null}
          {allowDelete && onDelete ? (
            <button
              type="button"
              className="danger"
              onClick={() => submission && onDelete(submission)}
              disabled={!submission || isDeleting || submissionQuery.isLoading}
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </button>
          ) : null}
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default SubmissionViewerModal;
