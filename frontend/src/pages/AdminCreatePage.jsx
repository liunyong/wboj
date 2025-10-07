import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext.jsx';

const defaultFormState = {
  title: '',
  statement: '',
  difficulty: 'BASIC',
  isPublic: true,
  sampleInput: '',
  sampleOutput: '',
  testInput: '',
  testOutput: '',
  algorithms: []
};

function AdminCreatePage() {
  const { authFetch } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(defaultFormState);
  const [error, setError] = useState('');
  const [algorithmInput, setAlgorithmInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const algorithmsQuery = useQuery({
    queryKey: ['problems', 'algorithms'],
    queryFn: async () => {
      const response = await authFetch('/api/problems/algorithms');
      return response?.items ?? [];
    },
    enabled: false,
    staleTime: 5 * 60 * 1000
  });

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
      queryClient.invalidateQueries({ queryKey: ['problems'] });
      queryClient.invalidateQueries({ queryKey: ['problems', 'algorithms'] });
    },
    onError: (err) => {
      setError(err.message || 'Failed to create problem');
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

  const handleSubmit = (event) => {
    event.preventDefault();

    const payload = {
      title: form.title.trim(),
      statement: form.statement,
      difficulty: form.difficulty,
      isPublic: form.isPublic,
      judge0LanguageIds: [71],
      samples:
        form.sampleInput && form.sampleOutput
          ? [
              {
                input: form.sampleInput,
                output: form.sampleOutput
              }
            ]
          : [],
      testCases: [
        {
          input: form.testInput || '1 1',
          expectedOutput: form.testOutput || '2',
          isPublic: true
        }
      ],
      algorithms: form.algorithms
    };

    createMutation.mutate(payload);
  };

  return (
    <section className="page admin-create-page">
      <header className="page-header">
        <div>
          <h1>Create Problem</h1>
          <p>Publish new challenges and curate the problem library.</p>
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

        <label>
          Public Test Input
          <textarea
            name="testInput"
            value={form.testInput}
            onChange={handleInputChange}
            rows={3}
          />
        </label>

        <label>
          Public Test Output
          <textarea
            name="testOutput"
            value={form.testOutput}
            onChange={handleInputChange}
            rows={3}
          />
        </label>

        <button type="submit" disabled={createMutation.isLoading}>
          {createMutation.isLoading ? 'Creating…' : 'Create problem'}
        </button>

        {error && <div className="form-message error">{error}</div>}
      </form>
    </section>
  );
}

export default AdminCreatePage;
