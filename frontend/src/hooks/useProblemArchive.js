import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext.jsx';

export function useProblemArchive(visibility) {
  const { authFetch, user } = useAuth();
  return useQuery({
    queryKey: ['problems', visibility, user?.id ?? null, user?.role ?? null],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '100', visibility, page: '1' });
      const response = await authFetch(`/api/problems?${params}`);
      const items = Array.isArray(response?.items) ? [...response.items] : [];
      const totalPages = Number.isFinite(response?.totalPages) ? response.totalPages : 1;
      for (let page = 2; page <= totalPages; page += 1) {
        params.set('page', String(page));
        const next = await authFetch(`/api/problems?${params}`);
        if (Array.isArray(next?.items)) items.push(...next.items);
      }
      return items;
    }
  });
}
