import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext.jsx';

const sanitizeLanguageId = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function useLanguages(options = {}) {
  const { authFetch } = useAuth();

  const query = useQuery({
    queryKey: ['languages'],
    queryFn: async () => {
      const response = await authFetch('/api/languages', {}, { skipAuth: true });
      return Array.isArray(response) ? response : [];
    },
    staleTime: 5 * 60 * 1000,
    ...options
  });

  const languages = Array.isArray(query.data) ? query.data : [];

  const languageMap = useMemo(() => {
    const map = new Map();
    for (const entry of languages) {
      if (!entry) {
        continue;
      }
      const id =
        entry.id ?? entry.language_id ?? entry.languageId ?? sanitizeLanguageId(entry.judge0Id);
      if (id === undefined || id === null) {
        continue;
      }
      const label = entry.name ?? entry.title ?? entry.description ?? null;
      if (!label) {
        continue;
      }
      map.set(id, label);
      map.set(String(id), label);
    }
    return map;
  }, [languages]);

  const getLanguageName = useCallback(
    (input, fallback = null) => {
      if (input === undefined || input === null) {
        return fallback ?? null;
      }

      if (languageMap.has(input)) {
        return languageMap.get(input);
      }

      const numeric = sanitizeLanguageId(input);
      if (numeric !== null) {
        const numericMatch = languageMap.get(numeric);
        if (numericMatch) {
          return numericMatch;
        }
        const stringMatch = languageMap.get(String(numeric));
        if (stringMatch) {
          return stringMatch;
        }
      }

      if (typeof input === 'string') {
        const trimmed = input.trim();
        if (languageMap.has(trimmed)) {
          return languageMap.get(trimmed);
        }
      }

      return fallback ?? null;
    },
    [languageMap]
  );

  const resolveLanguageLabel = useCallback(
    (languageId, fallback) => {
      const resolved = getLanguageName(languageId);
      if (resolved) {
        return resolved;
      }

      if (typeof fallback === 'string' && fallback) {
        const normalized = fallback.trim();
        const match = normalized.match(/^language-(\d+)$/i);
        if (match) {
          const numeric = Number(match[1]);
          const parsed = getLanguageName(numeric);
          if (parsed) {
            return parsed;
          }
        }
        return normalized;
      }

      return fallback ?? null;
    },
    [getLanguageName]
  );

  return {
    ...query,
    languages,
    languageMap,
    getLanguageName,
    resolveLanguageLabel
  };
}
