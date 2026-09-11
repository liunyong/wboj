import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext.jsx';

export function useDeleteSubmission({ onSuccess, onError } = {}) {
  const { authFetch } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (submissionId) => {
      if (!submissionId) {
        throw new Error('submissionId is required');
      }
      await authFetch(`/api/submissions/${submissionId}`, { method: 'DELETE' });
      return { submissionId };
    },
    onSuccess: (data) => {
      const submissionId = data?.submissionId;
      if (submissionId) {
        queryClient.removeQueries({ queryKey: ['submission', submissionId], exact: true });
        queryClient.setQueriesData({ queryKey: ['problemSubmissions'] }, (existing) => {
          if (!existing || !Array.isArray(existing.items)) return existing;
          const existed = existing.items.some(
            (item) => (item.id ?? item._id) === submissionId
          );
          if (!existed) return existing;
          const total = Math.max(0, (existing.total ?? existing.items.length) - 1);
          const limit = existing.limit ?? 20;
          return {
            ...existing,
            items: existing.items.filter((item) => (item.id ?? item._id) !== submissionId),
            total,
            totalPages: Math.max(1, Math.ceil(total / limit))
          };
        });
      }
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
      queryClient.invalidateQueries({
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'problemSubmissions'
      });
      queryClient.setQueryData(['submissions', 'mine', 'dashboard'], (entries) => {
        if (!Array.isArray(entries)) {
          return entries;
        }
        return entries.filter((item) => (item.id ?? item._id) !== submissionId);
      });
      if (onSuccess) {
        onSuccess(data);
      }
    },
    onError
  });
}
