import { Link } from 'react-router-dom';

import { useProblemArchive } from '../hooks/useProblemArchive.js';

export default function ProblemNavigation({ problemId, isAdmin }) {
  const archive = useProblemArchive(isAdmin ? 'all' : 'public');
  const items = [...(archive.data ?? [])].sort((a, b) => a.problemId - b.problemId);
  const index = items.findIndex((item) => item.problemId === problemId);
  const previous = index > 0 ? items[index - 1] : null;
  const next = index >= 0 ? items[index + 1] : null;

  return (
    <nav className="problem-navigation" aria-label="Problem navigation" aria-busy={archive.isLoading}>
      <Link to="/problems" className="problem-navigation__archive">Problems</Link>
      <div className="problem-navigation__steps">
        {[['Previous', previous, 'M14 6l-6 6 6 6'], ['Next', next, 'M10 6l6 6-6 6']].map(([label, item, path]) => {
          const icon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d={path} /></svg>;
          return item ? (
            <Link key={label} to={`/problems/${item.problemId}`} className="problem-navigation__step" aria-label={`${label} problem`} title={`${label}: #${item.problemId} ${item.title}`}>
              {icon}
            </Link>
          ) : <button key={label} type="button" className="problem-navigation__step" disabled aria-label={`${label} problem`}>{icon}</button>;
        })}
      </div>
    </nav>
  );
}
