import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { RatingOverview } from './RatingOverview.jsx';

afterEach(cleanup);
const profile = { rating: 112, rank: 2, solvedCount: 1, ratedSolvedCount: 1, anchors: [], history: [{ at: '2026-09-01T00:00:00Z', rating: 112, reason: 'first_ac' }] };
describe('Rating profile', () => {
  it('shows key profile metrics, archived results and switches chart scope', () => {
    render(<MemoryRouter><RatingOverview data={{ overall: profile, currentSeason: { ...profile, name: 'Fall 2026' }, previousSeasons: [{ id: 'past', name: 'Summer 2026', rating: 1000, rank: 1, solvedCount: 20 }] }} /></MemoryRouter>);
    expect(screen.getByText('OVERALL RATING')).toBeInTheDocument();
    expect(screen.getByText('Total Solved Problems')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Overall Rating over time/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Current Season' }));
    expect(screen.getByRole('img', { name: /Current Season Rating over time/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Summer 2026' })).toHaveAttribute('href', '/leaderboard?season=past');
  });

  it('handles a new user without a current season or history', () => {
    render(<MemoryRouter><RatingOverview data={{ overall: { ...profile, rating: 0, history: [], solvedCount: 0 }, currentSeason: null, previousSeasons: [] }} /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Current Season' })).toBeDisabled();
    expect(screen.getByText('No active season')).toBeInTheDocument();
    expect(screen.getByText(/Your rating journey starts/)).toBeInTheDocument();
  });
});
