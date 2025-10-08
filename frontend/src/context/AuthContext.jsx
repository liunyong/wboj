import { createContext, useContext, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const STORAGE_KEY = 'oj.tokens';
const API_URL = import.meta.env.VITE_API_URL || '';

const loadTokens = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { accessToken: null, refreshToken: null };
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  };

  const clearTokens = () => {
    setTokens({ accessToken: null, refreshToken: null });
    localStorage.removeItem(STORAGE_KEY);
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

  const login = async ({ usernameOrEmail, password }) => {
    const data = await authFetch(
      '/api/auth/login',
      {
        method: 'POST',
        body: { usernameOrEmail, password }
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

    saveTokens(data.tokens);
    queryClient.setQueryData(['me'], data.user);
    return data.user;
  };

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
      logout,
      authFetch,
      refreshTokens,
      setTokens: saveTokens
    }),
    [authFetch, isFetchingMe, login, logout, me, register, tokens]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
