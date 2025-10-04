import { useEffect, useMemo, useState } from 'react';

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

const normalizeProblem = (problem) => ({
  ...problem,
  judge0LanguageIds: normalizeLanguageIds(problem?.judge0LanguageIds)
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

function App() {
  const [languages, setLanguages] = useState([]);
  const [problems, setProblems] = useState([]);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [loadingProblems, setLoadingProblems] = useState(true);
  const [error, setError] = useState('');
  const [languageId, setLanguageId] = useState(null);
  const [sourceCode, setSourceCode] = useState(defaultCode);
  const [submitting, setSubmitting] = useState(false);
  const [lastSubmission, setLastSubmission] = useState(null);
  const [submissionHistory, setSubmissionHistory] = useState([]);

  const languageMap = useMemo(() => {
    const map = new Map();
    languages.forEach((language) => {
      map.set(language.id, language.name);
    });
    return map;
  }, [languages]);

  const getProblemLanguages = (problem, languageList = languages) => {
    const allowedIds = normalizeLanguageIds(problem?.judge0LanguageIds);
    if (!allowedIds.length) {
      return languageList;
    }
    const allowed = new Set(allowedIds);
    return languageList.filter((language) => allowed.has(language.id));
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoadingProblems(true);
        const [languageData, problemData] = await Promise.all([
          fetchJson('/api/languages'),
          fetchJson('/api/problems')
        ]);
        setLanguages(languageData);
        const normalizedProblems = extractProblemList(problemData).map(normalizeProblem);
        setProblems(normalizedProblems);
        if (normalizedProblems.length) {
          await selectProblem(normalizedProblems[0], languageData);
        }
      } catch (err) {
        setError(err.message || 'Failed to load data');
      } finally {
        setLoadingProblems(false);
      }
    };

    loadInitialData();
    loadSubmissions();
  }, []);

  const selectProblem = async (problem, languageList = languages) => {
    try {
      setError('');
      const identifier = problem._id || problem.slug;
      const fullProblem = normalizeProblem(
        await fetchJson(`/api/problems/${identifier}`)
      );
      setSelectedProblem(fullProblem);
      setSourceCode(defaultCode);

      const available = getProblemLanguages(fullProblem, languageList);
      const currentIsValid = available.some((language) => language.id === languageId);

      if (currentIsValid) {
        return;
      }

      let nextLanguageId = null;
      if (available.length) {
        nextLanguageId = available[0].id;
      } else if (languageList.length) {
        nextLanguageId = languageList[0].id;
      }

      setLanguageId(nextLanguageId);
    } catch (err) {
      setError(err.message || 'Failed to load problem');
    }
  };

  const loadSubmissions = async () => {
    try {
      const data = await fetchJson('/api/submissions');
      setSubmissionHistory(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async () => {
    if (!selectedProblem) return;
    if (!languageId) {
      setError('No language available for this problem');
      return;
    }

    setSubmitting(true);
    setError('');
    setLastSubmission(null);

    try {
      const payload = {
        problemId: selectedProblem._id,
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

  const availableLanguages = useMemo(
    () => (selectedProblem ? getProblemLanguages(selectedProblem) : languages),
    [selectedProblem, languages]
  );

  return (
    <div className="container">
      <header>
        <h1>Judge0 Playground</h1>
        <p>Browse problems, submit solutions, and view Judge0 results in real-time.</p>
      </header>

      {error && <div className="error">{error}</div>}

      {loadingProblems ? (
        <div className="loading">Loading problems...</div>
      ) : (
        <section>
          <h2>Problems</h2>
          <div className="problem-list">
            {problems.map((problem) => (
              <article
                key={problem._id}
                className="problem-card"
                onClick={() => selectProblem(problem)}
              >
                <h3>{problem.title}</h3>
                <p>{problem.description}</p>
                <div>
                  {problem.judge0LanguageIds?.map((id) => (
                    <span key={`${problem._id}-${id}`} className="tag">
                      {languageMap.get(id) || `Language ${id}`}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {selectedProblem && (
        <section className="problem-detail">
          <h2>{selectedProblem.title}</h2>
          <p>{selectedProblem.description}</p>

          <label>
            Language
            <select
              value={languageId ?? ''}
              onChange={(event) => {
                const selectedId = Number(event.target.value);
                setLanguageId(Number.isNaN(selectedId) ? null : selectedId);
              }}
              disabled={!availableLanguages.length}
            >
              {!availableLanguages.length && <option value="">No languages available</option>}
              {availableLanguages.map((language) => (
                <option key={language.id} value={language.id}>
                  {language.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Source Code
            <textarea
              rows={14}
              value={sourceCode}
              onChange={(event) => setSourceCode(event.target.value)}
            />
          </label>

          <button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Solution'}
          </button>

          {lastSubmission && (
            <div className="submission-results">
              <h3>Latest Submission — {lastSubmission.verdict}</h3>
              {lastSubmission.testCaseResults?.map((result, index) => {
                const success =
                  result.status?.id === 3 && !result.stderr && !result.compileOutput && !result.message;
                return (
                  <div
                    key={index}
                    className={`result-card ${success ? 'success' : 'error'}`}
                  >
                    <strong>Test Case #{index + 1}</strong>
                    <p>
                      <strong>Input:</strong> <code>{result.input}</code>
                    </p>
                    <p>
                      <strong>Expected:</strong> <code>{result.expectedOutput}</code>
                    </p>
                    <p>
                      <strong>Status:</strong> {result.status?.description}
                    </p>
                    <p>
                      <strong>Stdout:</strong>
                    </p>
                    <pre>{result.stdout || '(empty)'}</pre>
                    {(result.stderr || result.compileOutput || result.message) && (
                      <>
                        <p>
                          <strong>Diagnostics:</strong>
                        </p>
                        <pre>
                          {result.stderr || result.compileOutput || result.message}
                        </pre>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className="submission-history">
        <h2>Recent Submissions</h2>
        <table>
          <thead>
            <tr>
              <th>Problem</th>
              <th>Verdict</th>
              <th>Language</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {submissionHistory.map((submission) => (
              <tr key={submission._id}>
                <td>{submission.problem?.title ?? '—'}</td>
                <td>{submission.verdict}</td>
                <td>{languageMap.get(submission.languageId) || submission.languageId}</td>
                <td>{new Date(submission.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default App;
