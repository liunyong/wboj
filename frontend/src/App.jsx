import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams
} from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || '';

const defaultCode = `# Write your code here\n# Example (Python)\nnums = list(map(int, input().split()))\nprint(sum(nums))`;

const fetchJson = async (path, options = {}) => {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json'
    },
    ...options
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const error = new Error(errorBody.message || 'Request failed');
    error.status = response.status;
    throw error;
  }

  return response.json();
};

const normalizeLanguageIds = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id));
  }
  if (typeof value === 'number' && Number.isInteger(value)) {
    return [value];
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '')
      .map((part) => Number(part))
      .filter((id) => Number.isInteger(id));
  }
  return [];
};

const formatProblemNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value)).padStart(6, '0');
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return '';
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return String(parsed).padStart(6, '0');
    }
  }

  return '';
};

const normalizeProblemNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
};

const clampRate = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
};

const normalizeProblem = (problem) => {
  const normalizedProblemNumber = normalizeProblemNumber(problem?.problemNumber);
  const judge0LanguageIds = normalizeLanguageIds(problem?.judge0LanguageIds);

  const parseCount = (value) => {
    if (typeof value !== 'number') {
      return 0;
    }
    if (!Number.isFinite(value) || value < 0) {
      return 0;
    }
    return Math.trunc(value);
  };

  const submissionCount = parseCount(problem?.submissionCount);
  const acceptedSubmissionCount = parseCount(problem?.acceptedSubmissionCount);

  let acceptanceRate = problem?.acceptanceRate;
  if (typeof acceptanceRate !== 'number' || Number.isNaN(acceptanceRate)) {
    acceptanceRate = submissionCount ? acceptedSubmissionCount / submissionCount : 0;
  }

  return {
    ...problem,
    judge0LanguageIds,
    problemNumber: normalizedProblemNumber,
    problemNumberLabel: normalizedProblemNumber ? formatProblemNumber(normalizedProblemNumber) : '',
    submissionCount,
    acceptedSubmissionCount,
    acceptanceRate: clampRate(acceptanceRate)
  };
};

const coerceLanguageId = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const ensureString = (value) => {
  if (typeof value === 'string') {
    return value;
  }
  if (value == null) {
    return '';
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return '';
};

const ensureNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const normalizeSubmission = (submission, languages = []) => {
  if (!submission || typeof submission !== 'object') {
    return null;
  }

  const languageId = coerceLanguageId(submission.languageId);
  const language = languages.find((item) => item.id === languageId) || null;

  const testCaseResults = Array.isArray(submission.testCaseResults)
    ? submission.testCaseResults.map((result, index) => {
        const rawStatus = typeof result?.status === 'object' && result.status ? result.status : {};
        const statusId = Number.isFinite(rawStatus.id) ? rawStatus.id : undefined;
        const statusDescription = ensureString(rawStatus.description).trim();
        const stdout = ensureString(result?.stdout);
        const stderr = ensureString(result?.stderr ?? result?.stderr_output);
        const compileOutput = ensureString(result?.compileOutput ?? result?.compile_output);
        const message = ensureString(result?.message);
        const time = ensureString(result?.time);
        const memory = ensureNumber(result?.memory);
        const passed = statusId === 3 && !stderr && !compileOutput;

        return {
          ...result,
          index,
          input: ensureString(result?.input),
          expectedOutput: ensureString(result?.expectedOutput),
          stdout,
          stderr,
          compileOutput,
          message,
          status: {
            ...(statusId !== undefined ? { id: statusId } : {}),
            description: statusDescription || (statusId === 3 ? 'Accepted' : 'Failed')
          },
          time,
          memory,
          passed
        };
      })
    : [];

  const verdict = ensureString(submission.verdict).trim() || 'Pending';
  const normalizedStatus = {
    ...(submission.status && Number.isFinite(submission.status.id)
      ? { id: submission.status.id }
      : verdict === 'Accepted'
      ? { id: 3 }
      : {}),
    description: verdict
  };

  return {
    ...submission,
    languageId,
    language,
    verdict,
    status: normalizedStatus,
    testCaseResults
  };
};

const getProblemLanguages = (problem, languageList = []) => {
  const allowedIds = normalizeLanguageIds(problem?.judge0LanguageIds);
  if (!allowedIds.length) {
    return languageList;
  }
  const allowed = new Set(allowedIds);
  return languageList.filter((language) => allowed.has(language.id));
};

const slugify = (value = '') =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');

const createTestCase = (isPublic = false) => ({
  input: '',
  expectedOutput: '',
  isPublic,
  inputFileName: '',
  outputFileName: ''
});

const createEmptyProblemForm = () => ({
  title: '',
  slug: '',
  description: '',
  judge0LanguageIds: [],
  testCases: [createTestCase(true)]
});

const extractProblemList = (data) => {
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data?.items)) {
    return data.items;
  }
  return [];
};

const buildProblemPath = (problem, index = 0) => {
  const identifier = problem?._id || problem?.slug || index;
  return encodeURIComponent(String(identifier));
};

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [languages, setLanguages] = useState([]);
  const [problems, setProblems] = useState([]);
  const [loadingProblems, setLoadingProblems] = useState(true);
  const [error, setError] = useState('');
  const [submissionHistory, setSubmissionHistory] = useState([]);
  const normalizedSubmissionHistory = useMemo(
    () =>
      submissionHistory
        .map((submission) => normalizeSubmission(submission, languages))
        .filter(Boolean),
    [submissionHistory, languages]
  );

  const loadSubmissions = useCallback(async () => {
    try {
      const data = await fetchJson('/api/submissions');
      setSubmissionHistory(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setError('');
        setLoadingProblems(true);
        const [languageData, problemData] = await Promise.all([
          fetchJson('/api/languages'),
          fetchJson('/api/problems')
        ]);
        setLanguages(languageData);
        const normalizedProblems = extractProblemList(problemData).map(normalizeProblem);
        setProblems(normalizedProblems);
      } catch (err) {
        setError(err.message || 'Failed to load data');
      } finally {
        setLoadingProblems(false);
      }
    };

    loadInitialData();
    loadSubmissions();
  }, [loadSubmissions]);

  const handleProblemCreated = useCallback(
    async (createdProblem) => {
      const normalized = normalizeProblem(createdProblem);
      setProblems((prev) => {
        const filtered = prev.filter((problem) => problem._id !== normalized._id);
        return [normalized, ...filtered];
      });
      navigate(`/problems/${buildProblemPath(normalized)}`);
    },
    [navigate]
  );

  return (
    <div className="container">
      <header>
        <h1>Judge0 Playground</h1>
        <p>Browse problems, submit solutions, and view Judge0 results in real-time.</p>
        <nav className="nav">
          <Link
            to="/"
            className={`nav-link${location.pathname === '/' ? ' active' : ''}`}
          >
            Problems
          </Link>
          <Link
            to="/problems/new"
            className={`nav-link${location.pathname === '/problems/new' ? ' active' : ''}`}
          >
            Create Problem
          </Link>
        </nav>
      </header>

      {error && location.pathname === '/' && <div className="error">{error}</div>}

      <Routes>
        <Route
          path="/"
          element={
            <ProblemListPage
              loadingProblems={loadingProblems}
              problems={problems}
            />
          }
        />
        <Route
          path="/problems/new"
          element={<ProblemCreatePage languages={languages} onProblemCreated={handleProblemCreated} />}
        />
        <Route
          path="/problems/:problemId"
          element={
            <ProblemDetailPage
              languages={languages}
              loadSubmissions={loadSubmissions}
              submissionHistory={normalizedSubmissionHistory}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function ProblemListPage({ loadingProblems, problems }) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProblems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return problems;
    }
    return problems.filter((problem) => {
      const title = problem.title?.toLowerCase() ?? '';
      const slug = problem.slug?.toLowerCase() ?? '';
      const numberLabel = problem.problemNumberLabel ?? '';
      const numberRaw = problem.problemNumber ? String(problem.problemNumber) : '';
      return (
        title.includes(query) ||
        slug.includes(query) ||
        numberLabel.includes(query) ||
      numberRaw.includes(query)
      );
    });
  }, [problems, searchQuery]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat(), []);

  const formatSuccessRate = useCallback((rate, submissions) => {
    if (!submissions) {
      return '—';
    }
    const value = clampRate(rate);
    const percentage = value * 100;
    if (!Number.isFinite(percentage)) {
      return '—';
    }
    const formatted = Number.isInteger(percentage)
      ? percentage.toFixed(0)
      : percentage.toFixed(1);
    return `${formatted}%`;
  }, []);

  const handleProblemClick = (problem, index) => {
    const path = buildProblemPath(problem, index);
    navigate(`/problems/${path}`);
  };

  return (
    <section className="problem-board">
      <div className="problem-board-header">
        <div>
          <h2>Problem List</h2>
          <p className="muted-text">Filter and pick a problem to start solving, Baekjoon-style.</p>
        </div>
        <div className="problem-board-controls">
          <input
            type="search"
            className="problem-search"
            placeholder="Search by title, slug, or number"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <span className="problem-count">
            {filteredProblems.length}
            {searchQuery ? ` / ${problems.length}` : ''} problems
          </span>
        </div>
      </div>

      {loadingProblems ? (
        <div className="loading">Loading problems...</div>
      ) : filteredProblems.length ? (
        <div className="problem-table-wrapper">
          <table className="problem-table">
            <thead>
              <tr>
                <th scope="col">No.</th>
                <th scope="col">Title</th>
                <th scope="col">Description</th>
                <th scope="col">Success Rate</th>
                <th scope="col">Submissions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProblems.map((problem, index) => {
                const identifier = problem._id || problem.slug || index;
                const displayNumber =
                  problem.problemNumberLabel || String(index + 1).padStart(6, '0');
                const submissionCount =
                  typeof problem.submissionCount === 'number' && Number.isFinite(problem.submissionCount)
                    ? Math.max(0, problem.submissionCount)
                    : 0;
                const successLabel = formatSuccessRate(problem.acceptanceRate, submissionCount);
                const submissionsLabel = numberFormatter.format(submissionCount);
                const rawDescription = (problem.description ?? '').trim();
                const descriptionPreview = rawDescription.length > 160
                  ? `${rawDescription.slice(0, 160)}…`
                  : rawDescription;
                return (
                  <tr
                    key={identifier}
                    className="problem-row"
                    onClick={() => handleProblemClick(problem, index)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleProblemClick(problem, index);
                      }
                    }}
                  >
                    <td data-label="No." className="problem-index">
                      {displayNumber}
                    </td>
                    <td data-label="Title" className="problem-title-cell">
                      <div className="problem-title">
                        <span>{problem.title}</span>
                        {problem.slug ? (
                          <span className="problem-slug-inline">{problem.slug}</span>
                        ) : null}
                      </div>
                    </td>
                    <td data-label="Description" className="problem-description">
                      {descriptionPreview ? (
                        <span title={rawDescription}>{descriptionPreview}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td data-label="Success Rate" className="problem-success-rate">
                      {successLabel}
                    </td>
                    <td data-label="Submissions" className="problem-submissions">
                      {submissionsLabel}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p>No problems match your filters. Try a different search.</p>
        </div>
      )}
    </section>
  );
}

function ProblemDetailPage({ languages, loadSubmissions, submissionHistory }) {
  const { problemId } = useParams();
  const [problem, setProblem] = useState(null);
  const [loadingProblem, setLoadingProblem] = useState(true);
  const [error, setError] = useState('');
  const [languageId, setLanguageId] = useState(null);
  const [sourceCode, setSourceCode] = useState(defaultCode);
  const [submitting, setSubmitting] = useState(false);
  const [lastSubmission, setLastSubmission] = useState(null);
  const normalizedLastSubmission = useMemo(
    () => normalizeSubmission(lastSubmission, languages),
    [lastSubmission, languages]
  );

  useEffect(() => {
    let isMounted = true;

    const loadProblem = async () => {
      if (!problemId) return;
      setLoadingProblem(true);
      setError('');
      setLastSubmission(null);
      setSourceCode(defaultCode);

      try {
        const encodedId = encodeURIComponent(problemId);
        const fullProblem = normalizeProblem(await fetchJson(`/api/problems/${encodedId}`));
        if (!isMounted) {
          return;
        }
        setProblem(fullProblem);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setProblem(null);
        setError(err.message || 'Failed to load problem');
      } finally {
        if (isMounted) {
          setLoadingProblem(false);
        }
      }
    };

    loadProblem();

    return () => {
      isMounted = false;
    };
  }, [problemId]);

  useEffect(() => {
    if (!problem) {
      return;
    }
    const available = getProblemLanguages(problem, languages);
    setLanguageId((prev) => {
      if (prev && available.some((language) => language.id === prev)) {
        return prev;
      }
      if (available.length) {
        return available[0].id;
      }
      if (languages.length) {
        return languages[0].id;
      }
      return null;
    });
  }, [problem, languages]);

  const availableLanguages = useMemo(
    () => (problem ? getProblemLanguages(problem, languages) : languages),
    [problem, languages]
  );

  const handleSubmit = async () => {
    if (!problem) return;
    if (!languageId) {
      setError('No language available for this problem');
      return;
    }

    setSubmitting(true);
    setError('');
    setLastSubmission(null);

    try {
      const payload = {
        problemId: problem._id,
        languageId,
        sourceCode
      };

      const submission = await fetchJson('/api/submissions', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setLastSubmission(submission);
      await loadSubmissions();
    } catch (err) {
      setError(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <section className="problem-detail">
        <div className="detail-actions">
          <Link to="/" className="link-button">
            ← Back to Problems
          </Link>
        </div>

        {loadingProblem ? (
          <div className="loading">Loading problem...</div>
        ) : error ? (
          <div className="error inline-error">{error}</div>
        ) : problem ? (
          <>
            <h2>{problem.title}</h2>
            {problem.problemNumberLabel && (
              <p className="muted-text">Problem #{problem.problemNumberLabel}</p>
            )}
            <p>{problem.description}</p>

            {problem.testCases?.length ? (
              <div className="sample-cases">
                <h3>Sample Test Cases</h3>
                {problem.testCases.map((testCase, index) => (
                  <article key={`${problem._id}-test-${index}`} className="test-case">
                    <header>
                      <h4>Case {index + 1}</h4>
                      {testCase.isPublic && <span className="tag">Public</span>}
                    </header>
                    <div className="case-grid">
                      <div>
                        <h5>Input</h5>
                        <pre>{testCase.input}</pre>
                      </div>
                      <div>
                        <h5>Expected Output</h5>
                        <pre>{testCase.expectedOutput}</pre>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p>No sample test cases available.</p>
            )}

            <div className="submission-area">
              <label className="field">
                Language
                <select
                  value={languageId || ''}
                  onChange={(event) => setLanguageId(Number(event.target.value))}
                  disabled={!availableLanguages.length}
                >
                  {availableLanguages.map((language) => (
                    <option key={language.id} value={language.id}>
                      {language.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                Source Code
                <textarea
                  rows={10}
                  value={sourceCode}
                  onChange={(event) => setSourceCode(event.target.value)}
                />
              </label>

              <button onClick={handleSubmit} disabled={submitting || !availableLanguages.length}>
                {submitting ? 'Submitting...' : 'Submit Solution'}
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <p>Problem not found.</p>
          </div>
        )}
      </section>

      {normalizedLastSubmission && (
        <section className="submission-results">
          <h2>Last Submission</h2>
          <div
            className={`result-card${
              normalizedLastSubmission.verdict === 'Accepted'
                ? ' success'
                : normalizedLastSubmission.verdict && normalizedLastSubmission.verdict !== 'Pending'
                ? ' error'
                : ''
            }`}
          >
            <p>
              <strong>Verdict:</strong> {normalizedLastSubmission.verdict || 'Pending'}
            </p>
            <p>
              <strong>Language:</strong>{' '}
              {normalizedLastSubmission.language?.name ||
                (normalizedLastSubmission.languageId != null
                  ? `#${normalizedLastSubmission.languageId}`
                  : '-')}
            </p>
            <p>
              <strong>Submitted at:</strong>{' '}
              {normalizedLastSubmission.createdAt
                ? new Date(normalizedLastSubmission.createdAt).toLocaleString()
                : '-'}
            </p>
          </div>

          {normalizedLastSubmission.testCaseResults?.length ? (
            <div className="test-case-results">
              <h3>Test Case Results</h3>
              {normalizedLastSubmission.testCaseResults.map((result) => (
                <article
                  key={`${normalizedLastSubmission._id || 'submission'}-case-${result.index}`}
                  className={`test-case-result${result.passed ? ' success' : ' error'}`}
                >
                  <header className="test-case-result-header">
                    <span>Case {result.index + 1}</span>
                    <span className={`tag ${result.passed ? 'success' : 'error'}`}>
                      {result.status?.description || (result.passed ? 'Accepted' : 'Failed')}
                    </span>
                  </header>
                  <div className="test-case-result-grid">
                    <div>
                      <h5>Input</h5>
                      <pre>{result.input || '—'}</pre>
                    </div>
                    <div>
                      <h5>Expected Output</h5>
                      <pre>{result.expectedOutput || '—'}</pre>
                    </div>
                    <div>
                      <h5>Program Output</h5>
                      <pre>{result.stdout || '—'}</pre>
                    </div>
                  </div>
                  <div className="test-case-meta">
                    <span>Time: {result.time || '-'}</span>
                    <span>Memory: {result.memory != null ? `${result.memory} KB` : '-'}</span>
                  </div>
                  {result.stderr ? (
                    <div>
                      <strong>Errors:</strong>
                      <pre>{result.stderr}</pre>
                    </div>
                  ) : null}
                  {result.compileOutput ? (
                    <div>
                      <strong>Compiler Output:</strong>
                      <pre>{result.compileOutput}</pre>
                    </div>
                  ) : null}
                  {result.message ? (
                    <div>
                      <strong>Message:</strong>
                      <pre>{result.message}</pre>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="muted-text">No Judge0 results were returned for this submission.</p>
          )}
        </section>
      )}

      {submissionHistory?.length ? (
        <section className="submission-results">
          <h2>Submission History</h2>
          {submissionHistory.map((submission) => {
            const passedCases = submission.testCaseResults?.filter((result) => result?.passed).length || 0;
            const totalCases = submission.testCaseResults?.length || 0;
            const verdictClass =
              submission.verdict === 'Accepted'
                ? ' success'
                : submission.verdict && submission.verdict !== 'Pending'
                ? ' error'
                : '';

            return (
              <div key={submission._id} className={`result-card${verdictClass}`}>
                <p>
                  <strong>Problem:</strong> {submission.problem?.title || 'Unknown'}
                </p>
                <p>
                  <strong>Verdict:</strong> {submission.verdict || 'Pending'}
                </p>
                <p>
                  <strong>Language:</strong>{' '}
                  {submission.language?.name ||
                    (submission.languageId != null ? `#${submission.languageId}` : '-')}
                </p>
                <p>
                  <strong>Submitted at:</strong>{' '}
                  {submission.createdAt ? new Date(submission.createdAt).toLocaleString() : '-'}
                </p>
                {totalCases ? (
                  <p>
                    <strong>Passed Cases:</strong> {passedCases}/{totalCases}
                  </p>
                ) : null}
              </div>
            );
          })}
        </section>
      ) : null}
    </>
  );
}

function ProblemCreatePage({ languages, onProblemCreated }) {
  const navigate = useNavigate();
  const [problemForm, setProblemForm] = useState(() => createEmptyProblemForm());
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [creatingProblem, setCreatingProblem] = useState(false);
  const [createProblemError, setCreateProblemError] = useState('');
  const [createProblemSuccess, setCreateProblemSuccess] = useState('');

  const resetProblemForm = () => {
    setProblemForm(createEmptyProblemForm());
    setSlugManuallyEdited(false);
  };

  const handleProblemTitleChange = (value) => {
    setCreateProblemError('');
    setCreateProblemSuccess('');
    setProblemForm((prev) => ({
      ...prev,
      title: value,
      slug: slugManuallyEdited ? prev.slug : slugify(value)
    }));
  };

  const handleProblemSlugChange = (value) => {
    setCreateProblemError('');
    setCreateProblemSuccess('');
    setSlugManuallyEdited(true);
    const sanitized = slugify(value).replace(/--+/g, '-');
    setProblemForm((prev) => ({
      ...prev,
      slug: sanitized
    }));
  };

  const regenerateSlug = () => {
    setSlugManuallyEdited(false);
    setProblemForm((prev) => ({
      ...prev,
      slug: slugify(prev.title)
    }));
  };

  const handleProblemDescriptionChange = (value) => {
    setCreateProblemError('');
    setCreateProblemSuccess('');
    setProblemForm((prev) => ({
      ...prev,
      description: value
    }));
  };

  const toggleLanguageSelection = (languageId) => {
    setCreateProblemError('');
    setCreateProblemSuccess('');
    setProblemForm((prev) => {
      const selected = new Set(prev.judge0LanguageIds);
      if (selected.has(languageId)) {
        selected.delete(languageId);
      } else {
        selected.add(languageId);
      }
      const ids = Array.from(selected).sort((a, b) => a - b);
      return {
        ...prev,
        judge0LanguageIds: ids
      };
    });
  };

  const handleTestCaseChange = (index, field, value) => {
    setCreateProblemError('');
    setCreateProblemSuccess('');
    setProblemForm((prev) => ({
      ...prev,
      testCases: prev.testCases.map((testCase, i) =>
        i === index
          ? {
              ...testCase,
              [field]: field === 'isPublic' ? Boolean(value) : value,
              ...(field === 'input' ? { inputFileName: '' } : {}),
              ...(field === 'expectedOutput' ? { outputFileName: '' } : {})
            }
          : testCase
      )
    }));
  };

  const handleTestCaseFileUpload = (index, field, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = typeof event.target?.result === 'string' ? event.target.result : '';
      setProblemForm((prev) => ({
        ...prev,
        testCases: prev.testCases.map((testCase, i) => {
          if (i !== index) {
            return testCase;
          }
          const next = {
            ...testCase,
            [field]: text
          };
          if (field === 'input') {
            next.inputFileName = file.name;
          }
          if (field === 'expectedOutput') {
            next.outputFileName = file.name;
          }
          return next;
        })
      }));
      setCreateProblemError('');
      setCreateProblemSuccess('');
    };
    reader.readAsText(file);
  };

  const handleAddTestCase = () => {
    setCreateProblemError('');
    setCreateProblemSuccess('');
    setProblemForm((prev) => ({
      ...prev,
      testCases: [...prev.testCases, createTestCase()]
    }));
  };

  const handleRemoveTestCase = (index) => {
    setCreateProblemError('');
    setCreateProblemSuccess('');
    setProblemForm((prev) => {
      if (prev.testCases.length <= 1) {
        return prev;
      }
      const testCases = prev.testCases.filter((_, i) => i !== index);
      return {
        ...prev,
        testCases
      };
    });
  };

  const handleProblemSubmit = async (event) => {
    event.preventDefault();
    if (creatingProblem) return;

    setCreateProblemError('');
    setCreateProblemSuccess('');

    const title = problemForm.title.trim();
    const slug = problemForm.slug.trim();
    const description = problemForm.description.trim();
    const testCases = problemForm.testCases.map((testCase) => ({
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      isPublic: Boolean(testCase.isPublic),
      ...(testCase.inputFileName ? { inputFileName: testCase.inputFileName } : {}),
      ...(testCase.outputFileName ? { outputFileName: testCase.outputFileName } : {})
    }));

    if (!title || !slug || !description) {
      setCreateProblemError('Title, slug, and description are required.');
      return;
    }

    if (testCases.length === 0 || testCases.some((testCase) => !testCase.input || !testCase.expectedOutput)) {
      setCreateProblemError('Each test case needs both input and expected output.');
      return;
    }

    const payload = {
      title,
      slug,
      description,
      testCases
    };

    if (problemForm.judge0LanguageIds.length) {
      payload.judge0LanguageIds = problemForm.judge0LanguageIds;
    }

    setCreatingProblem(true);

    try {
      const created = await fetchJson('/api/problems', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      await onProblemCreated(created);

      setCreateProblemSuccess('Problem created successfully.');
      resetProblemForm();
    } catch (err) {
      setCreateProblemError(err.message || 'Failed to create problem.');
    } finally {
      setCreatingProblem(false);
    }
  };

  return (
    <section className="problem-form">
      <h2>Create Problem</h2>
      <p className="section-subtitle">
        Craft a new problem, upload sample inputs/outputs, and persist it to the database.
      </p>
      {createProblemError && <div className="error inline-error">{createProblemError}</div>}
      {createProblemSuccess && <div className="success">{createProblemSuccess}</div>}

      <form onSubmit={handleProblemSubmit}>
        <div className="form-grid">
          <label className="field">
            Title
            <input
              type="text"
              value={problemForm.title}
              onChange={(event) => handleProblemTitleChange(event.target.value)}
              placeholder="A + B"
              required
            />
          </label>

          <label className="field">
            Slug
            <input
              type="text"
              value={problemForm.slug}
              onChange={(event) => handleProblemSlugChange(event.target.value)}
              placeholder="a-plus-b"
              required
            />
            <button type="button" className="link-button" onClick={regenerateSlug}>
              Regenerate
            </button>
          </label>

          <label className="field">
            Description
            <textarea
              rows={6}
              value={problemForm.description}
              onChange={(event) => handleProblemDescriptionChange(event.target.value)}
              placeholder="Describe the problem statement and constraints."
              required
            />
          </label>
        </div>

        <div className="field">
          <span className="field-label">Allowed Languages</span>
          <span className="field-hint">
            Leave empty to allow every language supported by Judge0.
          </span>
          <div className="language-grid">
            {languages.map((language) => {
              const checked = problemForm.judge0LanguageIds.includes(language.id);
              return (
                <label key={language.id} className="checkbox">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleLanguageSelection(language.id)}
                  />
                  {language.name}
                </label>
              );
            })}
            {!languages.length && <span className="field-hint">No languages loaded.</span>}
          </div>
        </div>

        <div className="field">
          <div className="test-case-list">
            <div className="test-case-header">
              <h3>Test Cases</h3>
              <button type="button" className="secondary-button" onClick={handleAddTestCase}>
                Add Test Case
              </button>
            </div>

            {problemForm.testCases.map((testCase, index) => (
              <article key={`test-case-${index}`} className="test-case-card">
                <header>
                  <h4>Case {index + 1}</h4>
                  <div className="test-case-actions">
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={Boolean(testCase.isPublic)}
                        onChange={(event) =>
                          handleTestCaseChange(index, 'isPublic', event.target.checked)
                        }
                      />
                      <span>Public sample</span>
                    </label>
                    {problemForm.testCases.length > 1 && (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => handleRemoveTestCase(index)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </header>

                <label className="field">
                  Input
                  <textarea
                    rows={4}
                    value={testCase.input}
                    onChange={(event) => handleTestCaseChange(index, 'input', event.target.value)}
                    placeholder="1 2"
                    required
                  />
                </label>
                <div className="file-row">
                  <label className="file-input">
                    <input
                      type="file"
                      accept=".txt,.in,.input,.dat,.json"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        handleTestCaseFileUpload(index, 'input', file);
                        event.target.value = '';
                      }}
                    />
                    <span>Upload input file</span>
                  </label>
                  {testCase.inputFileName && <span className="file-name">{testCase.inputFileName}</span>}
                </div>

                <label className="field">
                  Expected Output
                  <textarea
                    rows={4}
                    value={testCase.expectedOutput}
                    onChange={(event) =>
                      handleTestCaseChange(index, 'expectedOutput', event.target.value)
                    }
                    placeholder="3"
                    required
                  />
                </label>
                <div className="file-row">
                  <label className="file-input">
                    <input
                      type="file"
                      accept=".txt,.out,.output,.dat,.json"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        handleTestCaseFileUpload(index, 'expectedOutput', file);
                        event.target.value = '';
                      }}
                    />
                    <span>Upload output file</span>
                  </label>
                  {testCase.outputFileName && (
                    <span className="file-name">{testCase.outputFileName}</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" disabled={creatingProblem}>
            {creatingProblem ? 'Saving...' : 'Create Problem'}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              resetProblemForm();
              setCreateProblemError('');
              setCreateProblemSuccess('');
            }}
          >
            Reset Form
          </button>
          <button
            type="button"
            className="link-button"
            onClick={() => navigate('/')}
          >
            Back to Problems
          </button>
        </div>
      </form>
    </section>
  );
}

export default App;
