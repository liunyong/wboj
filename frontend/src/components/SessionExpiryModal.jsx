import { useEffect, useMemo, useRef } from 'react';

const hasDocument = typeof document !== 'undefined';

function formatRemaining(msRemaining) {
  const totalSeconds = Math.max(0, Math.floor((msRemaining ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function SessionExpiryModal({ open, msRemaining, onExtend, onLogout }) {
  const extendButtonRef = useRef(null);
  const logoutButtonRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const originalOverflowRef = useRef('');

  const countdownText = useMemo(() => formatRemaining(msRemaining), [msRemaining]);

  useEffect(() => {
    if (!open || !hasDocument) {
      return undefined;
    }

    const focusable = [extendButtonRef.current, logoutButtonRef.current].filter(Boolean);
    previouslyFocusedRef.current = document.activeElement;
    originalOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    if (focusable.length > 0 && focusable[0]) {
      focusable[0].focus();
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      event.preventDefault();
      const activeElement = document.activeElement;
      const currentIndex = focusable.indexOf(activeElement);
      if (event.shiftKey) {
        const previousIndex = currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1;
        focusable[previousIndex]?.focus();
      } else {
        const nextIndex = currentIndex === focusable.length - 1 ? 0 : currentIndex + 1;
        focusable[nextIndex]?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflowRef.current;
      if (
        previouslyFocusedRef.current &&
        typeof previouslyFocusedRef.current.focus === 'function'
      ) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="session-expiry-backdrop" role="presentation">
      <div
        className="session-expiry-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-expiry-title"
        aria-describedby="session-expiry-description"
      >
        <h2 id="session-expiry-title" className="session-expiry-title">
          Session expiring soon
        </h2>
        <p id="session-expiry-description" className="session-expiry-description">
          To stay signed in, select <strong>Extend</strong> before the timer reaches 00:00.
        </p>
        <div className="session-expiry-countdown" aria-live="polite">
          {countdownText}
        </div>
        <div className="session-expiry-actions">
          <button
            ref={extendButtonRef}
            type="button"
            className="session-expiry-extend"
            onClick={onExtend}
          >
            Extend
          </button>
          <button
            ref={logoutButtonRef}
            type="button"
            className="session-expiry-logout"
            onClick={onLogout}
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

export default SessionExpiryModal;
