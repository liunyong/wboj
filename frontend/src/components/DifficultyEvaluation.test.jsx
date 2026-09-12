import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DifficultyEvaluation from './DifficultyEvaluation.jsx';

const auth = vi.hoisted(() => ({ user: { role: 'admin' }, authFetch: vi.fn() }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth }));
const problem = { problemId: 100000, difficultyRating: null, difficultyVersion: 0, updatedAt: '2026-09-01T00:00:00.000Z' };
const renderEditor = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><DifficultyEvaluation problem={problem} /></QueryClientProvider>);
beforeEach(() => { auth.user = { role: 'admin' }; auth.authFetch.mockReset(); });
afterEach(cleanup);

describe('Difficulty review', () => {
  it('previews without saving, accepts an edited score and saves only on confirmation', async () => {
    auth.authFetch.mockResolvedValueOnce({ difficultyRating: 1600, reasoning: 'A dynamic programming solution.', expectedVersion: 0, expectedUpdatedAt: problem.updatedAt }).mockResolvedValueOnce({ difficultyRating: 1400 });
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Evaluate Difficulty' }));
    expect(await screen.findByText('AI recommendation: 1600')).toBeInTheDocument();
    expect(auth.authFetch).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1400' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and save' }));
    await waitFor(() => expect(auth.authFetch).toHaveBeenCalledTimes(2));
    expect(auth.authFetch.mock.calls[1][1]).toMatchObject({ method: 'PUT', body: { difficultyRating: 1400, expectedVersion: 0 } });
    expect(await screen.findByRole('status')).toHaveTextContent('Difficulty saved');
  });

  it('supports cancellation and manual Unrated confirmation without evaluating', async () => {
    auth.authFetch.mockResolvedValue({ difficultyRating: null });
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Set manually' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(auth.authFetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Set manually' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and save' }));
    await screen.findByRole('status');
    expect(auth.authFetch.mock.calls[0][1].body.difficultyRating).toBeNull();
  });

  it('never offers evaluation controls to regular users', () => {
    auth.user = { role: 'user' };
    renderEditor();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(auth.authFetch).not.toHaveBeenCalled();
  });

  it('keeps the proposal visible when saving fails', async () => {
    auth.authFetch.mockRejectedValue(new Error('The problem changed. Reload it before confirming the difficulty.'));
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Set manually' }));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '900' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The problem changed');
    expect(screen.getByRole('spinbutton')).toHaveValue(900);
  });
});
