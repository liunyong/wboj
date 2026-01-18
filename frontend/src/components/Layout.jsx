import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { useSessionKeepAlive } from '../hooks/useSessionKeepAlive.js';
import { useSessionPolicy } from '../hooks/useSessionPolicy.js';
import Header from './Header.jsx';
import SessionExpiryModal from './SessionExpiryModal.jsx';

const AUTH_EXPIRED_EVENT = 'auth:expired';

function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, tokens } = useAuth();
  const sessionPolicyQuery = useSessionPolicy({ enabled: Boolean(tokens.accessToken) });
  const [modalOpen, setModalOpen] = useState(false);
  const [msRemaining, setMsRemaining] = useState(null);
  const contentRef = useRef(null);

  useEffect(() => {
    const node = contentRef.current;
    if (!node) {
      return;
    }
    if (modalOpen) {
      node.setAttribute('inert', '');
      node.setAttribute('aria-hidden', 'true');
    } else {
      node.removeAttribute('inert');
      node.removeAttribute('aria-hidden');
    }
  }, [modalOpen]);

  const handleShowWarning = useCallback((remainingMs) => {
    setMsRemaining(remainingMs);
    setModalOpen(true);
  }, []);

  const handleHideWarning = useCallback(() => {
    setModalOpen(false);
    setMsRemaining(null);
  }, []);

  const handleExpire = useCallback(() => {
    handleHideWarning();
    logout()
      .catch(() => {})
      .finally(() => {
        const redirectState =
          location.pathname === '/login'
            ? undefined
            : {
                from: {
                  pathname: location.pathname,
                  search: location.search,
                  hash: location.hash
                }
              };
        navigate('/login?expired=1', { replace: true, state: redirectState });
      });
  }, [handleHideWarning, location.hash, location.pathname, location.search, logout, navigate]);

  const { extendSession, notifySessionExpired } = useSessionKeepAlive({
    onShowWarning: handleShowWarning,
    onHideWarning: handleHideWarning,
    onExpire: handleExpire,
    warningLeadMs: sessionPolicyQuery.data?.warningLeadMs,
    minTouchIntervalMs: sessionPolicyQuery.data?.minTouchIntervalMs
  });

  const handleExtend = useCallback(async () => {
    try {
      await extendSession();
    } catch (error) {
      // swallow - hook will trigger expire callback if needed
    }
  }, [extendSession]);

  const handleLogout = useCallback(async () => {
    handleHideWarning();
    try {
      await logout();
    } catch (error) {
      // ignore logout network errors; tokens are cleared client-side
    } finally {
      notifySessionExpired();
      const redirectState =
        location.pathname === '/login'
          ? undefined
          : {
              from: {
                pathname: location.pathname,
                search: location.search,
                hash: location.hash
              }
            };
      navigate('/login?expired=1', { replace: true, state: redirectState });
    }
  }, [
    handleHideWarning,
    location.hash,
    location.pathname,
    location.search,
    logout,
    navigate,
    notifySessionExpired
  ]);

  useEffect(() => {
    const handleAuthExpired = () => {
      handleExpire();
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, [handleExpire]);

  return (
    <div className="app-shell">
      <div ref={contentRef} className="app-shell__content">
        <Header />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
      <SessionExpiryModal
        open={modalOpen && Boolean(tokens.accessToken)}
        msRemaining={msRemaining ?? 0}
        onExtend={handleExtend}
        onLogout={handleLogout}
      />
    </div>
  );
}

export default Layout;
