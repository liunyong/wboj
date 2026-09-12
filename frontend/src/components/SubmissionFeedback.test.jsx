import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import SubmissionFeedback from './SubmissionFeedback.jsx';

const authFetch = vi.hoisted(() => vi.fn());
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ authFetch }) }));
const pending = { _id: 'new-submission', status: 'running', verdict: 'PENDING' };
const accepted = { ...pending, status: 'accepted', verdict: 'AC' };
const clients = [];

function mount(cachedSubmission = pending) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  const onResolved = vi.fn();
  const onViewResult = vi.fn();
  const view = data => <QueryClientProvider client={client}><SubmissionFeedback submissionId="new-submission" cachedSubmission={data} onResolved={onResolved} onViewResult={onViewResult} /></QueryClientProvider>;
  const result = render(view(cachedSubmission));
  return { ...result, onResolved, onViewResult, update: data => result.rerender(view(data)) };
}
beforeEach(() => { authFetch.mockReset(); authFetch.mockResolvedValue({ submission: pending }); });
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.useRealTimers(); });

it('replaces grading with the streamed result and celebrates only once', async () => {
  const view = mount();
  expect(screen.getByRole('status')).toHaveTextContent('Submitted. Grading…');
  view.update(accepted);
  expect(await screen.findByRole('complementary', { name: 'Submission accepted' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Accepted — all test cases passed.');
  expect(screen.queryByText('Submitted. Grading…')).not.toBeInTheDocument();
  await waitFor(() => expect(view.onResolved).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'View result' }));
  expect(view.onViewResult).toHaveBeenCalledWith('new-submission');
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss celebration' }));
  view.update({ ...accepted, score: 100 });
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(view.onResolved).toHaveBeenCalledTimes(1);
});

it.each([
  ['wrong_answer', 'WA', 'Wrong Answer'], ['tle', 'TLE', 'Time Limit Exceeded'],
  ['rte', 'RTE', 'Runtime Error'], ['ce', 'CE', 'Compile Error'],
  ['failed', 'PARTIAL', 'Partial Credit'], ['failed', 'IE', 'Judge Error']
])('shows the %s result without celebrating', async (status, verdict, label) => {
  mount({ ...pending, status, verdict });
  expect(screen.getByRole('status')).toHaveTextContent(label);
  expect(screen.queryByText('Submitted. Grading…')).not.toBeInTheDocument();
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(authFetch).not.toHaveBeenCalled();
});

it('polls a missed stream result, stops on completion, and removes the celebration automatically', async () => {
  vi.useFakeTimers();
  authFetch.mockResolvedValueOnce({ submission: pending }).mockResolvedValue({ submission: accepted });
  const view = mount();
  await act(async () => { await vi.advanceTimersByTimeAsync(50); });
  expect(screen.getByRole('status')).toHaveTextContent('Submitted. Grading…');
  await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
  expect(screen.getByRole('status')).toHaveTextContent('Accepted');
  expect(screen.getByRole('complementary')).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(6100); });
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Accepted');
  expect(authFetch).toHaveBeenCalledTimes(2);
  expect(view.onResolved).toHaveBeenCalledTimes(1);
});

it('explains a result fetch failure and allows retrying', async () => {
  authFetch.mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValue({ submission: accepted });
  mount();
  const retry = await screen.findByRole('button', { name: 'Retry' });
  expect(screen.getByRole('status')).toHaveTextContent('Unable to check the result');
  fireEvent.click(retry);
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Accepted'));
});
