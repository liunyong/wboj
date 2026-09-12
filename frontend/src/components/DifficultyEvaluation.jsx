import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext.jsx';

export default function DifficultyEvaluation({ problem }) {
  const { user, authFetch } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(null);
  const [notice, setNotice] = useState('');
  const evaluate = useMutation({
    mutationFn: () => authFetch(`/api/problems/${problem.problemId}/evaluate-difficulty`, { method: 'POST' }, { retry: false }),
    onSuccess: (data) => { setDraft({ ...data, value: String(data.difficultyRating) }); setNotice(''); }
  });
  const save = useMutation({
    mutationFn: () => authFetch(`/api/problems/${problem.problemId}/difficulty-rating`, {
      method: 'PUT', body: {
        difficultyRating: draft.value === '' ? null : Number(draft.value),
        expectedVersion: draft.expectedVersion, expectedUpdatedAt: draft.expectedUpdatedAt
      }
    }, { retry: false }),
    onSuccess: (data) => {
      setDraft(null);
      setNotice(data.ratingUpdatePending ? 'Difficulty saved. Portfolio ratings are updating.' : 'Difficulty saved. Portfolio ratings updated.');
      for (const key of ['problem', 'problems', 'ratings', 'leaderboard', 'user-dashboard', 'dashboard']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      queryClient.invalidateQueries({ queryKey: ['user', 'progress'] });
    }
  });
  if (!['admin', 'super_admin'].includes(user?.role)) return null;
  const busy = evaluate.isPending || save.isPending;
  const valid = draft && (draft.value === '' || (Number.isInteger(Number(draft.value)) && Number(draft.value) >= 800 && Number(draft.value) <= 4000));
  return <article className="difficulty-evaluation">
    <div className="section-header">
      <div><span className="eyebrow">ADMIN</span><h2>Difficulty Rating</h2></div>
      <div className="page-controls">
        <button className="secondary" disabled={busy} onClick={() => {
          save.reset(); evaluate.reset(); setNotice('');
          setDraft({ value: problem.difficultyRating == null ? '' : String(problem.difficultyRating), expectedVersion: problem.difficultyVersion ?? 0, expectedUpdatedAt: problem.updatedAt });
        }}>Set manually</button>
        <button className="primary" disabled={busy} onClick={() => { save.reset(); evaluate.reset(); evaluate.mutate(); }}>
          {evaluate.isPending ? 'Evaluating…' : 'Evaluate Difficulty'}
        </button>
      </div>
    </div>
    <p className="muted">AI suggestions are saved only after you review and confirm them. You can evaluate this problem again at any time.</p>
    {(evaluate.isError || save.isError) && <p className="form-message error" role="alert">{(evaluate.error ?? save.error)?.message}</p>}
    {notice && <p className="form-message success" role="status">{notice}</p>}
    {draft && <form className="difficulty-review" onSubmit={(event) => { event.preventDefault(); if (valid && !busy) save.mutate(); }}>
      {draft.reasoning && <div><strong>AI recommendation: {draft.difficultyRating}</strong><p>{draft.reasoning}</p></div>}
      <label>Difficulty Rating
        <input type="number" min="800" max="4000" step="1" value={draft.value} disabled={busy}
          placeholder="Unrated" onChange={(event) => setDraft({ ...draft, value: event.target.value })} />
      </label>
      <p className="muted">800–4000. Leave empty to mark Unrated. Changes affect Overall and open seasons; completed seasons keep their results.</p>
      <div className="form-actions">
        <button className="primary" type="submit" disabled={busy || !valid}>{save.isPending ? 'Saving…' : 'Confirm and save'}</button>
        <button className="secondary" type="button" disabled={busy} onClick={() => { setDraft(null); save.reset(); }}>Cancel</button>
      </div>
    </form>}
  </article>;
}
