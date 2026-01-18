import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext.jsx';

export const mySubmissionsQueryKey = ['submissions', 'mine', 'dashboard'];

export const useMySubmissions = ({ enabled = true, staleTime = 15_000 } = {}) => {
  const { authFetch, user } = useAuth();

  return useQuery({
    queryKey: mySubmissionsQueryKey,
    queryFn: async () => {
      const response = await authFetch('/api/submissions/mine');
      return response?.items ?? [];
    },
    enabled: Boolean(user) && enabled,
    staleTime
  });
};
