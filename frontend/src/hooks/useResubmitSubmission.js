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
        method: 'PATCH'
      });
      return {
        submission: response?.submission ?? null,
        originalSubmissionId: submissionId
      };
    },
    onSuccess: (data, variables) => {
      const submission = data?.submission;
      if (submission?._id) {
        queryClient.setQueryData(['submission', submission._id], submission);
      }
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
      queryClient.invalidateQueries({
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'problemSubmissions'
      });
      if (onSuccess) {
        onSuccess(data, variables);
      }
    },
    onError
  });
}
