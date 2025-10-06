import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function Header() {
  const { user, logout, isLoading } = useAuth();

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <Link to="/">Online Judge</Link>
      </div>
      <nav className="app-header__nav">
        <NavLink to="/" className={({ isActive }) => (isActive ? 'active' : '')}>
          Problems
        </NavLink>
        {user && (
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>
            Dashboard
          </NavLink>
        )}
        {user?.role === 'admin' && (
          <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>
            Admin
          </NavLink>
        )}
      </nav>
      <div className="app-header__actions">
        {!user && !isLoading && (
          <div className="auth-links">
            <Link to="/login">Login</Link>
            <Link to="/register" className="primary">
              Register
            </Link>
          </div>
        )}
        {user && (
          <details className="user-menu">
            <summary>{user.username}</summary>
            <div className="user-menu__items">
              <Link to="/dashboard">Dashboard</Link>
              <Link to="/settings">Settings</Link>
              {user.role === 'admin' && <Link to="/admin/users">User Management</Link>}
              <button type="button" onClick={logout}>
                Logout
              </button>
            </div>
          </details>
        )}
      </div>
    </header>
  );
}

export default Header;
