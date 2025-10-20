import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function RequireAdmin({ children }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="page-message">Loading session…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!['admin', 'super_admin'].includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default RequireAdmin;
