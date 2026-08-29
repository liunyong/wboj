import { useEffect, useRef } from 'react';

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';
const SCRIPT_ID = 'cloudflare-turnstile-script';
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let turnstileLoadPromise = null;

const loadTurnstileOnce = () =>
  new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve(window.turnstile);
      return;
    }

    let script = document.getElementById(SCRIPT_ID);
    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    script.addEventListener('load', () => resolve(window.turnstile), { once: true });
    script.addEventListener('error', () => reject(new Error('Unable to load security check')), {
      once: true
    });
  });

const loadTurnstileWithRetry = async () => {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await loadTurnstileOnce();
    } catch (error) {
      lastError = error;
      document.getElementById(SCRIPT_ID)?.remove();
      if (attempt === 0) {
        await new Promise((resolve) => window.setTimeout(resolve, 750));
      }
    }
  }
  throw lastError;
};

export const preloadTurnstile = () => {
  if (!SITE_KEY || typeof window === 'undefined') return Promise.resolve(null);
  if (!turnstileLoadPromise) {
    turnstileLoadPromise = loadTurnstileWithRetry().catch((error) => {
      turnstileLoadPromise = null;
      throw error;
    });
  }
  return turnstileLoadPromise;
};

function TurnstileWidget({ action, onVerify, onError, resetSignal = 0 }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const errorTimerRef = useRef(null);
  const callbacksRef = useRef({ onVerify, onError });

  useEffect(() => {
    callbacksRef.current = { onVerify, onError };
  }, [onError, onVerify]);

  useEffect(() => {
    let active = true;

    if (!SITE_KEY) {
      callbacksRef.current.onError?.('Security check is not configured');
      return undefined;
    }

    preloadTurnstile()
      .then((turnstile) => {
        if (!active || !containerRef.current || widgetIdRef.current !== null) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          action,
          theme: 'auto',
          callback: (token) => {
            window.clearTimeout(errorTimerRef.current);
            callbacksRef.current.onError?.('');
            callbacksRef.current.onVerify?.(token);
          },
          'expired-callback': () => callbacksRef.current.onVerify?.(''),
          'error-callback': () => {
            window.clearTimeout(errorTimerRef.current);
            errorTimerRef.current = window.setTimeout(
              () => callbacksRef.current.onError?.('Security check failed. Please retry.'),
              2500
            );
          }
        });
      })
      .catch(() =>
        callbacksRef.current.onError?.(
          'Unable to load security check. Allow challenges.cloudflare.com in your browser or network, then refresh.'
        )
      );

    return () => {
      active = false;
      window.clearTimeout(errorTimerRef.current);
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [action]);

  useEffect(() => {
    if (resetSignal && widgetIdRef.current !== null && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
      callbacksRef.current.onVerify?.('');
    }
  }, [resetSignal]);

  return <div className="turnstile-widget" ref={containerRef} aria-label="Security verification" />;
}

export default TurnstileWidget;
