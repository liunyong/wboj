import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { usePageSeo } from '../hooks/useSeo.js';

const day = (value) => new Date(value).toLocaleDateString(undefined, { timeZone: 'UTC' });

function SeasonManager() {
  const { authFetch } = useAuth();
  const client = useQueryClient();
  const [draft, setDraft] = useState({ name: '', startDate: '', endDate: '', active: true });
  const create = useMutation({
    mutationFn: () => authFetch('/api/ratings/seasons', { method: 'POST', body: {
      ...draft, startDate: new Date(`${draft.startDate}T00:00:00Z`).toISOString(), endDate: new Date(`${draft.endDate}T00:00:00Z`).toISOString()
    } }, { retry: false }),
    onSuccess: () => {
      setDraft({ name: '', startDate: '', endDate: '', active: true });
      for (const key of ['seasons', 'ratings', 'leaderboard']) client.invalidateQueries({ queryKey: [key] });
    }
  });
  return <details className="dashboard-section season-manager"><summary>Manage Seasons · Admin</summary>
    <p className="muted">Create a season with fixed UTC dates. The end date is exclusive. Periods cannot overlap, and completed results are archived automatically.</p>
    <form onSubmit={(event) => { event.preventDefault(); if (!create.isPending) create.mutate(); }}>
      <div className="season-form-grid">
        <label>Name<input required maxLength={80} placeholder="Fall 2026" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
        <label>Start date (UTC)<input required type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} /></label>
        <label>End date (UTC, exclusive)<input required type="date" value={draft.endDate} min={draft.startDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} /></label>
      </div>
      <label className="checkbox"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />Active during these dates</label>
      <button className="primary" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create season'}</button>
      {create.isError && <p className="form-message error" role="alert">{create.error.message}</p>}
      {create.isSuccess && <p className="form-message success" role="status">Season created.</p>}
    </form>
  </details>;
}

export default function LeaderboardPage() {
  const { authFetch, user } = useAuth();
  const [params, setParams] = useSearchParams();
  const seasonId = params.get('season') || '';
  const [scope, setScope] = useState(seasonId ? 'season' : 'overall');
  const [page, setPage] = useState(1);
  usePageSeo({ title: 'WBOJ Leaderboard | Portfolio Ratings', description: 'Overall and season rankings based on your problem-solving portfolio.', path: '/leaderboard' });
  const seasons = useQuery({ queryKey: ['seasons'], queryFn: () => authFetch('/api/ratings/seasons', {}, { skipAuth: true }), refetchInterval: 60000 });
  const query = useQuery({
    queryKey: ['leaderboard', scope, seasonId, page],
    queryFn: () => authFetch(`/api/ratings/leaderboard?scope=${scope}&page=${page}&limit=50${scope === 'season' && seasonId ? `&seasonId=${encodeURIComponent(seasonId)}` : ''}`, {}, { skipAuth: true }),
    refetchInterval: 60000
  });
  const result = query.data;
  return <section className="page leaderboard-page">
    <header className="page-header"><div><span className="eyebrow">PROBLEM-SOLVING PORTFOLIOS</span><h1>Leaderboard</h1><p>Consistent progress, measured by the problems you solve.</p></div><Link to="/dashboard">Your dashboard ↗</Link></header>
    <article className="dashboard-section">
      <div className="section-header">
        <div className="rating-tabs" role="group" aria-label="Ranking scope">
          <button aria-pressed={scope === 'overall'} className={scope === 'overall' ? 'active' : ''} onClick={() => { setScope('overall'); setPage(1); }}>Overall Ranking</button>
          <button aria-pressed={scope === 'season'} className={scope === 'season' ? 'active' : ''} onClick={() => { setScope('season'); setPage(1); }}>Season Ranking</button>
        </div>
        {scope === 'season' && <select aria-label="Season" value={seasonId} onChange={(event) => { setParams(event.target.value ? { season: event.target.value } : {}); setPage(1); }}>
          <option value="">Current season</option>{seasons.data?.items.map((season) => <option key={season.id} value={season.id}>{season.name}{season.finalizedAt ? ' · Final' : ''}</option>)}
        </select>}
      </div>
      {result?.season && <p className="muted">{result.season.name} · {day(result.season.startDate)} – {day(result.season.endDate)} (UTC, end exclusive){result.season.finalizedAt ? ' · Final results' : ''}</p>}
      <p className="muted">Rating = 0.5 × D5 + 0.3 × D10 + 0.2 × D20. Ties: rated solved count, then username, then user ID. Unrated solves never break rating ties.</p>
      {query.isPending && <div className="page-message">Loading rankings…</div>}
      {(query.isError || seasons.isError) && <div className="page-message error" role="alert">Could not load rankings or seasons. <button className="secondary" onClick={() => { query.refetch(); seasons.refetch(); }}>Retry</button></div>}
      {!query.isPending && !query.isError && !result?.items.length && <div className="page-message">{scope === 'season' && !result?.season ? 'No current season. Browse a previous season or check back later.' : 'No participants yet. Solve a problem to begin.'}</div>}
      {!!result?.items.length && <div className="table-scroll"><table className="submissions-table leaderboard-table">
        <thead><tr><th>Rank</th><th>User</th><th>Rating</th><th>Solved Problems</th></tr></thead>
        <tbody>{result.items.map((row) => <tr key={`${row.user}-${row.rank}`} className={row.user === user?.id ? 'leaderboard-current-user' : ''}>
          <td>#{row.rank}</td><td>{row.profilePublic || row.user === user?.id ? <Link to={`/u/${encodeURIComponent(row.username)}`}>{row.username}</Link> : row.username}{row.user === user?.id && <span className="badge">You</span>}</td>
          <td><strong>{row.rating.toLocaleString()}</strong></td><td>{row.solvedCount}<small className="muted"> · {row.ratedSolvedCount} rated</small></td>
        </tr>)}</tbody>
      </table></div>}
      {(result?.totalPages ?? 1) > 1 && <div className="pagination"><button className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {result.totalPages}</span><button className="secondary" disabled={page >= result.totalPages} onClick={() => setPage(page + 1)}>Next</button></div>}
    </article>
    {['admin', 'super_admin'].includes(user?.role) && <SeasonManager />}
  </section>;
}
