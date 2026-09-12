import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import ThemePicker from './ThemePicker.jsx';
import logo from '../assets/logo.svg';

const paths = {
  dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  problems: 'M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4z M13 7a3 3 0 0 1 3-3h5v15h-4a4 4 0 0 0-4 2',
  submissions: 'M8 3h12v18H4V7z M8 3v5H4 M8 12l2 2 4-4 M8 18h8',
  leaderboard: 'M8 3h8v6a4 4 0 0 1-8 0z M8 5H4v3a4 4 0 0 0 4 4 M16 5h4v3a4 4 0 0 1-4 4 M12 13v5 M7 21h10 M9 18h6',
  create: 'M12 5v14 M5 12h14',
  uploads: 'M4 4h16v16H4z M4 16l5-5 4 4 3-3 4 4 M15 8h.01',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M22 21v-2a4 4 0 0 0-3-4 M17 3a4 4 0 0 1 0 8 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  settings: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6',
  collapse: 'M9 3v18 M15 8l-4 4 4 4 M3 3h18v18H3z',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  close: 'M6 6l12 12 M18 6 6 18'
};
function Icon({ name }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout, isLoading } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const sidebarRef = useRef(null);
  const menuRef = useRef(null);
  const closeRef = useRef(null);
  const admin = ['admin', 'super_admin'].includes(user?.role);

  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    if (!open) return undefined;
    const workspace = document.querySelector('.app-workspace');
    workspace?.setAttribute('inert', '');
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key === 'Tab') {
        const items = [...sidebarRef.current.querySelectorAll('a, button, select')].filter((node) => node.getClientRects().length && !node.disabled);
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    const media = window.matchMedia('(min-width: 901px)');
    const resize = () => { if (media.matches) setOpen(false); };
    media.addEventListener('change', resize);
    document.addEventListener('keydown', onKey);
    return () => {
      workspace?.removeAttribute('inert');
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
      media.removeEventListener('change', resize);
      menuRef.current?.focus();
    };
  }, [open]);

  const navItem = (to, label, icon) => <NavLink key={to} to={to} className="sidebar-link" title={collapsed ? label : undefined}><Icon name={icon} /><span className="sidebar-label">{label}</span></NavLink>;
  const from = location.pathname === '/login' ? undefined : { from: { pathname: location.pathname, search: location.search, hash: location.hash } };

  return <>
    <header className="mobile-bar">
      <button ref={menuRef} type="button" className="sidebar-icon-button" aria-label="Open navigation" aria-expanded={open} aria-controls="app-sidebar" onClick={() => setOpen(true)}><Icon name="menu" /></button>
      <Link to="/dashboard" className="mobile-brand"><img src={logo} alt="" />WBOJ</Link>
      <span className="mobile-bar__caption">Online Judge</span>
    </header>
    {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
    <aside id="app-sidebar" ref={sidebarRef} className={`app-sidebar${open ? ' is-open' : ''}`} role={open ? 'dialog' : undefined} aria-modal={open ? 'true' : undefined} aria-label="Workspace navigation">
      <div className="sidebar-brand-row">
        <Link to="/dashboard" className="sidebar-brand" aria-label="WBOJ dashboard"><img src={logo} alt="" /><span className="sidebar-label"><strong>WBOJ</strong><small>WB Online Judge</small></span></Link>
        <button ref={closeRef} type="button" className="sidebar-icon-button sidebar-close" aria-label="Close navigation" onClick={() => setOpen(false)}><Icon name="close" /></button>
      </div>
      <nav className="sidebar-navigation" aria-label="Main navigation">
        <div className="sidebar-group"><p className="sidebar-group-title">Workspace</p>
          {navItem('/dashboard', 'Dashboard', 'dashboard')}
          {navItem('/problems', 'Problems', 'problems')}
          {navItem('/submissions', 'Submissions', 'submissions')}
          {navItem('/leaderboard', 'Leaderboard', 'leaderboard')}
        </div>
        {user && <div className="sidebar-group"><p className="sidebar-group-title">Account</p>{navItem('/settings', 'Settings', 'settings')}</div>}
        {admin && <div className="sidebar-group"><p className="sidebar-group-title">Administration</p>
          {navItem('/admin/create', 'Create Problem', 'create')}
          {navItem('/admin/users', 'User Management', 'users')}
          {navItem('/admin/uploads', 'Manage Uploads', 'uploads')}
        </div>}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-appearance"><span className="sidebar-label">Appearance</span><ThemePicker /></div>
        {user ? <div className="sidebar-account"><span className="sidebar-avatar" title={user.username}>{user.username?.slice(0, 1).toUpperCase()}</span><div className="sidebar-label sidebar-account__details"><strong>{user.username}</strong><button type="button" onClick={() => { setOpen(false); logout().catch(() => {}); }}>Logout</button></div></div> : !isLoading && <div className="sidebar-auth"><Link to="/login" state={from} title="Login">Login</Link><Link to="/register" className="primary-link" title="Register">Register</Link></div>}
        <button type="button" className="sidebar-collapse sidebar-link" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}><Icon name="collapse" /><span className="sidebar-label">Collapse sidebar</span></button>
      </div>
    </aside>
  </>;
}
