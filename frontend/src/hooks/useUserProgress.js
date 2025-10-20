import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext.jsx';

export const userProgressQueryKey = ['user', 'progress'];

export function useUserProgress({ enabled = true } = {}) {
  const { authFetch, user } = useAuth();

  const query = useQuery({
    queryKey: userProgressQueryKey,
    queryFn: async () => {
      const response = await authFetch('/api/dashboard/me/progress');
      return {
        solved: Array.isArray(response?.solved) ? response.solved : [],
        attempted: Array.isArray(response?.attempted) ? response.attempted : []
      };
    },
    enabled: Boolean(user?.id) && enabled,
    refetchOnWindowFocus: true,
    staleTime: 30_000
  });

  return {
    ...query,
    solved: query.data?.solved ?? [],
    attempted: query.data?.attempted ?? [],
    queryKey: userProgressQueryKey
  };
}
