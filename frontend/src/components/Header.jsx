import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function Header() {
  const location = useLocation();
  const { user, logout, isLoading } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (
        menuRef.current?.contains(event.target) ||
        triggerRef.current?.contains(event.target)
      ) {
        return;
      }
      setIsMenuOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const closeMenu = () => setIsMenuOpen(false);

  const isAdminLike = ['admin', 'super_admin'].includes(user?.role);
  const loginRedirectState =
    location.pathname === '/login'
      ? undefined
      : {
          from: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash
          }
        };

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <Link to="/">WB Online Judge</Link>
      </div>
      <nav className="app-header__nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          Home
        </NavLink>
        <NavLink to="/problems" className={({ isActive }) => (isActive ? 'active' : '')}>
          Problems
        </NavLink>
        <NavLink to="/submissions" className={({ isActive }) => (isActive ? 'active' : '')}>
          Submissions
        </NavLink>
        {user ? (
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>
            Dashboard
          </NavLink>
        ) : null}
        {isAdminLike && (
          <NavLink to="/admin/create" className={({ isActive }) => (isActive ? 'active' : '')}>
            Create Problem
          </NavLink>
        )}
        {isAdminLike && (
          <NavLink to="/admin/uploads" className={({ isActive }) => (isActive ? 'active' : '')}>
            Manage Uploads
          </NavLink>
        )}
      </nav>
      <div className="app-header__actions">
        {!user && !isLoading && (
          <div className="auth-links">
            <Link to="/login" state={loginRedirectState}>
              Login
            </Link>
            <Link to="/register" className="primary">
              Register
            </Link>
          </div>
        )}
        {user && (
          <div className="user-popover">
            <button
              type="button"
              className="user-popover__trigger"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              ref={triggerRef}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen ? 'true' : 'false'}
            >
              {user.username}
              <span aria-hidden="true" className="user-popover__caret">
                ▾
              </span>
            </button>
            {isMenuOpen && (
              <div className="user-popover__menu" role="menu" ref={menuRef}>
                <Link to="/dashboard" role="menuitem" onClick={closeMenu}>
                  Dashboard
                </Link>
                <Link to="/submissions" role="menuitem" onClick={closeMenu}>
                  Submissions
                </Link>
                <Link to="/settings" role="menuitem" onClick={closeMenu}>
                  Settings
                </Link>
                {isAdminLike && (
                  <Link to="/admin/users" role="menuitem" onClick={closeMenu}>
                    User Management
                  </Link>
                )}
                {isAdminLike && (
                  <Link to="/admin/uploads" role="menuitem" onClick={closeMenu}>
                    Image Uploads
                  </Link>
                )}
                <button
                  type="button"
                  className="user-popover__logout"
                  onClick={() => {
                    closeMenu();
                    logout();
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
