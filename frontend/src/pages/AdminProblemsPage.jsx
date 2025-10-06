import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext.jsx';

const defaultFormState = {
  title: '',
  slug: '',
  statement: '',
  difficulty: 'BASIC',
  isPublic: true,
  sampleInput: '',
  sampleOutput: '',
  testInput: '',
  testOutput: ''
};

function AdminProblemsPage() {
  const { authFetch } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(defaultFormState);
  const [error, setError] = useState('');

  const problemsQuery = useQuery({
    queryKey: ['admin', 'problems'],
    queryFn: async () => {
      const response = await authFetch('/api/problems?visibility=all&limit=200');
      return response?.items ?? [];
    }
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        slug: form.slug,
        statement: form.statement,
        difficulty: form.difficulty,
        isPublic: form.isPublic,
        judge0LanguageIds: [71],
        samples:
          form.sampleInput && form.sampleOutput
            ? [{ input: form.sampleInput, output: form.sampleOutput }]
            : [],
        testCases: [
          {
            input: form.testInput || '1 1',
            expectedOutput: form.testOutput || '2',
            isPublic: true
          }
        ]
      };
      return authFetch('/api/problems', { method: 'POST', body: payload });
    },
    onSuccess: () => {
      setForm(defaultFormState);
      setError('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'problems'] });
    },
    onError: (err) => {
      setError(err.message || 'Failed to create problem');
    }
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: ({ id, isPublic }) =>
      authFetch(`/api/problems/${id}`, { method: 'PATCH', body: { isPublic } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'problems'] })
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => authFetch(`/api/problems/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'problems'] })
  });

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  return (
    <section className="page admin-page">
      <header className="page-header">
        <div>
          <h1>Problem Management</h1>
          <p>Create, publish, and maintain problem statements.</p>
        </div>
      </header>

      <div className="admin-grid">
        <form
          className="admin-card"
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate();
          }}
        >
          <h2>Create Problem</h2>
          <label>
            Title
            <input name="title" value={form.title} onChange={handleChange} required />
          </label>
          <label>
            Slug
            <input name="slug" value={form.slug} onChange={handleChange} required />
          </label>
          <label>
            Difficulty
            <select name="difficulty" value={form.difficulty} onChange={handleChange}>
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
              onChange={handleChange}
            />
            Public
          </label>
          <label>
            Statement
            <textarea
              name="statement"
              value={form.statement}
              onChange={handleChange}
              rows={4}
              required
            />
          </label>
          <label>
            Sample Input
            <textarea name="sampleInput" value={form.sampleInput} onChange={handleChange} rows={2} />
          </label>
          <label>
            Sample Output
            <textarea name="sampleOutput" value={form.sampleOutput} onChange={handleChange} rows={2} />
          </label>
          <label>
            Public Test Input
            <textarea name="testInput" value={form.testInput} onChange={handleChange} rows={2} />
          </label>
          <label>
            Public Test Output
            <textarea name="testOutput" value={form.testOutput} onChange={handleChange} rows={2} />
          </label>
          <button type="submit" disabled={createMutation.isLoading}>
            {createMutation.isLoading ? 'Creating…' : 'Create problem'}
          </button>
          {error && <div className="form-message error">{error}</div>}
        </form>

        <div className="admin-card">
          <h2>Existing Problems</h2>
          {problemsQuery.isLoading && <div>Loading…</div>}
          {problemsQuery.isError && <div className="form-message error">Failed to load problems.</div>}
          {problemsQuery.data?.length ? (
            <ul className="admin-list">
              {problemsQuery.data.map((problem) => (
                <li key={problem._id}>
                  <div>
                    <strong>{problem.title}</strong>
                    <span className={`difficulty-tag difficulty-${problem.difficulty?.toLowerCase()}`}>
                      {problem.difficulty}
                    </span>
                    {!problem.isPublic && <span className="problem-card__badge">Private</span>}
                  </div>
                  <div className="admin-actions">
                    <button
                      type="button"
                      onClick={() =>
                        toggleVisibilityMutation.mutate({
                          id: problem._id,
                          isPublic: !problem.isPublic
                        })
                      }
                    >
                      {problem.isPublic ? 'Make Private' : 'Make Public'}
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => deleteMutation.mutate(problem._id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div>No problems found.</div>
          )}
        </div>
      </div>
    </section>
  );
}

export default AdminProblemsPage;
