import { useEffect, useState } from 'react';

function TestCaseModal({ open, initialValue, onCancel, onSave }) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [points, setPoints] = useState(1);

  useEffect(() => {
    if (open) {
      setInput(initialValue?.input ?? '');
      setOutput(initialValue?.output ?? '');
      setPoints(initialValue?.points ?? 1);
    }
  }, [initialValue, open]);

  if (!open) {
    return null;
  }

  const handleSubmit = (event) => {
    event.preventDefault();

    const normalizedPoints = Number.isFinite(Number(points)) ? Number(points) : 1;
    // Keep up to 2 decimals so fractional per-case points are preserved.
    const roundedPoints = Math.round(Math.min(Math.max(normalizedPoints, 0), 1000) * 100) / 100;

    onSave({
      input,
      output,
      points: roundedPoints
    });
  };

  return (
    <div className="confirm-modal-backdrop" role="presentation">
      <div className="confirm-modal test-case-modal" role="dialog" aria-modal="true">
        <h3>{initialValue ? 'Edit Test Case' : 'Add Test Case'}</h3>
        <form className="test-case-modal__form" onSubmit={handleSubmit}>
          <label>
            Input
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={6}
              required
            />
          </label>
          <label>
            Output
            <textarea
              value={output}
              onChange={(event) => setOutput(event.target.value)}
              rows={6}
              required
            />
          </label>
          <label>
            Points
            <input
              type="number"
              min="0"
              max="1000"
              step="0.01"
              value={points}
              onChange={(event) => setPoints(event.target.value)}
            />
          </label>
          <div className="confirm-modal__actions">
            <button type="button" className="secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit">{initialValue ? 'Update' : 'Add'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TestCaseModal;
