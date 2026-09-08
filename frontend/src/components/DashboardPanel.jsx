import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useMemo, useState } from 'react';

function DashboardPanel() {
  const { authFetch, user } = useAuth();
  const [expanded, setExpanded] = useState(false);

  const submissionsQuery = useQuery({
    queryKey: ['mine', 'recentSubmissions'],
    queryFn: async () => {
      try {
        const res = await authFetch('/api/submissions/mine?limit=12');
        return res?.items ?? [];
      } catch (err) {
        return null;
      }
    },
    staleTime: 1000 * 60
  });

  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary', new Date().getUTCFullYear()],
    queryFn: async () => authFetch(`/api/dashboard/me/summary?year=${new Date().getUTCFullYear()}`),
    enabled: Boolean(user),
    staleTime: 1000 * 60
  });

  const sample = [
    { id: 's1', problemTitle: 'A+B', problemId: '1', verdict: 'AC', createdAt: Date.now() - 1000 * 60 * 60 },
    { id: 's2', problemTitle: 'Sum of Two', problemId: '7', verdict: 'WA', createdAt: Date.now() - 1000 * 60 * 60 * 5 },
    { id: 's3', problemTitle: 'Array Sum', problemId: '13', verdict: 'AC', createdAt: Date.now() - 1000 * 60 * 60 * 24 },
    { id: 's4', problemTitle: "Binary Search Practice", problemId: '5', verdict: 'AC', createdAt: Date.now() - 1000 * 60 * 60 * 48 },
    { id: 's5', problemTitle: 'String Manipulation', problemId: '12', verdict: 'WA', createdAt: Date.now() - 1000 * 60 * 60 * 72 }
  ];

  const entries = submissionsQuery.data ?? sample;
  const summary = summaryQuery.data ?? null;

  const localAcceptedCount = useMemo(() => entries.filter((e) => e.verdict === 'AC').length, [entries]);
  const localSubmissionCount = entries.length;

  const acceptedCount = summary?.totalAC ?? localAcceptedCount;
  const submissionCount = summary?.totalSubmissions ?? localSubmissionCount;
  const acceptanceRate = submissionCount ? Math.round((acceptedCount / submissionCount) * 100) : 0;

  // simple per-day counts for last 7 days
  const heatmapWeeks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const mondayOffset = (today.getDay() + 6) % 7;
    const start = new Date(today);
    start.setDate(start.getDate() - mondayOffset - 11 * 7);

    const byDate = new Map();
    entries.forEach((e) => {
      const t = new Date(e.createdAt || Date.now());
      t.setHours(0, 0, 0, 0);
      byDate.set(t.getTime(), (byDate.get(t.getTime()) ?? 0) + 1);
    });

    const weeks = [];
    for (let week = 0; week < 12; week += 1) {
      const days = [];
      for (let day = 0; day < 7; day += 1) {
        const date = new Date(start);
        date.setDate(start.getDate() + week * 7 + day);
        const count = byDate.get(date.getTime()) ?? 0;
        days.push({ date, count });
      }
      weeks.push(days);
    }

    return weeks;
  }, [entries]);

  return (
    <section className={`dashboard-panel ${expanded ? 'expanded' : ''}`}>
      <div className="dashboard-header">
        <div>
          <h2>Dashboard</h2>
          <p className="muted">Your recent activity and submission stats</p>
        </div>
        <div className="dashboard-stats">
          <button type="button" className="stat accepted" onClick={() => setExpanded((s) => !s)}>
            <div className="stat-value">{acceptedCount}</div>
            <div className="stat-label">Accepted</div>
          </button>
          <button type="button" className="stat submissions" onClick={() => setExpanded((s) => !s)}>
            <div className="stat-value">{submissionCount}</div>
            <div className="stat-label">Submissions</div>
          </button>
          <button type="button" className="stat small rate" onClick={() => setExpanded((s) => !s)}>
            <div className="stat-value">{acceptanceRate}%</div>
            <div className="stat-label">Rate</div>
          </button>
        </div>
      </div>

      <div className="dashboard-details open">
        <div className="details-grid">
          <div className="metrics-row">
            <div className="metric-card">
              <div className="metric-value">{acceptedCount}</div>
              <div className="metric-label">Accepted</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{summary?.totalWA ?? entries.filter((e) => e.verdict === 'WA').length}</div>
              <div className="metric-label">Wrong Answer</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{summary?.totalTLE ?? entries.filter((e) => e.verdict === 'TLE').length}</div>
              <div className="metric-label">Time Limit</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{summary?.totalRTE ?? entries.filter((e) => e.verdict === 'RTE').length}</div>
              <div className="metric-label">Runtime Error</div>
            </div>
            <div className="metric-card compile-card">
              <div className="metric-value">{summary?.totalCE ?? entries.filter((e) => e.verdict === 'CE').length}</div>
              <div className="metric-label">Compile Error</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{submissionCount}</div>
              <div className="metric-label">Total Submissions</div>
            </div>
          </div>
        </div>
      </div>


      <div className="dashboard-body">
        <div className="recent-solves">
          <h3>Recent Attempts</h3>
          {entries.length === 0 && <div className="muted">No recent activity</div>}
          <ul>
            {entries.map((s) => (
              <li key={s.id} className={`recent-item ${s.verdict === 'AC' ? 'ok' : 'bad'}`}>
                <div className="recent-left">
                  <Link to={`/problems/${s.problemId}`} className="recent-title">
                    {s.problemTitle}
                  </Link>
                  <div className="recent-meta muted">{s.verdict}</div>
                </div>
                <div className="recent-right muted">{new Date(s.createdAt || Date.now()).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        </div>

        <div className="dashboard-heatmap">
          <h3>Submission Heatmap</h3>
          <div className="heatmap-grid">
            {heatmapWeeks.map((week, weekIndex) => (
              <div key={weekIndex} className="heatmap-week">
                {week.map((day) => {
                  const label = day.date.toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  });
                  const level = day.count === 0 ? 0 : day.count === 1 ? 1 : day.count === 2 ? 2 : 3;
                  return (
                    <div
                      key={day.date.toISOString()}
                      className={`heatmap-cell level-${level}`}
                      title={`${label}: ${day.count} submissions`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="heatmap-legend">
            <span>Less</span>
            <div className="legend-swatch level-0" />
            <div className="legend-swatch level-1" />
            <div className="legend-swatch level-2" />
            <div className="legend-swatch level-3" />
            <span>More</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default DashboardPanel;
