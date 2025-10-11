import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { formatDateTime } from '../utils/date.js';

function UserDashboardPage() {
  const { username = '' } = useParams();
  const { authFetch } = useAuth();

  const dashboardQuery = useQuery({
    queryKey: ['user-dashboard', username],
    queryFn: async () => authFetch(`/api/users/${encodeURIComponent(username)}/dashboard`),
    retry: false
  });

  const { solved = [], attempted = [], user: profileUser } = dashboardQuery.data ?? {};

  const statusLabel = useMemo(() => {
    if (!profileUser) {
      return '';
    }
    return profileUser.profilePublic ? 'Public profile' : 'Private profile';
  }, [profileUser]);

  return (
    <section className="page user-dashboard-page">
      <header className="page-header">
        <div>
          <h1>{username}</h1>
          <p>{statusLabel}</p>
        </div>
      </header>

      {dashboardQuery.isLoading && <div className="page-message">Loading dashboard…</div>}

      {dashboardQuery.isError && (
        <div className="page-message error">
          {dashboardQuery.error?.status === 403 && 'This profile is private.'}
          {dashboardQuery.error?.status === 404 && 'User not found.'}
          {![403, 404].includes(dashboardQuery.error?.status ?? 0) &&
            'Failed to load user dashboard.'}
        </div>
      )}

      {!dashboardQuery.isLoading && !dashboardQuery.isError && (
        <div className="user-dashboard-grid">
          <article className="dashboard-card">
            <header>
              <h2>Solved ({solved.length})</h2>
            </header>
            {solved.length === 0 ? (
              <div className="card-empty">No problems solved yet.</div>
            ) : (
              <ul className="dashboard-list">
                {solved.map((entry) => (
                  <li key={entry.latestAcceptedSubmissionId}>
                    <div>
                      <Link to={`/problems/${entry.problemId}`}>Problem #{entry.problemId}</Link>
                      <span className="muted">{entry.problemTitle}</span>
                    </div>
                    <span className="muted">Accepted {formatDateTime(entry.acceptedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="dashboard-card">
            <header>
              <h2>Attempted ({attempted.length})</h2>
            </header>
            {attempted.length === 0 ? (
              <div className="card-empty">No attempts recorded yet.</div>
            ) : (
              <ul className="dashboard-list">
                {attempted.map((entry) => (
                  <li key={`${entry.problemId}-${entry.lastTriedAt}`}>
                    <div>
                      <Link to={`/problems/${entry.problemId}`}>Problem #{entry.problemId}</Link>
                      <span className="muted">{entry.problemTitle}</span>
                    </div>
                    <span className="muted">Last tried {formatDateTime(entry.lastTriedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      )}
    </section>
  );
}

export default UserDashboardPage;
