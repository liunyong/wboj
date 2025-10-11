import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { formatDateTime } from '../utils/date.js';
import { highlightSource } from '../utils/highlight.js';

function SubmissionViewerModal({
  submissionId,
  onClose,
  allowResubmit = false,
  onResubmit,
  isResubmitting = false
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

  const submission = submissionQuery.data;
  const canViewSource = submission?.canViewSource ?? Boolean(submission?.source);
  const codeHtml = canViewSource && submission?.source ? highlightSource(submission.source) : '';

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
                <span>{submission.language ?? submission.languageId ?? '—'}</span>
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
                <span className="label">Submitted</span>
                <span>{formatDateTime(submission.createdAt ?? submission.queuedAt)}</span>
              </div>
            </div>

            <div className="submission-modal__code">
              {canViewSource ? (
                <pre>
                  <code
                    className="code-block"
                    dangerouslySetInnerHTML={{ __html: codeHtml || '/* No source available */' }}
                  />
                </pre>
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
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default SubmissionViewerModal;
