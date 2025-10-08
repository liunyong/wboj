import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';

import ProblemEditor from '../components/ProblemEditor.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function ProblemEditPage() {
  const { problemId } = useParams();
  const navigate = useNavigate();
  const { authFetch, user } = useAuth();

  const problemQuery = useQuery({
    queryKey: ['problem', problemId, 'edit'],
    queryFn: async () => {
      const response = await authFetch(`/api/problems/${problemId}?includePrivate=true`);
      return response;
    },
    enabled: Boolean(problemId)
  });

  const handleSuccess = (updatedProblem) => {
    if (!updatedProblem?.problemId) {
      return;
    }
    navigate(`/problems/${updatedProblem.problemId}`, {
      replace: true,
      state: { flash: { type: 'success', text: 'Problem updated' } }
    });
  };

  if (problemQuery.isLoading) {
    return (
      <section className="page">
        <div className="page-message">Loading problem…</div>
      </section>
    );
  }

  if (problemQuery.isError) {
    const message =
      problemQuery.error?.message || 'Failed to load problem. You may not have access.';
    return (
      <section className="page">
        <div className="page-message error">{message}</div>
      </section>
    );
  }

  const problem = problemQuery.data;
  if (!problem) {
    return (
      <section className="page">
        <div className="page-message error">Problem not found.</div>
      </section>
    );
  }

  const problemAuthorRaw = problem.author;
  const problemAuthorId =
    typeof problemAuthorRaw === 'object' && problemAuthorRaw !== null
      ? problemAuthorRaw._id ?? problemAuthorRaw.toString?.()
      : problemAuthorRaw;

  const isAdmin = user?.role === 'admin';
  const isOwner =
    problemAuthorId && user?.id ? String(problemAuthorId) === String(user.id) : false;

  if (!isAdmin && !isOwner) {
    return (
      <section className="page">
        <div className="page-message error">You do not have permission to edit this problem.</div>
      </section>
    );
  }

  return <ProblemEditor mode="edit" initialProblem={problem} onSuccess={handleSuccess} />;
}

export default ProblemEditPage;
