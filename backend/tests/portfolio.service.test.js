import { describe, expect, it } from 'vitest';
import { buildPortfolioTimeline, calculatePortfolio } from '../src/services/portfolioService.js';

describe('Portfolio Rating policy', () => {
  it('uses exact D5/D10/D20 weights for a full portfolio and excludes unrated values', () => {
    const ratings = Array.from({ length: 20 }, (_, i) => 2800 - i * 100);
    expect(calculatePortfolio([...ratings, null, undefined, 0, '1800']).rating).toBe(0.5 * 2400 + 0.3 * 1900 + 0.2 * 900);
    expect(calculatePortfolio(ratings).ratedSolvedCount).toBe(20);
  });

  it('uses conservative progressive coverage at 0, 1, 2, 5, 10 and 20 solves', () => {
    expect(calculatePortfolio().rating).toBe(0);
    expect(calculatePortfolio([4000]).rating).toBe(112);
    expect(calculatePortfolio([4000, 4000]).rating).toBe(224);
    expect(calculatePortfolio(Array(5).fill(1000)).rating).toBe(660);
    expect(calculatePortfolio(Array(10).fill(1000)).rating).toBe(880);
    expect(calculatePortfolio(Array(20).fill(1000)).rating).toBe(1000);
  });

  it('never reduces rating when another rated problem is solved, including milestone transitions', () => {
    const ratings = [4000, 3800, 3600, 3400];
    let previous = calculatePortfolio(ratings).rating;
    for (let i = 0; i < 30; i += 1) {
      ratings.push(800);
      const current = calculatePortfolio(ratings).rating;
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  it('records evaluation at confirmation time, preserves earlier history and excludes revisions after a season ends', () => {
    const solves = [{ problem: 'a', acceptedAt: new Date('2026-09-01') }];
    const problems = new Map([['a', { difficultyRating: 1800, difficultyHistory: [
      { at: new Date(0), rating: null }, { at: new Date('2026-10-01'), rating: 1800 }
    ] }]]);
    const timeline = buildPortfolioTimeline(solves, problems, null, new Date('2026-12-01'));
    expect(timeline.history).toEqual([{ at: new Date('2026-10-01'), rating: 112, reason: 'difficulty_update' }]);
    const season = buildPortfolioTimeline(solves, problems, { startDate: new Date('2026-09-01'), endDate: new Date('2026-10-01') }, new Date('2026-12-01'));
    expect(season.rating).toBe(0);
    expect(season.solvedCount).toBe(1);
  });
});
