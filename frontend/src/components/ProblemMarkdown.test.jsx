import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';

import ProblemEditor from './ProblemEditor.jsx';
import ProblemDetailPage from '../pages/ProblemDetailPage.jsx';

const source = [
  'The `Rectangle` class stores `length` and `width` as `double` values.',
  '',
  '- Define `private` instance variables for `length` and `width`.',
  '',
  '```java',
  'class Rectangle {',
  '  private double length;',
  '}',
  '```',
  '',
  '**Area** is $l \\times w$.',
  '',
  '$$',
  'l^2 + w^2',
  '$$',
  '',
  '| Field | Type |',
  '| --- | --- |',
  '| length | double |',
  '',
  '[Reference](https://example.com)',
  '',
  '<img src="/api/uploads/problems/example.png" alt="Diagram" onerror="alert(1)">',
  '<script>alert(1)</script>',
  '[Unsafe](javascript:alert(1))'
].join('\n');

const problem = {
  _id: '507f1f77bcf86cd799439011',
  problemId: 345,
  title: 'Rectangle',
  statementMd: source,
  isPublic: true,
  judge0LanguageIds: [62],
  testCases: []
};

const authFetch = vi.fn(async (path) => {
  if (path === '/api/problems/345') return problem;
  if (path === '/api/languages') return [{ id: 62, name: 'Java' }];
  return { items: [] };
});

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ authFetch, user: null })
}));

vi.mock('./ProblemSubmissionsPanel.jsx', () => ({ default: () => null }));

const clients = [];

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
});

function renderWithProviders(children) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/problems/345']}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function expectStatement(markdown) {
  expect(markdown).not.toBeNull();
  const paragraph = markdown.querySelector('p');
  expect(paragraph).toHaveTextContent('The Rectangle class stores length and width as double values.');
  expect(Array.from(paragraph.querySelectorAll(':scope > code'), (code) => code.textContent))
    .toEqual(['Rectangle', 'length', 'width', 'double']);
  expect(markdown.querySelector('li')).toHaveTextContent('Define private instance variables for length and width.');
  expect(markdown.querySelectorAll('li > code')).toHaveLength(3);
  expect(markdown.querySelector('p pre, li pre, pre pre')).toBeNull();
  expect(markdown.querySelectorAll('pre')).toHaveLength(1);
  expect(markdown.querySelector('pre > code.code-block.language-java')).toHaveTextContent('private double length;');
  expect(markdown.querySelector('p .code-block, li .code-block')).toBeNull();
  expect(markdown.querySelector('strong')).toHaveTextContent('Area');
  expect(markdown.querySelector('table td')).toHaveTextContent('length');
  expect(markdown.querySelector('.katex')).not.toBeNull();
  expect(markdown.querySelector('.katex-display')).not.toBeNull();
  expect(markdown.querySelector('a')).toHaveAttribute('href', 'https://example.com');
  expect(markdown.querySelector('img')).toHaveAttribute('src', '/api/uploads/problems/example.png');
  expect(markdown.querySelector('script, [onerror], [href^="javascript:"]')).toBeNull();
}

it('keeps inline code in sentences in the live editor preview', () => {
  const { container } = renderWithProviders(<ProblemEditor />);
  fireEvent.change(screen.getByLabelText('Statement'), { target: { value: source } });
  expectStatement(container.querySelector('.markdown-editor__preview .markdown-body'));
});

it('keeps inline code in sentences on the published problem page', async () => {
  const { container } = renderWithProviders(
    <Routes>
      <Route path="/problems/:problemId" element={<ProblemDetailPage />} />
    </Routes>
  );
  await screen.findByRole('heading', { name: /Rectangle/ });
  expectStatement(container.querySelector('.problem-text.markdown-body'));
});
