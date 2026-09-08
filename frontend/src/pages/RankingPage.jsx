import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext.jsx';

// 이름 첫 글자 — 아바타 없을 때 대체
const initialOf = (value) => (value ?? '?').trim().charAt(0).toUpperCase() || '?';

// 역할 → 뱃지 라벨 (레퍼런스의 PRO 자리)
const badgeFor = (role) => {
  if (role === 'super_admin') return 'ROOT';
  if (role === 'admin') return 'ADMIN';
  return null;
};

function Avatar({ src, name, className = '' }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        className={`rk-avatar ${className}`}
        src={src}
        alt={name}
        onError={() => setFailed(true)}
      />
    );
  }
  return <div className={`rk-avatar rk-avatar--fallback ${className}`}>{initialOf(name)}</div>;
}

// 시상대 카드 — 1/2/3위
function PodiumCard({ row, place, isMe }) {
  const badge = badgeFor(row.role);
  return (
    <div className={`rk-podium-card rk-podium-card--${place} ${isMe ? 'is-me' : ''}`}>
      {badge && <span className="rk-badge rk-badge--pill">{badge}</span>}
      <div className="rk-podium-card__avatar">
        <Avatar src={row.avatarUrl} name={row.name} />
      </div>
      <div className="rk-podium-card__name">{row.name}</div>
      <div className="rk-podium-card__foot">
        <span className="rk-score">
          Score <strong>{row.totalPoints}</strong>
        </span>
        <span className="rk-rank">
          Rank <strong>#{row.rank}</strong>
        </span>
      </div>
    </div>
  );
}

function RankingPage() {
  const { authFetch, user } = useAuth();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const rankingQuery = useQuery({
    queryKey: ['ranking', from, to],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const query = params.toString();
      const response = await authFetch(`/api/ranking${query ? `?${query}` : ''}`, {}, { skipAuth: true });
      return response?.items ?? [];
    },
    staleTime: 60 * 1000
  });

  const items = rankingQuery.data ?? [];
  const clearFilter = () => {
    setFrom('');
    setTo('');
  };
  const isMe = (row) => row.username === user?.username;

  // 상위 3명은 시상대, 나머지는 표
  const top3 = items.slice(0, 3);
  const first = top3.find((r) => r.rank === 1) ?? top3[0];
  const second = top3.find((r) => r.rank === 2) ?? top3[1];
  const third = top3.find((r) => r.rank === 3) ?? top3[2];
  const rest = items.slice(3);

  return (
    <section className="page ranking-page">
      <header className="page-header">
        <div>
          <h1>Ranking</h1>
          <p>Total score across problems, weighted by each problem&apos;s points.</p>
        </div>
        <div className="rk-filter">
          <label>
            From
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          {(from || to) && (
            <button type="button" className="secondary" onClick={clearFilter}>
              Clear
            </button>
          )}
        </div>
      </header>

      {rankingQuery.isLoading ? (
        <div className="testcase-empty">Loading ranking…</div>
      ) : rankingQuery.isError ? (
        <div className="form-message error">Failed to load ranking.</div>
      ) : items.length ? (
        <>
          {/* 시상대: 2위-1위-3위 순서로 배치 */}
          <div className="rk-podium">
            {second && <PodiumCard row={second} place="second" isMe={isMe(second)} />}
            {first && <PodiumCard row={first} place="first" isMe={isMe(first)} />}
            {third && <PodiumCard row={third} place="third" isMe={isMe(third)} />}
          </div>

          {/* 4위부터는 표 */}
          {rest.length > 0 && (
            <div className="rk-table-card">
              <div className="rk-table">
                <div className="rk-table__head">
                  <span>RANK</span>
                  <span>NAME</span>
                  <span>CHALLENGES</span>
                  <span>SOLVED</span>
                  <span>SCORE</span>
                </div>
                {rest.map((row) => {
                  const badge = badgeFor(row.role);
                  return (
                    <div
                      key={row.username}
                      className={`rk-table__row ${isMe(row) ? 'is-me' : ''}`}
                    >
                      <span className="rk-cell-rank">{row.rank}</span>
                      <span className="rk-cell-name">
                        <span className="rk-cell-avatar">
                          <Avatar src={row.avatarUrl} name={row.name} className="rk-avatar--sm" />
                          {badge && <span className="rk-badge rk-badge--corner">{badge}</span>}
                        </span>
                        {row.name}
                      </span>
                      <span>{row.challenges}</span>
                      <span>{row.solved}</span>
                      <span className="rk-cell-score">{row.totalPoints}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="testcase-empty">No ranking data yet.</div>
      )}
    </section>
  );
}

export default RankingPage;
