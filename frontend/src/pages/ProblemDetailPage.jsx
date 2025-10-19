import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { applyEventToSubmissionList, buildOptimisticSubmission } from '../utils/submissions.js';
import { useResubmitSubmission } from '../hooks/useResubmitSubmission.js';
import { useDeleteSubmission } from '../hooks/useDeleteSubmission.js';
import { useLanguages } from '../hooks/useLanguages.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import ProblemSubmissionsPanel from '../components/ProblemSubmissionsPanel.jsx';
import SubmissionViewerModal from '../components/SubmissionViewerModal.jsx';
import { detailToEvent } from '../utils/submissions.js';

function ProblemDetailPage() {
  const { problemId } = useParams();
  const { authFetch, user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [languageId, setLanguageId] = useState('');
  const [sourceCode, setSourceCode] = useState('');
  const [message, setMessage] = useState(null);
  const [pendingDeletion, setPendingDeletion] = useState(false);
  const [activeSubmissionId, setActiveSubmissionId] = useState(null);
  const [resubmittingId, setResubmittingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const isAdmin = ['admin', 'super_admin'].includes(user?.role);
  const isSuperAdmin = user?.role === 'super_admin';
  const currentUserId = user?.id ?? null;

  const updatePersonalHistory = useCallback(
    (mutator) => {
      queryClient.setQueryData(['submissions', 'mine', 'dashboard'], (existing) => {
        const current = Array.isArray(existing) ? existing : [];
        return mutator(current);
      });
    },
    [queryClient]
  );

  const includePrivate = isAdmin ? 'true' : 'false';

  const problemQuery = useQuery({
    queryKey: ['problem', problemId, includePrivate],
    queryFn: async () => {
      const suffix = includePrivate === 'true' ? '?includePrivate=true' : '';
      const response = await authFetch(`/api/problems/${problemId}${suffix}`);
      if (!response) {
        throw new Error('Problem not found');
      }
      return response;
    }
  });

  const languagesQuery = useLanguages();
  const submissionMutation = useMutation({
    mutationFn: async () => {
      if (!problemQuery.data?._id) {
        throw new Error('Problem identifier missing');
      }
      const payload = {
        problemId: problemQuery.data._id,
        languageId: Number(languageId),
        sourceCode
      };
      return authFetch('/api/submissions', { method: 'POST', body: payload });
    },
    onSuccess: (data) => {
      const submissionId = data?.submissionId;
      const numericLanguageId = Number(languageId);
      const languageName =
        allowedLanguages.find((lang) => lang.id === numericLanguageId)?.name ??
        (Number.isFinite(numericLanguageId) ? `language-${numericLanguageId}` : null);

      if (submissionId && problem) {
        const optimistic = buildOptimisticSubmission({
          submissionId,
          problem,
          languageId: numericLanguageId,
          language: languageName,
          sourceLen: sourceCode.length
        });
        updatePersonalHistory((entries) => {
          const filtered = entries.filter((item) => (item.id ?? item._id) !== submissionId);
          return [optimistic, ...filtered];
        });
      }

      if (problem?.problemId) {
        queryClient.invalidateQueries({ queryKey: ['problemSubmissions', problem.problemId] });
      }

      setMessage({ type: 'info', text: 'Submitted. Grading…' });
      setSourceCode('');
    },
    onError: (error) => {
      setMessage({ type: 'error', text: error.message || 'Failed to submit solution.' });
    }
  });

const resubmitMutation = useResubmitSubmission({
  onSuccess: (data, variables) => {
      setResubmittingId(null);
      const submission = data?.submission ?? null;
      if (submission) {
        const event = detailToEvent(submission);
        if (event && problem?.problemId) {
          queryClient.invalidateQueries({ queryKey: ['problemSubmissions', problem.problemId] });
        }
        updatePersonalHistory((entries) =>
          applyEventToSubmissionList(Array.isArray(entries) ? entries : [], event, { problem })
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

  const deleteSubmissionMutation = useDeleteSubmission({
    onSuccess: (data) => {
      const submissionId = data?.submissionId;
      setDeletingId(null);
      setMessage({ type: 'info', text: 'Submission deleted.' });
      if (problem?.problemId) {
        queryClient.invalidateQueries({ queryKey: ['problemSubmissions', problem.problemId] });
      }
      if (submissionId) {
        updatePersonalHistory((entries) =>
          Array.isArray(entries)
            ? entries.filter((item) => (item.id ?? item._id) !== submissionId)
            : entries
        );
        if (submissionId === activeSubmissionId) {
          setActiveSubmissionId(null);
        }
      }
    },
    onError: (error) => {
      setDeletingId(null);
      setMessage({ type: 'error', text: error.message || 'Failed to delete submission.' });
    }
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: ({ problemId: targetProblemId, isPublic }) =>
      authFetch(`/api/problems/${targetProblemId}/visibility`, {
        method: 'PATCH',
        body: { isPublic }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['problem', problemId] });
      queryClient.invalidateQueries({ queryKey: ['problems'] });
    }
  });

  const deleteProblemMutation = useMutation({
    mutationFn: (targetProblemId) =>
      authFetch(`/api/problems/${targetProblemId}`, { method: 'DELETE' }),
    onSuccess: () => {
      setPendingDeletion(false);
      queryClient.invalidateQueries({ queryKey: ['problems'] });
      navigate('/');
    }
  });

  const problem = problemQuery.data;
  const languages = languagesQuery.languages ?? [];

  const allowedLanguages = problem?.judge0LanguageIds?.length
    ? languages.filter((item) => problem.judge0LanguageIds.includes(item.id))
    : languages;

  const getSubmissionFromCaches = useCallback(
    (submissionId) => {
      if (!submissionId) {
        return null;
      }
      const problemJudgeId = problem?.problemId ?? null;
      if (problemJudgeId) {
        const cachedLists = queryClient.getQueriesData({
          queryKey: ['problemSubmissions', problemJudgeId]
        });
        for (const [, cacheData] of cachedLists) {
          const items = cacheData?.items;
          if (Array.isArray(items)) {
            const found = items.find((item) => (item.id ?? item._id) === submissionId);
            if (found) {
              return found;
            }
          }
        }
      }
      const dashboardEntries = queryClient.getQueryData(['submissions', 'mine', 'dashboard']);
      if (Array.isArray(dashboardEntries)) {
        return (
          dashboardEntries.find((item) => (item.id ?? item._id) === submissionId) ?? null
        );
      }
      return null;
    },
    [problem?.problemId, queryClient]
  );

  const problemAuthorRaw = problem?.author;
  const problemAuthorId =
    typeof problemAuthorRaw === 'object' && problemAuthorRaw !== null
      ? problemAuthorRaw._id ?? problemAuthorRaw.toString?.()
      : problemAuthorRaw;
  const isOwner =
    problemAuthorId && user?.id ? String(problemAuthorId) === String(user.id) : false;

  useEffect(() => {
    if (!languageId && allowedLanguages.length) {
      setLanguageId(String(allowedLanguages[0].id));
    }
  }, [allowedLanguages, languageId]);

  useEffect(() => {
    if (location.state?.flash) {
      setMessage(location.state.flash);
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  const handleVerdictClick = useCallback((submissionId) => {
    if (!submissionId) {
      return;
    }
    setActiveSubmissionId(submissionId);
  }, []);

  const handleResubmit = useCallback(
    (submission) => {
      const submissionId = submission?.id ?? submission?._id;
      if (!submissionId) {
        return;
      }
      const isOwner = submission?.userId && submission.userId === currentUserId;
      if (!isAdmin && !isOwner) {
        return;
      }
      setMessage(null);
      setResubmittingId(submissionId);
      resubmitMutation.mutate({ submissionId, baseSubmission: submission });
    },
    [currentUserId, isAdmin, resubmitMutation]
  );

  const handleDeleteSubmission = useCallback(
    (submission) => {
      const submissionId = submission?.id ?? submission?._id;
      if (!submissionId || !isSuperAdmin) {
        return;
      }
      setMessage(null);
      setDeletingId(submissionId);
      deleteSubmissionMutation.mutate(submissionId, {
        onSettled: () => setDeletingId(null)
      });
    },
    [deleteSubmissionMutation, isSuperAdmin]
  );

  const closeSubmissionModal = useCallback(() => {
    setActiveSubmissionId(null);
  }, []);

  const selectedLanguageId = languageId || (allowedLanguages[0]?.id ?? '');
  const testCaseCount = problem?.testCaseCount ?? problem?.testCases?.length ?? 0;
  const totalPoints = problem?.totalPoints ??
    (problem?.testCases?.reduce((sum, testCase) => sum + (testCase.points || 0), 0) ?? 0);
  const showAdminTestCases = isAdmin && problem?.testCases?.length > 0;
  const canResubmitActiveSubmission = useMemo(() => {
    if (!activeSubmissionId || !currentUserId) {
      return false;
    }
    if (isAdmin) {
      return true;
    }
    const cached = getSubmissionFromCaches(activeSubmissionId);
    if (cached?.userId && currentUserId) {
      return String(cached.userId) === String(currentUserId);
    }
    return false;
  }, [activeSubmissionId, currentUserId, getSubmissionFromCaches, isAdmin]);
  const cachedActiveSubmission = activeSubmissionId
    ? getSubmissionFromCaches(activeSubmissionId)
    : null;

  return (
    <section className="page">
      {problemQuery.isLoading && <div className="page-message">Loading problem…</div>}
      {problemQuery.isError && <div className="page-message error">Problem not found.</div>}

      {problem && (
        <div className="problem-detail">
          <header className="problem-detail__header">
            <div>
              <h1>
                {problem.title}
                <span className="problem-detail__id">#{problem.problemId}</span>
              </h1>
              <div className="problem-labels">
                <span className={`difficulty-tag difficulty-${problem.difficulty?.toLowerCase()}`}>
                  {problem.difficulty}
                </span>
                {!problem.isPublic && <span className="problem-card__badge">Private</span>}
              </div>
            </div>
            <div className="problem-detail__meta">
              <div className="problem-stats">
                <span>{problem.submissionCount ?? 0} submissions</span>
                <span>{problem.acceptedSubmissionCount ?? 0} accepted</span>
                <span>
                  {testCaseCount} test cases
                  {totalPoints ? ` · ${totalPoints} points` : ''}
                </span>
              </div>
              {(isAdmin || isOwner) && (
                <div className="problem-detail__actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => navigate(`/problems/${problem.problemId}/edit`)}
                  >
                    Edit
                  </button>
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        className="secondary"
                        disabled={toggleVisibilityMutation.isLoading}
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
                        onClick={() => setPendingDeletion(true)}
                        disabled={deleteProblemMutation.isLoading}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </header>

          <article className="problem-section">
            <h2>Statement</h2>
            <p className="problem-text">{problem.statement}</p>
          </article>

          {problem.inputFormat && (
            <article className="problem-section">
              <h3>Input Format</h3>
              <p className="problem-text">{problem.inputFormat}</p>
            </article>
          )}

          {problem.outputFormat && (
            <article className="problem-section">
              <h3>Output Format</h3>
              <p className="problem-text">{problem.outputFormat}</p>
            </article>
          )}

          {problem.constraints && (
            <article className="problem-section">
              <h3>Constraints</h3>
              <p className="problem-text">{problem.constraints}</p>
            </article>
          )}

          {problem.samples?.length ? (
            <article className="problem-section">
              <h3>Sample Cases</h3>
              <div className="samples-grid">
                {problem.samples.map((sample, index) => (
                  <div key={index} className="sample-card">
                    <h4>Sample {index + 1}</h4>
                    <div>
                      <strong>Input</strong>
                      <pre>{sample.input}</pre>
                    </div>
                    <div>
                      <strong>Output</strong>
                      <pre>{sample.output}</pre>
                    </div>
                    {sample.explanation && (
                      <div>
                        <strong>Explanation</strong>
                        <p>{sample.explanation}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          {showAdminTestCases ? (
            <article className="problem-section">
              <h3>Test Cases (admin)</h3>
              <div className="testcase-list">
                {problem.testCases.map((testCase, index) => (
                  <div key={`${testCase.input}-${index}`} className="testcase-card">
                    <strong>
                      Case {index + 1} · {testCase.points ?? 1} pt
                      {testCase.points === 1 ? '' : 's'}
                    </strong>
                    <div>
                      <span>Input</span>
                      <pre>{testCase.input}</pre>
                    </div>
                    <div>
                      <span>Output</span>
                      <pre>{testCase.output}</pre>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          {user ? (
            <article className="problem-section">
              <h3>Submit Solution</h3>
              <form
                className="submission-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  setMessage(null);
                  submissionMutation.mutate();
                }}
              >
                <label>
                  Language
                  <select
                    value={selectedLanguageId}
                    onChange={(event) => setLanguageId(event.target.value)}
                  >
                    {allowedLanguages.map((lang) => (
                      <option key={lang.id} value={lang.id}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Source Code
                  <textarea
                    value={sourceCode}
                    onChange={(event) => setSourceCode(event.target.value)}
                    rows={12}
                    placeholder="Write your solution here…"
                    required
                  />
                </label>
                <button type="submit" disabled={submissionMutation.isLoading}>
                  {submissionMutation.isLoading ? 'Submitting…' : 'Submit'}
                </button>
                {message && (
                  <div className={`form-message ${message.type}`}>{message.text}</div>
                )}
              </form>
            </article>
          ) : (
            <article className="problem-section callout">
              <p>Please log in to submit solutions and view submissions for this problem.</p>
            </article>
          )}

          {user ? (
            <ProblemSubmissionsPanel
              problem={problem}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              canDelete={isSuperAdmin}
              onVerdictClick={handleVerdictClick}
              onResubmit={handleResubmit}
              onDelete={handleDeleteSubmission}
              resubmittingId={resubmittingId}
              isResubmitPending={resubmitMutation.isPending}
              deletingId={deletingId}
              isDeletePending={deleteSubmissionMutation.isPending}
            />
          ) : null}
        </div>
      )}
      <ConfirmDialog
        open={pendingDeletion}
        title="Delete this problem?"
        confirmLabel="Delete"
        onCancel={() => setPendingDeletion(false)}
        onConfirm={() => {
          if (problem) {
            deleteProblemMutation.mutate(problem.problemId);
          }
        }}
        isConfirming={deleteProblemMutation.isLoading}
      >
        {problem ? (
          <p>
            This will also remove all submissions for this problem. This action cannot be undone.
            <br />
            <strong>{problem.title}</strong> (#{problem.problemId})
          </p>
        ) : null}
      </ConfirmDialog>
      {activeSubmissionId ? (
        <SubmissionViewerModal
          submissionId={activeSubmissionId}
          onClose={closeSubmissionModal}
          allowResubmit={canResubmitActiveSubmission}
          onResubmit={(submissionId) => {
            const baseSubmission = getSubmissionFromCaches(submissionId);
            if (baseSubmission) {
              handleResubmit(baseSubmission);
            }
          }}
          isResubmitting={
            resubmitMutation.isPending && resubmittingId === activeSubmissionId
          }
          allowDelete={isSuperAdmin}
          onDelete={(submission) => {
            const baseSubmission = submission ?? cachedActiveSubmission;
            if (baseSubmission) {
              handleDeleteSubmission(baseSubmission);
            }
          }}
          isDeleting={
            deleteSubmissionMutation.isPending && deletingId === activeSubmissionId
          }
        />
      ) : null}
    </section>
  );
}

export default ProblemDetailPage;
