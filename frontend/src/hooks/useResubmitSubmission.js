import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../context/AuthContext.jsx';

export function useResubmitSubmission({ onSuccess, onError } = {}) {
  const { authFetch } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ submissionId }) => {
      if (!submissionId) {
        throw new Error('submissionId is required');
      }
      const response = await authFetch(`/api/submissions/${submissionId}/resubmit`, {
        method: 'POST'
      });
      return {
        ...(response ?? {}),
        originalSubmissionId: submissionId
      };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
      if (onSuccess) {
        onSuccess(data, variables);
      }
    },
    onError
  });
}
