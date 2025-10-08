import { useEffect, useState } from 'react';

function SampleModal({ open, initialValue, onCancel, onSave }) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [explanation, setExplanation] = useState('');

  useEffect(() => {
    if (open) {
      setInput(initialValue?.input ?? '');
      setOutput(initialValue?.output ?? '');
      setExplanation(initialValue?.explanation ?? '');
    }
  }, [initialValue, open]);

  if (!open) {
    return null;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({
      input,
      output,
      explanation: explanation.trim() ? explanation : undefined
    });
  };

  return (
    <div className="confirm-modal-backdrop" role="presentation">
      <div className="confirm-modal test-case-modal" role="dialog" aria-modal="true">
        <h3>{initialValue ? 'Edit Sample' : 'Add Sample'}</h3>
        <form className="test-case-modal__form" onSubmit={handleSubmit}>
          <label>
            Input
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={4}
              required
            />
          </label>
          <label>
            Output
            <textarea
              value={output}
              onChange={(event) => setOutput(event.target.value)}
              rows={4}
              required
            />
          </label>
          <label>
            Explanation (optional)
            <textarea
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              rows={3}
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

export default SampleModal;
