import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';

const difficulties = ['BASIC', 'EASY', 'MEDIUM', 'HARD'];

function HomePage() {
  const { authFetch, user } = useAuth();
  const [search, setSearch] = useState('');
  const [visibility, setVisibility] = useState(user?.role === 'admin' ? 'all' : 'public');
  const [difficulty, setDifficulty] = useState('');

  useEffect(() => {
    setVisibility(user?.role === 'admin' ? 'all' : 'public');
  }, [user?.role]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['problems', visibility, difficulty],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50', visibility });
      if (difficulty) {
        params.set('difficulty', difficulty);
      }
      const response = await authFetch(`/api/problems?${params.toString()}`);
      return response?.items ?? [];
    }
  });

  const filtered = useMemo(() => {
    if (!data) {
      return [];
    }
    const trimmed = search.trim().toLowerCase();
    if (!trimmed) {
      return data;
    }
    return data.filter((problem) =>
      [problem.title, problem.slug]
        .filter(Boolean)
        .map((value) => value.toLowerCase())
        .some((value) => value.includes(trimmed))
    );
  }, [data, search]);

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Problem Archive</h1>
          <p>Browse challenges and sharpen your coding skills.</p>
        </div>
        <div className="page-controls">
          <input
            type="search"
            placeholder="Search problems"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
            <option value="">All difficulties</option>
            {difficulties.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
          {user?.role === 'admin' && (
            <select value={visibility} onChange={(event) => setVisibility(event.target.value)}>
              <option value="all">All</option>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          )}
        </div>
      </header>

      {isLoading && <div className="page-message">Loading problems…</div>}
      {isError && <div className="page-message error">Failed to load problems.</div>}

      {!isLoading && !isError && (
        <div className="problem-grid">
          {filtered.map((problem) => (
            <Link key={problem._id} to={`/problems/${problem.slug}`} className="problem-card">
              <div className="problem-card__title">{problem.title}</div>
              <div className={`problem-card__difficulty difficulty-${problem.difficulty?.toLowerCase()}`}>
                {problem.difficulty || 'BASIC'}
              </div>
              <div className="problem-card__meta">
                <span>{problem.submissionCount ?? 0} submissions</span>
                <span>{Math.round((problem.acceptanceRate ?? 0) * 100)}% AC</span>
              </div>
              {!problem.isPublic && <span className="problem-card__badge">Private</span>}
            </Link>
          ))}
          {!filtered.length && <div className="page-message">No problems found.</div>}
        </div>
      )}
    </section>
  );
}

export default HomePage;
