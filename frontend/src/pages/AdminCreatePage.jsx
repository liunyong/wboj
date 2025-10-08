import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import TestCaseModal from '../components/TestCaseModal.jsx';
import ValidateTestCasesModal from '../components/ValidateTestCasesModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const defaultFormState = {
  title: '',
  statement: '',
  difficulty: 'BASIC',
  isPublic: true,
  inputFormat: '',
  outputFormat: '',
  constraints: '',
  sampleInput: '',
  sampleOutput: '',
  cpuTimeLimit: '2',
  memoryLimit: '128',
  algorithms: []
};

const generateUid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function AdminCreatePage() {
  const { authFetch } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState(defaultFormState);
  const [testCases, setTestCases] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([71]);
  const [languageSelection, setLanguageSelection] = useState('71');
  const [error, setError] = useState('');
  const [algorithmInput, setAlgorithmInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [trimWhitespace, setTrimWhitespace] = useState(true);
  const [zipWarnings, setZipWarnings] = useState([]);
  const [isTestCaseModalOpen, setIsTestCaseModalOpen] = useState(false);
  const [editingTestCaseIndex, setEditingTestCaseIndex] = useState(null);
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [validationError, setValidationError] = useState('');

  const algorithmsQuery = useQuery({
    queryKey: ['problems', 'algorithms'],
    queryFn: async () => {
      const response = await authFetch('/api/problems/algorithms');
      return response?.items ?? [];
    },
    enabled: false,
    staleTime: 5 * 60 * 1000
  });

  const languagesQuery = useQuery({
    queryKey: ['languages'],
    queryFn: async () => authFetch('/api/languages', {}, { skipAuth: true }),
    staleTime: 5 * 60 * 1000
  });

  useEffect(() => {
    if (!languagesQuery.isFetching && languagesQuery.data?.length) {
      const available = languagesQuery.data;
      const selectionExists = available.some((language) => String(language.id) === languageSelection);

      if (!selectionExists) {
        setLanguageSelection(String(available[0].id));
      }

      if (!selectedLanguages.length) {
        setSelectedLanguages([available[0].id]);
      }
    }
  }, [languageSelection, languagesQuery.data, languagesQuery.isFetching, selectedLanguages.length]);

  const createMutation = useMutation({
    mutationFn: async (payload) =>
      authFetch('/api/problems', {
        method: 'POST',
        body: payload
      }),
    onSuccess: () => {
      setForm(defaultFormState);
      setAlgorithmInput('');
      setError('');
      setTestCases([]);
      setZipWarnings([]);
      setSelectedLanguages([71]);
      queryClient.invalidateQueries({ queryKey: ['problems'] });
      queryClient.invalidateQueries({ queryKey: ['problems', 'algorithms'] });
    },
    onError: (err) => {
      setError(err.message || 'Failed to create problem');
    }
  });

  const validateMutation = useMutation({
    mutationFn: async ({ languageId, sourceCode }) => {
      const normalizedCases = testCases.map((testCase, index) => ({
        index: index + 1,
        input: testCase.input,
        output: testCase.output,
        points: testCase.points
      }));

      return authFetch('/api/judge/validate', {
        method: 'POST',
        body: {
          languageId,
          sourceCode,
          cpuTimeLimit: form.cpuTimeLimit ? Number(form.cpuTimeLimit) : undefined,
          memoryLimit: form.memoryLimit ? Number(form.memoryLimit) : undefined,
          testCases: normalizedCases
        }
      });
    },
    onSuccess: (response) => {
      setValidationResult(response);
      setValidationError('');
    },
    onError: (err) => {
      setValidationError(err.message || 'Failed to validate test cases');
      setValidationResult(null);
    }
  });

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (event) => {
    const { name, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: checked }));
  };

  const canAddMoreAlgorithms = form.algorithms.length < 10;

  const handleAlgorithmAdd = (rawValue) => {
    if (!canAddMoreAlgorithms) {
      return;
    }
    const normalized = String(rawValue ?? '')
      .trim()
      .replace(/\s+/g, ' ');
    if (!normalized) {
      return;
    }
    if (form.algorithms.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
      setAlgorithmInput('');
      return;
    }
    setForm((prev) => ({ ...prev, algorithms: [...prev.algorithms, normalized] }));
    setAlgorithmInput('');
  };

  const handleAlgorithmRemove = (value) => {
    setForm((prev) => ({
      ...prev,
      algorithms: prev.algorithms.filter((algorithm) => algorithm !== value)
    }));
  };

  const handleAlgorithmKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      handleAlgorithmAdd(algorithmInput);
    } else if (event.key === 'Backspace' && !algorithmInput && form.algorithms.length) {
      const next = [...form.algorithms];
      next.pop();
      setForm((prev) => ({ ...prev, algorithms: next }));
    }
  };

  const suggestedAlgorithms = useMemo(() => {
    const source = algorithmsQuery.data ?? [];
    const selected = new Set(form.algorithms.map((item) => item.toLowerCase()));
    const searchTerm = algorithmInput.trim().toLowerCase();
    return source
      .filter((item) => !selected.has(item.toLowerCase()))
      .filter((item) => !searchTerm || item.toLowerCase().includes(searchTerm))
      .slice(0, 8);
  }, [algorithmInput, algorithmsQuery.data, form.algorithms]);

  const handleAddLanguage = () => {
    const value = Number(languageSelection);
    if (!Number.isFinite(value)) {
      return;
    }
    setSelectedLanguages((prev) => (prev.includes(value) ? prev : [...prev, value]));
  };

  const handleRemoveLanguage = (value) => {
    setSelectedLanguages((prev) => prev.filter((item) => item !== value));
  };

  const handleOpenAddTestCase = () => {
    setEditingTestCaseIndex(null);
    setIsTestCaseModalOpen(true);
  };

  const handleEditTestCase = (index) => {
    setEditingTestCaseIndex(index);
    setIsTestCaseModalOpen(true);
  };

  const handleDeleteTestCase = (index) => {
    setTestCases((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveTestCase = (nextTestCase) => {
    setTestCases((prev) => {
      if (editingTestCaseIndex !== null) {
        return prev.map((item, idx) =>
          idx === editingTestCaseIndex ? { ...item, ...nextTestCase } : item
        );
      }
      return [...prev, { uid: generateUid(), ...nextTestCase }];
    });
    setIsTestCaseModalOpen(false);
    setEditingTestCaseIndex(null);
    setError('');
  };

  const handleZipUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('trimWhitespace', trimWhitespace ? 'true' : 'false');

    try {
      const response = await authFetch('/api/problems/testcases/zip-parse', {
        method: 'POST',
        body: formData
      });

      const parsed = (response?.testCases ?? []).map((item) => ({
        uid: generateUid(),
        input: item.input,
        output: item.output,
        points: item.points ?? 1
      }));

      if (!parsed.length) {
        setError('No valid test case pairs were found in the archive.');
      } else {
        setTestCases(parsed);
        setError('');
      }

      setZipWarnings(response?.warnings ?? []);
    } catch (uploadError) {
      setError(uploadError.message || 'Failed to parse test case archive');
    } finally {
      event.target.value = '';
    }
  };

  const handleValidateTestCases = () => {
    if (!testCases.length) {
      setError('Add at least one test case before running validation.');
      return;
    }
    if (!(languages ?? []).length) {
      setError('Programming languages are still loading. Please try again shortly.');
      return;
    }
    setValidationResult(null);
    setValidationError('');
    setValidationModalOpen(true);
  };

  const handleValidationSubmit = ({ languageId, sourceCode }) => {
    validateMutation.mutate({ languageId, sourceCode });
  };

  const totalPoints = useMemo(
    () => testCases.reduce((sum, testCase) => sum + (testCase.points || 0), 0),
    [testCases]
  );

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!testCases.length) {
      setError('At least one test case is required.');
      return;
    }

    if (!selectedLanguages.length) {
      setError('Select at least one Judge0 language.');
      return;
    }

    const payload = {
      title: form.title.trim(),
      statement: form.statement,
      difficulty: form.difficulty,
      isPublic: form.isPublic,
      inputFormat: form.inputFormat || undefined,
      outputFormat: form.outputFormat || undefined,
      constraints: form.constraints || undefined,
      judge0LanguageIds: selectedLanguages,
      samples:
        form.sampleInput && form.sampleOutput
          ? [
              {
                input: form.sampleInput,
                output: form.sampleOutput
              }
            ]
          : [],
      testCases: testCases.map((testCase) => ({
        input: testCase.input,
        output: testCase.output,
        points: testCase.points
      })),
      algorithms: form.algorithms,
      cpuTimeLimit: form.cpuTimeLimit ? Number(form.cpuTimeLimit) : undefined,
      memoryLimit: form.memoryLimit ? Number(form.memoryLimit) : undefined
    };

    createMutation.mutate(payload);
  };

  const editingTestCase =
    editingTestCaseIndex !== null ? testCases[editingTestCaseIndex] : undefined;

  const languages = languagesQuery.data ?? [];
  const selectedLanguageObjects = languages.filter((lang) => selectedLanguages.includes(lang.id));

  return (
    <section className="page admin-create-page">
      <header className="page-header">
        <div>
          <h1>Create Problem</h1>
          <p>Enhance the problem set with new statements and thorough test coverage.</p>
        </div>
      </header>

      <form className="admin-card" onSubmit={handleSubmit}>
        <label>
          Title
          <input name="title" value={form.title} onChange={handleInputChange} required />
        </label>

        <label>
          Difficulty
          <select name="difficulty" value={form.difficulty} onChange={handleInputChange}>
            <option value="BASIC">BASIC</option>
            <option value="EASY">EASY</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HARD">HARD</option>
          </select>
        </label>

        <label className="checkbox">
          <input
            type="checkbox"
            name="isPublic"
            checked={form.isPublic}
            onChange={handleCheckboxChange}
          />
          Public
        </label>

        <label>
          Statement
          <textarea
            name="statement"
            value={form.statement}
            onChange={handleInputChange}
            rows={6}
            required
          />
        </label>

        <label>
          Input Format
          <textarea
            name="inputFormat"
            value={form.inputFormat}
            onChange={handleInputChange}
            rows={3}
          />
        </label>

        <label>
          Output Format
          <textarea
            name="outputFormat"
            value={form.outputFormat}
            onChange={handleInputChange}
            rows={3}
          />
        </label>

        <label>
          Constraints
          <textarea
            name="constraints"
            value={form.constraints}
            onChange={handleInputChange}
            rows={3}
          />
        </label>

        <div className="grid-two-columns">
          <label>
            CPU Time Limit (seconds)
            <input
              name="cpuTimeLimit"
              type="number"
              min="0.1"
              max="30"
              step="0.1"
              value={form.cpuTimeLimit}
              onChange={handleInputChange}
            />
          </label>
          <label>
            Memory Limit (MB)
            <input
              name="memoryLimit"
              type="number"
              min="16"
              max="1024"
              value={form.memoryLimit}
              onChange={handleInputChange}
            />
          </label>
        </div>

        <label>
          Algorithms
          <div className="algorithm-field">
            <div className="algorithm-chips">
              {form.algorithms.map((algorithm) => (
                <span key={algorithm} className="algorithm-chip">
                  {algorithm}
                  <button
                    type="button"
                    aria-label={`Remove ${algorithm}`}
                    onClick={() => handleAlgorithmRemove(algorithm)}
                  >
                    ×
                  </button>
                </span>
              ))}
              {canAddMoreAlgorithms && (
                <input
                  type="text"
                  value={algorithmInput}
                  onChange={(event) => setAlgorithmInput(event.target.value)}
                  onFocus={() => {
                    setShowSuggestions(true);
                    if (!algorithmsQuery.isFetched && !algorithmsQuery.isFetching) {
                      algorithmsQuery.refetch();
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowSuggestions(false), 120);
                  }}
                  onKeyDown={handleAlgorithmKeyDown}
                  placeholder={
                    algorithmsQuery.isFetching ? 'Loading algorithms…' : 'Add algorithm (press Enter)'
                  }
                />
              )}
            </div>
            {showSuggestions && suggestedAlgorithms.length > 0 && (
              <div className="algorithm-suggestions">
                {suggestedAlgorithms.map((option) => (
                  <button
                    type="button"
                    key={option}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleAlgorithmAdd(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
            {!canAddMoreAlgorithms && (
              <div className="algorithm-helper">Maximum of 10 algorithms reached.</div>
            )}
          </div>
        </label>

        <div className="language-picker">
          <h3>Judge0 Languages</h3>
          <div className="language-picker__content">
            <select
              value={languageSelection}
              onChange={(event) => setLanguageSelection(event.target.value)}
            >
              {(languages ?? []).map((language) => (
                <option key={language.id} value={language.id}>
                  {language.name}
                </option>
              ))}
            </select>
            <button type="button" className="secondary" onClick={handleAddLanguage}>
              Add Language
            </button>
          </div>
          <div className="language-chips">
            {selectedLanguageObjects.map((language) => (
              <span key={language.id} className="algorithm-chip">
                {language.name}
                <button type="button" onClick={() => handleRemoveLanguage(language.id)}>
                  ×
                </button>
              </span>
            ))}
            {!selectedLanguageObjects.length && <span className="helper-text">No languages selected.</span>}
          </div>
        </div>

        <label>
          Sample Input
          <textarea
            name="sampleInput"
            value={form.sampleInput}
            onChange={handleInputChange}
            rows={3}
          />
        </label>

        <label>
          Sample Output
          <textarea
            name="sampleOutput"
            value={form.sampleOutput}
            onChange={handleInputChange}
            rows={3}
          />
        </label>

        <section className="testcase-section">
          <header className="testcase-section__header">
            <div>
              <h3>Test Cases</h3>
              <p>
                Define the evaluation set or import a ZIP with <code>N.in</code>/<code>N.out</code>{' '}
                pairs.
              </p>
            </div>
            <div className="testcase-section__stats">
              <span>{testCases.length} cases</span>
              <span>{totalPoints} points</span>
            </div>
          </header>

          <div className="testcase-toolbar">
            <button type="button" className="secondary" onClick={handleOpenAddTestCase}>
              Add Test Case
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload ZIP
            </button>
            <button type="button" onClick={handleValidateTestCases}>
              Validate Test Cases
            </button>
          </div>

          <div className="zip-options">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={trimWhitespace}
                onChange={(event) => setTrimWhitespace(event.target.checked)}
              />
              Trim trailing whitespace on import
            </label>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            style={{ display: 'none' }}
            onChange={handleZipUpload}
          />

          {zipWarnings.length > 0 && (
            <div className="zip-warnings">
              <strong>Import warnings:</strong>
              <ul>
                {zipWarnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {testCases.length ? (
            <table className="testcase-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Input</th>
                  <th>Output</th>
                  <th>Points</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {testCases.map((testCase, index) => (
                  <tr key={testCase.uid}>
                    <td>{index + 1}</td>
                    <td>
                      <pre>{testCase.input}</pre>
                    </td>
                    <td>
                      <pre>{testCase.output}</pre>
                    </td>
                    <td>{testCase.points}</td>
                    <td className="testcase-table__actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => handleEditTestCase(index)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => handleDeleteTestCase(index)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="testcase-empty">Add or import test cases to continue.</div>
          )}
        </section>

        <button type="submit" disabled={createMutation.isLoading}>
          {createMutation.isLoading ? 'Creating…' : 'Create problem'}
        </button>

        {error && <div className="form-message error">{error}</div>}
      </form>

      <TestCaseModal
        open={isTestCaseModalOpen}
        initialValue={editingTestCase}
        onCancel={() => {
          setIsTestCaseModalOpen(false);
          setEditingTestCaseIndex(null);
        }}
        onSave={handleSaveTestCase}
      />

      <ValidateTestCasesModal
        open={validationModalOpen}
        languages={languages}
        defaultLanguageId={selectedLanguages[0] ?? languages[0]?.id}
        isLoading={validateMutation.isLoading}
        error={validationError}
        onCancel={() => setValidationModalOpen(false)}
        onSubmit={handleValidationSubmit}
        validationResult={validationResult}
        totalPoints={totalPoints}
      />
    </section>
  );
}

export default AdminCreatePage;
