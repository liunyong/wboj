import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { useSessionKeepAlive } from '../hooks/useSessionKeepAlive.js';
import Header from './Header.jsx';
import SessionExpiryModal from './SessionExpiryModal.jsx';

function Layout() {
  const navigate = useNavigate();
  const { logout, tokens } = useAuth();
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
        navigate('/login?expired=1', { replace: true });
      });
  }, [handleHideWarning, logout, navigate]);

  const { extendSession, notifySessionExpired } = useSessionKeepAlive({
    onShowWarning: handleShowWarning,
    onHideWarning: handleHideWarning,
    onExpire: handleExpire
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
      navigate('/login?expired=1', { replace: true });
    }
  }, [handleHideWarning, logout, navigate, notifySessionExpired]);

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
