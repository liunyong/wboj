import { useEffect, useMemo, useState } from 'react';

const statusLabels = {
  0: 'Skipped',
  3: 'Accepted',
  4: 'Wrong Answer',
  5: 'Time Limit',
  6: 'Compile Error',
  7: 'Runtime Error',
  8: 'Runtime Error',
  9: 'Runtime Error',
  10: 'Runtime Error',
  11: 'Runtime Error',
  12: 'Runtime Error',
  13: 'Wrong Answer',
  14: 'Wrong Answer',
  15: 'Compile Error'
};

function ValidateTestCasesModal({
  open,
  languages,
  defaultLanguageId,
  isLoading,
  error,
  onCancel,
  onSubmit,
  validationResult,
  totalPoints
}) {
  const [languageId, setLanguageId] = useState('');
  const [sourceCode, setSourceCode] = useState('');

  const resolvedLanguageId = languageId || defaultLanguageId || (languages?.[0]?.id ?? '');

  useEffect(() => {
    if (open) {
      setLanguageId(defaultLanguageId ? String(defaultLanguageId) : '');
      setSourceCode('');
    }
  }, [defaultLanguageId, open]);

  const summary = useMemo(() => {
    if (!validationResult) {
      return null;
    }
    return {
      score: validationResult.score ?? 0,
      cases: validationResult.cases ?? [],
      maxExecTimeMs: validationResult.maxExecTimeMs,
      maxMemoryKb: validationResult.maxMemoryKb
    };
  }, [validationResult]);

  if (!open) {
    return null;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!resolvedLanguageId) {
      return;
    }
    onSubmit({
      languageId: Number(resolvedLanguageId),
      sourceCode
    });
  };

  return (
    <div className="confirm-modal-backdrop" role="presentation">
      <div className="confirm-modal validate-modal" role="dialog" aria-modal="true">
        <h3>Validate Test Cases</h3>
        <form className="validate-modal__form" onSubmit={handleSubmit}>
          <label>
            Language
            <select
              value={resolvedLanguageId}
              onChange={(event) => setLanguageId(event.target.value)}
              required
            >
              {languages.map((language) => (
                <option key={language.id} value={language.id}>
                  {language.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Reference Solution
            <textarea
              rows={10}
              value={sourceCode}
              onChange={(event) => setSourceCode(event.target.value)}
              placeholder="Paste a correct solution snippet for this language"
              required
            />
          </label>
          <div className="confirm-modal__actions">
            <button type="button" className="secondary" onClick={onCancel} disabled={isLoading}>
              Close
            </button>
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Validating…' : 'Run validation'}
            </button>
          </div>
        </form>

        {error && <div className="form-message error">{error}</div>}

        {summary ? (
          <div className="validate-modal__results">
            <div className="validate-modal__summary">
              <span>
                Score: <strong>{summary.score}%</strong>
              </span>
              <span>
                Total points: <strong>{totalPoints}</strong>
              </span>
              {typeof summary.maxExecTimeMs === 'number' && (
                <span>Max time: {summary.maxExecTimeMs} ms</span>
              )}
              {typeof summary.maxMemoryKb === 'number' && (
                <span>Max memory: {summary.maxMemoryKb} KB</span>
              )}
            </div>
            <table className="validate-modal__table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Memory</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {summary.cases.map((item) => (
                  <tr key={item.i}>
                    <td>{item.i}</td>
                    <td>{statusLabels[item.s] ?? `Status ${item.s}`}</td>
                    <td>{item.t ?? '—'}</td>
                    <td>{item.m ?? '—'}</td>
                    <td>{item.p ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default ValidateTestCasesModal;
