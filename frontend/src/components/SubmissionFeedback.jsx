import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext.jsx';
import { isPendingStatus, STATUS_LABELS } from '../utils/submissionStatus.js';

export const hasFinalResult = (submission) => Boolean(
  submission?.status && !isPendingStatus(submission.status)
);

const VERDICT_LABELS = {
  WA: 'Wrong Answer', TLE: 'Time Limit Exceeded', RTE: 'Runtime Error',
  CE: 'Compile Error', MLE: 'Memory Limit Exceeded', PE: 'Presentation Error',
  IE: 'Judge Error', PARTIAL: 'Partial Credit'
};

function AcceptedCelebration() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible) return null;

  return <>
    <div className="accepted-confetti" aria-hidden="true">
      {Array.from({ length: 36 }, (_, index) => <i key={index} style={{
        '--x': `${(index * 37) % 100}%`,
        '--drift': `${((index * 29) % 180) - 90}px`,
        '--delay': `${(index % 6) * 0.08}s`,
        '--spin': `${index % 2 ? 420 : -360}deg`,
        '--confetti-color': ['#e9bb45', '#3a9770', '#5d9bcd', '#c286b5'][index % 4]
      }} />)}
    </div>
    <aside className="accepted-toast" aria-label="Submission accepted">
      <span className="accepted-toast__check" aria-hidden="true">✓</span>
      <div><strong>Accepted!</strong><p>All test cases passed. Great work!</p></div>
      <button type="button" className="accepted-toast__close" aria-label="Dismiss celebration" onClick={() => setVisible(false)}>×</button>
    </aside>
  </>;
}

export default function SubmissionFeedback({ submissionId, cachedSubmission, onResolved, onViewResult }) {
  const { authFetch } = useAuth();
  const [result, setResult] = useState(null);
  const completedRef = useRef(false);
  const resultQuery = useQuery({
    queryKey: ['submission', submissionId],
    queryFn: async () => {
      const response = await authFetch(`/api/submissions/${submissionId}`);
      if (!response?.submission) throw new Error('Submission result is unavailable');
      return response.submission;
    },
    enabled: !result && !hasFinalResult(cachedSubmission),
    // The stream normally supplies the result; polling also covers missed events.
    refetchInterval: (query) => hasFinalResult(query.state.data) ||
      [401, 403, 404].includes(query.state.error?.status) ? false : 2000,
    retry: false,
    staleTime: 0
  });
  const submission = result ?? (hasFinalResult(cachedSubmission) ? cachedSubmission : resultQuery.data);
  const complete = hasFinalResult(submission);
  const accepted = complete && submission.status === 'accepted' &&
    (!submission.verdict || submission.verdict === 'AC');

  useEffect(() => {
    if (!complete || completedRef.current) return;
    completedRef.current = true;
    setResult(submission);
    onResolved(submission);
  }, [complete, onResolved, submission]);

  const label = VERDICT_LABELS[submission?.verdict] ?? STATUS_LABELS[submission?.status] ?? 'Grading finished';
  const text = accepted ? 'Accepted — all test cases passed. Great work!' : complete
    ? `${label}. ${submission?.verdict === 'IE' ? 'Please try again later.' : 'Review the results and try again.'}`
    : resultQuery.isError ? 'Unable to check the result. Retry or open the submission details.'
    : 'Submitted. Grading…';

  return <>
    <div className={`form-message submission-feedback ${accepted ? 'success' : complete || resultQuery.isError ? 'warning' : 'info'}`}>
      <span role="status" aria-live="polite">{text}</span>
      <div className="submission-feedback__actions">
        {resultQuery.isError && !complete && <button type="button" className="link-button" onClick={() => resultQuery.refetch()}>Retry</button>}
        <button type="button" className="link-button" onClick={() => onViewResult(submissionId)}>View result</button>
      </div>
    </div>
    {accepted && <AcceptedCelebration />}
  </>;
}
