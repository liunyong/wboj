import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import Heatmap from '../components/Heatmap.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDateTime } from '../utils/date.js';

const currentYear = new Date().getUTCFullYear();
const selectableYears = [currentYear, currentYear - 1, currentYear - 2];

function DashboardPage() {
  const { authFetch } = useAuth();
  const [year, setYear] = useState(currentYear);

  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary', year],
    queryFn: async () => authFetch(`/api/dashboard/me/summary?year=${year}`)
  });

  const heatmapQuery = useQuery({
    queryKey: ['dashboard', 'heatmap', year],
    queryFn: async () => authFetch(`/api/dashboard/me/heatmap?year=${year}`)
  });

  const submissionsQuery = useQuery({
    queryKey: ['submissions', 'mine', 'dashboard'],
    queryFn: async () => {
      const response = await authFetch('/api/submissions/mine');
      return response?.items ?? [];
    }
  });

  const summary = summaryQuery.data ?? {};
  const heatmapData = heatmapQuery.data?.items ?? [];

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Track your yearly progress and submission history.</p>
        </div>
        <div className="page-controls">
          <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {selectableYears.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </header>

      {summaryQuery.isLoading ? (
        <div className="page-message">Loading summary…</div>
      ) : (
        <div className="summary-grid">
          <SummaryCard label="Total Submissions" value={summary.totalSubmissions ?? 0} />
          <SummaryCard label="Accepted" value={summary.totalAC ?? 0} accent="success" />
          <SummaryCard label="Wrong Answer" value={summary.totalWA ?? 0} />
          <SummaryCard label="Time Limit" value={summary.totalTLE ?? 0} />
          <SummaryCard label="Runtime Error" value={summary.totalRTE ?? 0} />
          <SummaryCard label="Compile Error" value={summary.totalCE ?? 0} />
        </div>
      )}

      <article className="dashboard-section">
        <h2>Yearly Activity</h2>
        {heatmapQuery.isLoading ? (
          <div className="page-message">Loading activity…</div>
        ) : (
          <Heatmap year={year} items={heatmapData} />
        )}
      </article>

      <article className="dashboard-section">
        <h2>Recent Submissions</h2>
        {submissionsQuery.isLoading && <div className="page-message">Loading…</div>}
        {!submissionsQuery.isLoading && !submissionsQuery.data?.length && (
          <div className="page-message">No submissions recorded yet.</div>
        )}
        {submissionsQuery.data?.length ? (
          <table className="submissions-table">
            <thead>
              <tr>
                <th>Problem</th>
                <th>Verdict</th>
                <th>Language</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {submissionsQuery.data.map((submission) => (
                <tr key={submission.id}>
                  <td>
                    {submission.problem?.title && submission.problem?.problemId ? (
                      <Link to={`/problems/${submission.problem.problemId}`}>
                        {submission.problem.title} (#{submission.problem.problemId})
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={`verdict verdict-${submission.verdict?.toLowerCase()}`}>
                    {submission.verdict}
                  </td>
                  <td>{submission.languageId}</td>
                  <td>{formatDateTime(submission.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </article>
    </section>
  );
}

function SummaryCard({ label, value, accent }) {
  return (
    <div className={`summary-card ${accent ? `summary-${accent}` : ''}`}>
      <div className="summary-card__value">{value}</div>
      <div className="summary-card__label">{label}</div>
    </div>
  );
}

export default DashboardPage;
