import { useEffect, useRef, useState, useMemo } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import logo from '../assets/logo.svg';

function Header() {
  const location = useLocation();
  const { user, logout, isLoading } = useAuth();
  const [theme, setTheme] = useState('light');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const displayName = useMemo(
    () => user?.profile?.displayName?.trim() || user?.username || '',
    [user?.profile?.displayName, user?.username]
  );

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

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('color-theme', nextTheme);
    localStorage.setItem('color-theme', nextTheme);
    setTheme(nextTheme);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('color-theme') || 'light';
    document.documentElement.setAttribute('color-theme', savedTheme);
    setTheme(savedTheme);
  }, []);

  useEffect(() => {
    setAvatarFailed(false);
  }, [user?.profile?.avatarUrl]);

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <Link to="/"> <img src={logo} alt="WB Online Judge" className="app-logo" /> </Link>
        <Link to="/">WB Online Judge</Link>
      </div>
      <nav className="app-header__nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          Dashboard
        </NavLink>
        <NavLink to="/problems" className={({ isActive }) => (isActive ? 'active' : '')}>
          Problems
        </NavLink>
        <NavLink to="/submissions" className={({ isActive }) => (isActive ? 'active' : '')}>
          Submissions
        </NavLink>
        <NavLink to="/ranking" className={({ isActive }) => (isActive ? 'active' : '')}>
          Ranking
        </NavLink>
        {/* Dashboard is integrated into the home route — no separate Dashboard tab */}
        {isAdminLike && (
          <NavLink to="/admin/create" className={({ isActive }) => (isActive ? 'active' : '')}>
            Create Problem
          </NavLink>
        )}
        {/* Manage Uploads removed from header per layout preferences */}
      </nav>
      <div className="app-header__actions">
        <button
          type="button"
          className="dark-light-toggle"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          onClick={toggleTheme}
        >
          <div className="icon30 sun" aria-hidden="true">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="24px"
              viewBox="0 -960 960 960"
              width="24px"
              fill="#222222"
            >
              <path d="M480-280q-83 0-141.5-58.5T280-480q0-83 58.5-141.5T480-680q83 0 141.5 58.5T680-480q0 83-58.5 141.5T480-280ZM200-440H40v-80h160v80Zm720 0H760v-80h160v80ZM440-760v-160h80v160h-80Zm0 720v-160h80v160h-80ZM256-650l-101-97 57-59 96 100-52 56Zm492 496-97-101 53-55 101 97-57 59Zm-98-550 97-101 59 57-100 96-56-52ZM154-212l101-97 55 53-97 101-59-57Z" />
            </svg>
          </div>
          <div className="icon30 moon" aria-hidden="true">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="24px"
              viewBox="0 -960 960 960"
              width="24px"
              fill="#FFFFFF"
            >
              <path d="M480-120q-150 0-255-105T120-480q0-150 105-255t255-105q14 0 27.5 1t26.5 3q-41 29-65.5 75.5T444-660q0 90 63 153t153 63q55 0 101-24.5t75-65.5q2 13 3 26.5t1 27.5q0 150-105 255T480-120Z" />
            </svg>
          </div>
        </button>
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
              {user.profile?.avatarUrl && !avatarFailed ? (
                <img
                  className="header-avatar"
                  src={user.profile.avatarUrl}
                  alt=""
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <span className="header-avatar header-avatar--fallback" aria-hidden="true">
                  {(displayName || '?').trim().charAt(0).toUpperCase()}
                </span>
              )}
              {displayName}
              <span aria-hidden="true" className="user-popover__caret">
                ▾
              </span>
            </button>
            {isMenuOpen && (
              <div className="user-popover__menu" role="menu" ref={menuRef}>
                {/* Dashboard view is on the home route; omit duplicate link */}
                {/* Submissions removed from profile menu */}
                <Link to="/settings" role="menuitem" onClick={closeMenu}>
                  Settings
                </Link>
                {isAdminLike && (
                  <Link to="/admin/users" role="menuitem" onClick={closeMenu}>
                    User Management
                  </Link>
                )}
                {/* Image Uploads removed from profile menu */}
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
