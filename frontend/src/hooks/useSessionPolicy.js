import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext.jsx';

export const useSessionPolicy = ({ enabled = true } = {}) => {
  const { authFetch } = useAuth();

  return useQuery({
    queryKey: ['session', 'policy'],
    queryFn: async () => authFetch('/api/session/policy', {}, { skipAuth: true }),
    enabled
  });
};
