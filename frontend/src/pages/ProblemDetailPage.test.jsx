import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProblemDetailPage from './ProblemDetailPage.jsx';

const submissionCalls = [];

const authFetchMock = vi.fn(async (path, options = {}, _meta = {}) => {
  if (path.startsWith('/api/problems/')) {
    return {
      _id: '507f1f77bcf86cd799439011',
      problemId: 345,
      title: 'Sample Problem',
      statement: 'Add two numbers.',
      judge0LanguageIds: [71],
      isPublic: true,
      testCases: [
        { input: '1 2', output: '3', points: 1 },
        { input: '5 7', output: '12', points: 1 }
      ],
      submissionCount: 0,
      acceptedSubmissionCount: 0
    };
  }

  if (path === '/api/languages') {
    return [
      { id: 71, name: 'Python (3.10)' },
      { id: 63, name: 'JavaScript (Node)' }
    ];
  }

  if (path === '/api/submissions') {
    submissionCalls.push(options.body);
    return { submissionId: 'submission-xyz' };
  }

  return null;
});

vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    authFetch: authFetchMock,
    user: { id: 'user-1', role: 'user', username: 'alice' }
  })
}));

vi.mock('../hooks/useResubmitSubmission.js', () => ({
  useResubmitSubmission: () => ({ mutate: vi.fn(), isPending: false })
}));

vi.mock('../hooks/useDeleteSubmission.js', () => ({
  useDeleteSubmission: () => ({ mutate: vi.fn(), isPending: false })
}));

vi.mock('../hooks/useLanguages.js', () => ({
  useLanguages: () => {
    const languages = [
      { id: 71, name: 'Python (3.10)' },
      { id: 63, name: 'JavaScript (Node)' }
    ];
    const languageMap = new Map([
      [71, 'Python (3.10)'],
      ['71', 'Python (3.10)'],
      [63, 'JavaScript (Node)'],
      ['63', 'JavaScript (Node)']
    ]);
    const resolveLanguageLabel = (languageId, fallback) => {
      if (languageId === 71 || languageId === '71') {
        return 'Python (3.10)';
      }
      if (languageId === 63 || languageId === '63') {
        return 'JavaScript (Node)';
      }
      return typeof fallback === 'string' ? fallback : null;
    };
    const getLanguageName = (languageId) => resolveLanguageLabel(languageId, null);
    return {
      languages,
      languageMap,
      resolveLanguageLabel,
      getLanguageName,
      isLoading: false,
      isError: false
    };
  }
}));

vi.mock('../components/ProblemSubmissionsPanel.jsx', () => ({
  default: () => null
}));

vi.mock('../components/ConfirmDialog.jsx', () => ({
  default: () => null
}));

vi.mock('../components/SubmissionViewerModal.jsx', () => ({
  default: () => null
}));

describe('ProblemDetailPage submission form', () => {
  beforeEach(() => {
    submissionCalls.length = 0;
    authFetchMock.mockClear();
  });

  it('posts the raw textarea value when submitting a solution', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    });

    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/problems/345']}>
          <Routes>
            <Route path="/problems/:problemId" element={<ProblemDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const textarea = await screen.findByLabelText('Source Code');
    const codeSample = 'if (m < 3) {\n  return m;\n}';

    fireEvent.change(textarea, { target: { value: codeSample } });

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(submissionCalls).toHaveLength(1);
    });

    const submissionCallEntry = authFetchMock.mock.calls.find(
      ([path]) => path === '/api/submissions'
    );
    expect(submissionCallEntry).toBeDefined();
    expect(submissionCallEntry[1]).toMatchObject({
      method: 'POST',
      body: { sourceCode: codeSample, languageId: 71 }
    });

    expect(submissionCalls[0].sourceCode).toBe(codeSample);
    expect(submissionCalls[0].sourceCode).not.toContain('class="token');

    queryClient.clear();
  });
});
