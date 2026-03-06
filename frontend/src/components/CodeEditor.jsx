import { useMemo, useRef } from 'react';

import { highlightCode } from '../utils/codeHighlight.js';

function insertAtSelection(value, selectionStart, selectionEnd, insertText) {
  const nextValue = value.slice(0, selectionStart) + insertText + value.slice(selectionEnd);
  const nextCursor = selectionStart + insertText.length;
  return { nextValue, nextCursor };
}

function CodeEditor({
  id,
  value,
  onChange,
  languageName = '',
  placeholder = '',
  rows = 12,
  required = false
}) {
  const textareaRef = useRef(null);
  const highlightRef = useRef(null);
  const highlighted = useMemo(
    () => highlightCode(value, languageName),
    [languageName, value]
  );
  const safeRows = Number.isFinite(Number(rows)) ? Math.max(Number(rows), 1) : 12;
  const minHeight = `${safeRows * 1.5 + 1.1}em`;

  const handleKeyDown = (event) => {
    if (event.key !== 'Tab') {
      return;
    }

    event.preventDefault();

    const target = event.currentTarget;
    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? 0;
    const { nextValue, nextCursor } = insertAtSelection(
      value ?? '',
      start,
      end,
      '  '
    );

    onChange(nextValue);

    const schedule =
      typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame
        : (callback) => setTimeout(callback, 0);
    schedule(() => {
      const node = textareaRef.current;
      if (!node) {
        return;
      }
      node.focus();
      node.setSelectionRange(nextCursor, nextCursor);
    });
  };

  return (
    <div className="code-editor" style={{ minHeight }}>
      <pre
        ref={highlightRef}
        aria-hidden="true"
        className="code-editor__highlight"
        dangerouslySetInnerHTML={{
          __html: highlighted || '&nbsp;'
        }}
      />
      <textarea
        ref={textareaRef}
        id={id}
        className={`code-editor__textarea${value ? '' : ' is-empty'}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={(event) => {
          const pre = highlightRef.current;
          if (!pre) {
            return;
          }
          pre.scrollTop = event.currentTarget.scrollTop;
          pre.scrollLeft = event.currentTarget.scrollLeft;
        }}
        placeholder={placeholder}
        rows={safeRows}
        required={required}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
      />
    </div>
  );
}

export default CodeEditor;
