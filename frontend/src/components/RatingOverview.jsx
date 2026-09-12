import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import RatingChart from './RatingChart.jsx';

const number = (value) => Number(value ?? 0).toLocaleString();
const rank = (value) => value ? `#${number(value)}` : '—';

export function RatingOverview({ data }) {
  const [scope, setScope] = useState('overall');
  const { overall, currentSeason, previousSeasons = [] } = data;
  const selected = scope === 'season' && currentSeason ? currentSeason : overall;
  return <div className="rating-overview">
    <div className="rating-metrics">
      <div className="rating-metric rating-metric--primary"><span className="eyebrow">OVERALL RATING</span><strong>{number(overall.rating)}</strong><span>Portfolio Rating</span></div>
      <div className="rating-metric"><span>Overall Rank</span><strong>{rank(overall.rank)}</strong><Link to="/leaderboard">View leaderboard ↗</Link></div>
      <div className="rating-metric"><span>Current Season Rating</span><strong>{currentSeason ? number(currentSeason.rating) : '—'}</strong><span>{currentSeason?.name ?? 'No active season'}</span></div>
      <div className="rating-metric"><span>Current Season Rank</span><strong>{rank(currentSeason?.rank)}</strong><span>{currentSeason ? 'New first accepts this season' : 'The next season awaits'}</span></div>
      <div className="rating-metric"><span>Total Solved Problems</span><strong>{number(overall.solvedCount)}</strong><span>{number(overall.ratedSolvedCount)} rated solves</span></div>
    </div>
    <article className="dashboard-section">
      <div className="section-header"><div><span className="eyebrow">YOUR PROGRESS</span><h2>Rating History</h2></div>
        <div className="rating-tabs" role="group" aria-label="Rating history scope">
          <button className={scope === 'overall' ? 'active' : ''} aria-pressed={scope === 'overall'} onClick={() => setScope('overall')}>Overall</button>
          <button className={scope === 'season' ? 'active' : ''} aria-pressed={scope === 'season'} disabled={!currentSeason} onClick={() => setScope('season')}>Current Season</button>
        </div>
      </div>
      <RatingChart key={scope} history={selected.history} label={scope === 'overall' ? 'Overall Rating' : 'Current Season Rating'} />
      <div className="rating-anchors">{selected.anchors?.map((anchor) => <div key={anchor.depth}>
        <span>D{anchor.depth} <small>{anchor.depth}th hardest solve</small></span>
        <strong>{anchor.difficulty ?? 'Building'}</strong>
        <progress aria-label={`D${anchor.depth} coverage`} max={anchor.depth} value={anchor.covered} />
        <small>{anchor.covered} / {anchor.depth} rated problems</small>
      </div>)}</div>
      <details className="rating-policy"><summary>How Portfolio Rating works</summary>
        <p>Rating = 0.5 × D5 + 0.3 × D10 + 0.2 × D20. Each problem counts once, at its first AC. Unrated problems are excluded. WA and submission counts never subtract rating.</p>
        <p>Before an anchor has enough rated solves, its value is 800 × solved count ÷ anchor depth. This gives 112 for one rated solve and 224 for two, keeping small portfolios conservative. At 5, 10 and 20 solves, the corresponding actual difficulty replaces the fallback.</p>
        <p>Season ratings include only lifetime first accepts within that season, using UTC dates. Completed season results stay fixed.</p>
      </details>
    </article>
    <article className="dashboard-section">
      <div className="section-header"><h2>Previous Season Results</h2><Link to="/leaderboard">Season rankings ↗</Link></div>
      {!previousSeasons.length ? <p className="muted">Your completed seasons will appear here.</p> : <div className="table-scroll"><table className="submissions-table">
        <thead><tr><th>Season</th><th>Rating</th><th>Rank</th><th>Solved Problems</th></tr></thead>
        <tbody>{previousSeasons.map((season) => <tr key={season.id}><td><Link to={`/leaderboard?season=${season.id}`}>{season.name}</Link></td><td>{number(season.rating)}</td><td>{rank(season.rank)}</td><td>{number(season.solvedCount)}</td></tr>)}</tbody>
      </table></div>}
    </article>
  </div>;
}

export default function MyRatingOverview() {
  const { user, authFetch } = useAuth();
  const query = useQuery({ queryKey: ['ratings', user?.id], queryFn: () => authFetch('/api/ratings/me'), enabled: Boolean(user), refetchInterval: 60000 });
  if (query.isPending) return <div className="page-message">Loading your rating profile…</div>;
  if (query.isError) return <div className="page-message error" role="alert">Could not load ratings. <button className="secondary" onClick={() => query.refetch()}>Retry</button></div>;
  return <RatingOverview data={query.data} />;
}
