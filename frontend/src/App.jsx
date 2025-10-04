import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

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

function App() {
  const location = useLocation();
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

  const handleProblemCreated = async (createdProblem) => {
    const normalized = normalizeProblem(createdProblem);
    setProblems((prev) => {
      const filtered = prev.filter((problem) => problem._id !== normalized._id);
      return [normalized, ...filtered];
    });
    await selectProblem(normalized);
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
            <Dashboard
              loadingProblems={loadingProblems}
              problems={problems}
              languageMap={languageMap}
              selectProblem={selectProblem}
              selectedProblem={selectedProblem}
              availableLanguages={availableLanguages}
              languageId={languageId}
              setLanguageId={setLanguageId}
              sourceCode={sourceCode}
              setSourceCode={setSourceCode}
              submitting={submitting}
              handleSubmit={handleSubmit}
              lastSubmission={lastSubmission}
              submissionHistory={submissionHistory}
            />
          }
        />
        <Route
          path="/problems/new"
          element={
            <ProblemCreatePage
              languages={languages}
              onProblemCreated={handleProblemCreated}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function Dashboard({
  loadingProblems,
  problems,
  languageMap,
  selectProblem,
  selectedProblem,
  availableLanguages,
  languageId,
  setLanguageId,
  sourceCode,
  setSourceCode,
  submitting,
  handleSubmit,
  lastSubmission,
  submissionHistory
}) {
  return (
    <>
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

          {selectedProblem.testCases?.length ? (
            <div className="sample-cases">
              <h3>Sample Test Cases</h3>
              {selectedProblem.testCases.map((testCase, index) => (
                <article key={`${selectedProblem._id}-test-${index}`} className="test-case">
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

            <button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Solution'}
            </button>
          </div>
        </section>
      )}

      {lastSubmission && (
        <section className="submission-results">
          <h2>Last Submission</h2>
          <div className="result-card">
            <p>
              <strong>Status:</strong> {lastSubmission.status?.description || 'Unknown'}
            </p>
            <p>
              <strong>Time:</strong> {lastSubmission.time || '-'}
            </p>
            <p>
              <strong>Memory:</strong> {lastSubmission.memory || '-'}
            </p>
            <p>
              <strong>Language:</strong> {lastSubmission.language?.name || '-'}
            </p>
            {lastSubmission.stdout && (
              <div>
                <strong>Output:</strong>
                <pre>{lastSubmission.stdout}</pre>
              </div>
            )}
            {lastSubmission.stderr && (
              <div>
                <strong>Errors:</strong>
                <pre>{lastSubmission.stderr}</pre>
              </div>
            )}
            {lastSubmission.compile_output && (
              <div>
                <strong>Compiler Output:</strong>
                <pre>{lastSubmission.compile_output}</pre>
              </div>
            )}
          </div>
        </section>
      )}

      {submissionHistory?.length ? (
        <section className="submission-results">
          <h2>Submission History</h2>
          {submissionHistory.map((submission) => (
            <div key={submission._id} className="result-card">
              <p>
                <strong>Problem:</strong> {submission.problem?.title || 'Unknown'}
              </p>
              <p>
                <strong>Status:</strong> {submission.status?.description || 'Unknown'}
              </p>
              <p>
                <strong>Language:</strong> {submission.language?.name || '-'}
              </p>
              <p>
                <strong>Submitted at:</strong>{' '}
                {submission.createdAt ? new Date(submission.createdAt).toLocaleString() : '-'}
              </p>
            </div>
          ))}
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

          <div className="field slug-field">
            <label>
              Slug
              <input
                type="text"
                value={problemForm.slug}
                onChange={(event) => handleProblemSlugChange(event.target.value)}
                placeholder="a-plus-b"
                required
              />
            </label>
            <button type="button" className="secondary-button" onClick={regenerateSlug}>
              Regenerate
            </button>
          </div>

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
