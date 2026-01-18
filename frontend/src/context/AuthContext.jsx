import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const STORAGE_KEY = 'oj.tokens';
const LOGOUT_BROADCAST_KEY = 'oj.logout';
const AUTH_EXPIRED_EVENT = 'auth:expired';
const API_URL = import.meta.env.VITE_API_URL || '';

const getTokenStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.sessionStorage;
  } catch (error) {
    return null;
  }
};

const loadTokens = () => {
  try {
    const storage = getTokenStorage();
    if (!storage) {
      return { accessToken: null, refreshToken: null };
    }
    const stored = storage.getItem(STORAGE_KEY);
    if (!stored) {
      if (typeof window === 'undefined') {
        return { accessToken: null, refreshToken: null };
      }
      const legacy = window.localStorage.getItem(STORAGE_KEY);
      if (!legacy) {
        return { accessToken: null, refreshToken: null };
      }
      const parsedLegacy = JSON.parse(legacy);
      const migrated = {
        accessToken: parsedLegacy.accessToken ?? null,
        refreshToken: parsedLegacy.refreshToken ?? null
      };
      storage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      window.localStorage.removeItem(STORAGE_KEY);
      return migrated;
    }
    const parsed = JSON.parse(stored);
    return {
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null
    };
  } catch (error) {
    console.warn('Failed to parse stored tokens', error);
    return { accessToken: null, refreshToken: null };
  }
};

const AuthContext = createContext(null);

const buildUrl = (path) => {
  if (path.startsWith('http')) {
    return path;
  }
  return `${API_URL}${path}`;
};

const createError = async (response) => {
  let payload = null;
  try {
    payload = await response.clone().json();
  } catch (error) {
    payload = null;
  }
  const error = new Error(payload?.message || 'Request failed');
  error.status = response.status;
  error.code = payload?.code;
  error.details = payload?.details;
  return error;
};

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [tokens, setTokens] = useState(loadTokens);
  const refreshPromiseRef = useRef(null);

  const saveTokens = (nextTokens) => {
    const normalized = {
      accessToken: nextTokens?.accessToken ?? null,
      refreshToken: nextTokens?.refreshToken ?? null
    };
    setTokens(normalized);
    const storage = getTokenStorage();
    if (storage) {
      storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }
  };

  const clearTokens = () => {
    setTokens({ accessToken: null, refreshToken: null });
    const storage = getTokenStorage();
    if (storage) {
      storage.removeItem(STORAGE_KEY);
    }
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LOGOUT_BROADCAST_KEY, String(Date.now()));
        window.localStorage.removeItem(LOGOUT_BROADCAST_KEY);
      } catch (error) {
        // ignore storage broadcast failures
      }
    }
    queryClient.removeQueries({ queryKey: ['me'] });
  };

  const refreshTokens = async () => {
    if (!tokens.refreshToken) {
      return null;
    }

    if (!refreshPromiseRef.current) {
      refreshPromiseRef.current = (async () => {
        try {
          const response = await fetch(buildUrl('/api/auth/refresh'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refreshToken: tokens.refreshToken })
          });

          if (!response.ok) {
            clearTokens();
            return null;
          }

          const data = await response.json();
          saveTokens(data.tokens);
          queryClient.setQueryData(['me'], data.user);
          return data.tokens.accessToken;
        } catch (error) {
          clearTokens();
          return null;
        } finally {
          refreshPromiseRef.current = null;
        }
      })();
    }

    return refreshPromiseRef.current;
  };

  const authFetch = async (path, options = {}, { skipAuth = false, retry = true } = {}) => {
    const target = buildUrl(path);
    const init = { ...options };
    const headers = new Headers(init.headers || {});
    let body = init.body;

    if (body && !(body instanceof FormData)) {
      headers.set('Content-Type', headers.get('Content-Type') || 'application/json');
      if (typeof body !== 'string') {
        body = JSON.stringify(body);
      }
    }

    if (!skipAuth && tokens.accessToken) {
      headers.set('Authorization', `Bearer ${tokens.accessToken}`);
    }

    const execute = async (currentBody) =>
      fetch(target, {
        ...init,
        headers,
        body: currentBody
      });

    let response = await execute(body);

    if (response.status === 401 && !skipAuth && tokens.refreshToken && retry) {
      const refreshedToken = await refreshTokens();
      if (refreshedToken) {
        headers.set('Authorization', `Bearer ${refreshedToken}`);
        response = await execute(body);
      }
    }

    if (response.status === 204) {
      return null;
    }

    if (!response.ok) {
      if (response.status === 401 && !skipAuth) {
        clearTokens();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
        }
      }
      throw await createError(response);
    }

    try {
      return await response.json();
    } catch (error) {
      return null;
    }
  };

  const { data: me, isLoading: isFetchingMe } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const response = await authFetch('/api/auth/me');
      return response?.user ?? null;
    },
    enabled: Boolean(tokens.accessToken),
    gcTime: 0
  });

  const login = async ({ email, password }) => {
    const data = await authFetch(
      '/api/auth/login',
      {
        method: 'POST',
        body: { email, password }
      },
      { skipAuth: true }
    );

    saveTokens(data.tokens);
    queryClient.setQueryData(['me'], data.user);
    return data.user;
  };

  const register = async ({ username, email, password, confirmPassword }) => {
    const data = await authFetch(
      '/api/auth/register',
      {
        method: 'POST',
        body: { username, email, password, confirmPassword }
      },
      { skipAuth: true }
    );

    clearTokens();
    return data;
  };

  const verifyEmail = async ({ email, token }) =>
    authFetch(
      '/api/auth/verify',
      {
        method: 'POST',
        body: { email, token }
      },
      { skipAuth: true }
    );

  const resendVerification = async ({ email }) =>
    authFetch(
      '/api/auth/verify/resend',
      {
        method: 'POST',
        body: { email }
      },
      { skipAuth: true }
    );

  const requestPasswordReset = async ({ email }) =>
    authFetch(
      '/api/auth/password/reset/request',
      {
        method: 'POST',
        body: { email }
      },
      { skipAuth: true }
    );

  const resetPassword = async ({ email, token, password, confirmPassword }) =>
    authFetch(
      '/api/auth/password/reset',
      {
        method: 'POST',
        body: { email, token, password, confirmPassword }
      },
      { skipAuth: true }
    );

  const logout = async () => {
    if (tokens.refreshToken) {
      try {
        await authFetch(
          '/api/auth/logout',
          {
            method: 'POST',
            body: { refreshToken: tokens.refreshToken }
          },
          { skipAuth: true, retry: false }
        );
      } catch (error) {
        // ignore
      }
    }

    clearTokens();
  };

  const value = useMemo(
    () => ({
      user: me ?? null,
      tokens,
      isLoading: Boolean(tokens.accessToken) && isFetchingMe,
      login,
      register,
      verifyEmail,
      resendVerification,
      requestPasswordReset,
      resetPassword,
      logout,
      authFetch,
      refreshTokens,
      setTokens: saveTokens
    }),
    [
      authFetch,
      isFetchingMe,
      login,
      logout,
      me,
      register,
      requestPasswordReset,
      resetPassword,
      resendVerification,
      tokens,
      verifyEmail
    ]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !tokens.refreshToken) {
      return undefined;
    }

    const handleBeforeUnload = () => {
      try {
        const payload = JSON.stringify({ refreshToken: tokens.refreshToken });
        const url = buildUrl('/api/auth/logout');
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon(url, blob);
        } else {
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true
          }).catch(() => {});
        }
      } catch (error) {
        // ignore unload failures
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [tokens.refreshToken]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const handleStorage = (event) => {
      if (event.key === LOGOUT_BROADCAST_KEY) {
        clearTokens();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [clearTokens]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
