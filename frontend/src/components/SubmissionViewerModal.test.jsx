import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import SubmissionViewerModal from './SubmissionViewerModal.jsx';

const highlightSample =
  'if (m <span class="token number">3</span>) {<span class="token keyword">return</span> m;}';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({
    data: {
      _id: 'submission123',
      source: highlightSample,
      canViewSource: true,
      language: 'cpp'
    },
    isLoading: false,
    isError: false
  }))
}));

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ authFetch: vi.fn() })
}));

vi.mock('../hooks/useLanguages.js', () => ({
  useLanguages: () => ({
    resolveLanguageLabel: () => 'C++ (GCC 9.3)',
    languages: [],
    languageMap: new Map()
  })
}));

describe('SubmissionViewerModal', () => {
  it('renders submission source without injecting highlighted HTML', async () => {
    const { container } = render(
      <SubmissionViewerModal submissionId="submission123" onClose={() => {}} />
    );

    await waitFor(() => {
      const codeElement = container.querySelector('.code-block');
      expect(codeElement).not.toBeNull();
      expect(codeElement.textContent).toBe(highlightSample);
      expect(codeElement.querySelector('span')).toBeNull();
    });
  });
});
