import { fetchJudge0Languages } from '../services/judge0Service.js';

const LOCAL_TTL_MS = 5 * 60 * 1000;
const FALLBACK_LANGUAGES = [
  { id: 54, name: 'C++ (GCC)' },
  { id: 62, name: 'Java' },
  { id: 63, name: 'JavaScript (Node.js)' },
  { id: 71, name: 'Python (3.10)' }
];

let cachedResolver = null;
let cachedAt = 0;
let refreshPromise = null;

const normalizeId = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const str = String(value).trim();
  if (!str) {
    return null;
  }
  if (/^[0-9]+$/.test(str)) {
    const parsed = Number.parseInt(str, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return str;
};

const buildResolver = (languages) => {
  const map = new Map();

  for (const entry of [...FALLBACK_LANGUAGES, ...languages]) {
    if (!entry) {
      continue;
    }
    const rawId = entry.id ?? entry.language_id ?? entry.languageId ?? entry.judge0Id;
    const key = normalizeId(rawId);
    if (key === null) {
      continue;
    }
    const label =
      entry.name ??
      entry.title ??
      entry.description ??
      (typeof entry.language === 'string' ? entry.language : null) ??
      `language-${key}`;

    map.set(key, label);
    map.set(String(key), label);
  }

  const resolveLanguageLabel = (languageId, fallback) => {
    if (languageId === undefined || languageId === null) {
      return fallback ?? null;
    }

    if (map.has(languageId)) {
      return map.get(languageId);
    }

    const normalized = normalizeId(languageId);
    if (normalized !== null) {
      if (map.has(normalized)) {
        return map.get(normalized);
      }
      const normalizedKey = String(normalized);
      if (map.has(normalizedKey)) {
        return map.get(normalizedKey);
      }
    }

    if (typeof languageId === 'string') {
      const trimmed = languageId.trim();
      const match = trimmed.match(/^language-(\d+)$/i);
      if (match) {
        const numeric = Number.parseInt(match[1], 10);
        if (Number.isFinite(numeric)) {
          if (map.has(numeric)) {
            return map.get(numeric);
          }
          if (map.has(match[1])) {
            return map.get(match[1]);
          }
        }
      }
    }

    if (fallback) {
      return fallback;
    }

    if (normalized !== null && typeof normalized === 'number') {
      return `language-${normalized}`;
    }

    return null;
  };

  return resolveLanguageLabel;
};

const refreshResolver = async () => {
  if (!refreshPromise) {
    refreshPromise = fetchJudge0Languages()
      .then((languages) => {
        cachedResolver = buildResolver(Array.isArray(languages) ? languages : []);
        cachedAt = Date.now();
        return cachedResolver;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

export const getLanguageResolver = async ({ allowStale = false } = {}) => {
  const now = Date.now();
  if (cachedResolver && now - cachedAt < LOCAL_TTL_MS) {
    return cachedResolver;
  }

  if (allowStale) {
    void refreshResolver().catch(() => {});
    return cachedResolver ?? buildResolver([]);
  }

  return refreshResolver();
};

export const clearLanguageResolverCache = () => {
  cachedResolver = null;
  cachedAt = 0;
};
