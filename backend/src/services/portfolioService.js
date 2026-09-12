export const MIN_DIFFICULTY = 800;
export const MAX_DIFFICULTY = 4000;

export const isRated = (value) =>
  Number.isInteger(value) && value >= MIN_DIFFICULTY && value <= MAX_DIFFICULTY;

// Missing anchors earn only the minimum difficulty, scaled by coverage. This
// stays monotone when easier problems are added and cannot inflate a small portfolio.
export const calculatePortfolio = (ratings = []) => {
  const sorted = ratings.filter(isRated).sort((a, b) => b - a);
  const anchors = [5, 10, 20].map((depth) => ({
    depth,
    difficulty: sorted[depth - 1] ?? null,
    effective: sorted.length >= depth ? sorted[depth - 1] : MIN_DIFFICULTY * sorted.length / depth,
    covered: Math.min(sorted.length, depth)
  }));
  return {
    rating: Math.round(anchors.reduce((sum, anchor, i) => sum + anchor.effective * [0.5, 0.3, 0.2][i], 0)),
    ratedSolvedCount: sorted.length,
    anchors
  };
};

// Replay first accepts and confirmed difficulty changes, so a later evaluation
// changes today's rating without inventing ratings in the user's earlier history.
export const buildPortfolioTimeline = (solves, problems, season = null, now = new Date()) => {
  const start = season ? +new Date(season.startDate) : 0;
  const end = season ? Math.min(+new Date(season.endDate), +now + 1) : +now + 1;
  const eligible = solves.filter((solve) => +new Date(solve.acceptedAt) >= start && +new Date(solve.acceptedAt) < end);
  const events = [];
  for (const solve of eligible) {
    const key = String(solve.problem);
    const problem = problems.get(key) ?? solve.difficultySnapshot;
    events.push({ key, at: +new Date(solve.acceptedAt), type: 'first_ac' });
    const changes = problem?.difficultyHistory?.length
      ? problem.difficultyHistory
      : [{ at: new Date(0), rating: problem?.difficultyRating ?? null }];
    for (const change of changes) {
      if (+new Date(change.at) < end) {
        events.push({ key, at: +new Date(change.at), type: 'difficulty_update', rating: change.rating });
      }
    }
  }
  events.sort((a, b) => a.at - b.at || a.type.localeCompare(b.type) || a.key.localeCompare(b.key));
  const accepted = new Set();
  const difficulties = new Map();
  const history = [];
  let portfolio = calculatePortfolio();
  for (let index = 0; index < events.length;) {
    const at = events[index].at;
    let reason = 'difficulty_update';
    while (index < events.length && events[index].at === at) {
      const event = events[index++];
      if (event.type === 'first_ac') {
        accepted.add(event.key);
        reason = 'first_ac';
      } else {
        difficulties.set(event.key, event.rating);
      }
    }
    const next = calculatePortfolio([...accepted].map((key) => difficulties.get(key)));
    if (next.rating !== portfolio.rating) history.push({ at: new Date(at), rating: next.rating, reason });
    portfolio = next;
  }
  return { ...portfolio, solvedCount: eligible.length, history };
};
