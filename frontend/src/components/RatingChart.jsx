import { useId, useState } from 'react';

const dateLabel = (date) => new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

export default function RatingChart({ history = [], label = 'Overall Rating' }) {
  const id = useId();
  const [selected, setSelected] = useState(null);
  const points = history.filter((point) => Number.isFinite(point.rating) && Number.isFinite(+new Date(point.at)));
  if (!points.length) return <div className="rating-chart-empty">Your rating journey starts with your first rated solve.</div>;
  const first = +new Date(points[0].at);
  const last = +new Date(points[points.length - 1].at);
  const start = first - Math.max(86400000, (last - first) * 0.04);
  const end = Math.max(last, first + 86400000);
  const ceiling = Math.max(200, Math.ceil(Math.max(...points.map((point) => point.rating)) / 200) * 200);
  const x = (date) => 64 + (+new Date(date) - start) / (end - start) * 690;
  const y = (rating) => 210 - rating / ceiling * 178;
  const coords = `64,210 ${points.map((point) => `${x(point.at)},${y(point.rating)}`).join(' ')}`;
  const focused = points[selected] ?? points[points.length - 1];
  return <div className="rating-chart">
    <div className="rating-chart__caption" aria-live="polite">
      <strong>{focused.rating.toLocaleString()}</strong>
      <span>{dateLabel(focused.at)} · {focused.reason === 'difficulty_update' ? 'Difficulty updated' : 'First accepted solve'}</span>
    </div>
    <svg viewBox="0 0 820 250" role="img" aria-labelledby={`${id}-title ${id}-description`}>
      <title id={`${id}-title`}>{label} over time</title>
      <desc id={`${id}-description`}>Date on the horizontal axis, rating on the vertical axis. {points.length} rating changes. Latest rating {points[points.length - 1].rating}. Use the history table below for exact values.</desc>
      {[0, 0.5, 1].map((fraction) => <g key={fraction}>
        <line x1="64" x2="754" y1={y(ceiling * fraction)} y2={y(ceiling * fraction)} className="rating-chart__grid" />
        <text x="50" y={y(ceiling * fraction) + 4} textAnchor="end">{ceiling * fraction}</text>
      </g>)}
      <polygon points={`${coords} ${x(points[points.length - 1].at)},210`} className="rating-chart__area" />
      <polyline points={coords} className="rating-chart__line" />
      {points.map((point, index) => <circle key={`${point.at}-${index}`} cx={x(point.at)} cy={y(point.rating)} r="4"
        className="rating-chart__point" tabIndex={0} role="button" aria-label={`${dateLabel(point.at)}: ${point.rating}`}
        onFocus={() => setSelected(index)} onMouseEnter={() => setSelected(index)} onClick={() => setSelected(index)}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(index); } }}>
        <title>{dateLabel(point.at)}: {point.rating}</title>
      </circle>)}
      <text x="64" y="240">{dateLabel(first)}</text>
      <text x="754" y="240" textAnchor="end">{dateLabel(end)}</text>
    </svg>
    <details className="rating-history-table"><summary>View rating history ({points.length})</summary>
      <div className="table-scroll"><table className="submissions-table"><thead><tr><th>Date (UTC)</th><th>Rating</th><th>Change</th></tr></thead>
        <tbody>{[...points].reverse().map((point, index) => <tr key={`${point.at}-${index}`}>
          <td>{new Date(point.at).toISOString().replace('T', ' ').slice(0, 19)}</td><td>{point.rating}</td>
          <td>{point.reason === 'difficulty_update' ? 'Difficulty updated' : 'First AC'}</td>
        </tr>)}</tbody></table></div>
    </details>
  </div>;
}
