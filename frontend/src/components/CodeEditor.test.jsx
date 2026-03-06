import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import CodeEditor from './CodeEditor.jsx';

describe('CodeEditor', () => {
  it('inserts two spaces when Tab is pressed', () => {
    const onChange = vi.fn();

    render(
      <CodeEditor
        id="editor-tab"
        value={'abc'}
        onChange={onChange}
        languageName="Python"
      />
    );

    const textarea = screen.getByRole('textbox');
    textarea.setSelectionRange(1, 1);
    fireEvent.keyDown(textarea, { key: 'Tab' });

    expect(onChange).toHaveBeenCalledWith('a  bc');
  });

  it('renders highlighted keyword token', () => {
    const { container } = render(
      <CodeEditor
        id="editor-highlight"
        value={'def solve():\n  return 1'}
        onChange={() => {}}
        languageName="Python (3.10)"
      />
    );

    const keyword = container.querySelector('.token-keyword');
    expect(keyword).not.toBeNull();
    expect(keyword?.textContent).toBe('def');
  });
});
