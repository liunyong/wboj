# Portfolio ratings

The Dashboard at `/dashboard` replaces Home; `/` redirects there. Guests can read
announcements and browse problems or rankings. Signed-in users see their coding
profile, ratings, history, yearly statistics, activity, progress and submissions.
Administrators manage seasons on `/leaderboard` and difficulty on problem details.

## Calculation and policy

`Overall Rating = round(0.5 × D5 + 0.3 × D10 + 0.2 × D20)`.
Each D is the corresponding descending difficulty order statistic of distinct
problems accepted at least once. Numeric difficulty is an integer from 800 to
4000; old categorical difficulty is retained independently. Missing numeric
difficulty is Unrated and excluded from the calculation.

Before a depth k is covered, use `800 × n / k`, where n is the number of rated
solves. Once n reaches k, use the actual kth difficulty. Thus one rated solve
earns 112, two earn 224, and five solves at difficulty 1000 earn 660. This
conservative fallback cannot be inflated by one unusually hard solve and cannot
decrease when an easier rated problem is added. At 20 solves the exact requested
formula applies. Ratings are rounded once at the end. No XP, WA penalties or
submission-count penalties exist.

Ties use rating descending, rated solved count descending, username ascending
(binary string order), then stable user ID ascending. Unrated solves are displayed
in total solved count but do not break rating ties. Overall ranking includes all
active, non-deleted accounts. Season ranking includes participants with at least
one first solve, including Unrated solves. Public leaderboard data is limited to
username, rank, rating and solve counts; detailed profiles still obey the existing
profile visibility setting. Live ranks may change when accounts are deactivated;
archived ranks stay fixed.

## First accepts, history and recovery

`Submission.firstAcceptedAt` is set when the judge first returns AC, using its
completion time, and survives later re-runs. `FirstSolve` has a unique user/problem
index and stores the earliest such time across submissions. Repeated ACs and WA
submissions cannot create another solve. Removing a submission does not remove
the earned first solve. Problem deletion retains a difficulty snapshot for earned
ratings and history. Permanent account deletion removes the user's rating profiles
and first solves, and anonymizes their archived result rows while preserving ranks.
The existing Judge0 pipeline is reused, including its synchronous re-submit path.

`RatingProfile` materializes overall and per-season rating, coverage and history.
All calculations are in `portfolioService.js` and `ratingService.js`; UI components
only display the API result. History replays first accepts and confirmed difficulty
revisions, recording points only when the rounded rating changes. Difficulty
changes apply when confirmed, including to already solved problems, without
retroactively inventing earlier ratings. Clearing difficulty to Unrated can reduce
the current rating. Repeated accepts never add history points.

Optimistic revisions protect profile writes against concurrent workers. Durable
`ratingPending` and `difficultyRatingPending` flags allow the existing worker to
recover interrupted updates. Rating failures do not turn an accepted verdict into
a judge error. The rating APIs also reconcile pending work.

Server startup runs the idempotent backfill before serving requests. For a manual
repair, run `npm run backfill:ratings --prefix backend` with the backend environment
configured. This reuses first-accept timestamps, retained AC entries in submission
run history, or the completion/submission timestamp of legacy AC submissions.
Original first accepts that were permanently deleted or rolled out of the old
bounded run history before this feature cannot be recovered. No sample data is
reset, no default season is invented, and existing Unrated problems remain Unrated.

## Seasons

Seasons have a name, start, exclusive end, active flag and archived results.
All boundaries are UTC: `[startDate, endDate)`. For example, September through
November is `2026-09-01T00:00:00Z` to `2026-12-01T00:00:00Z`.
The current season is active and contains the current date. Only lifetime first
accepts within that period qualify; solving an old accepted problem again never
earns season credit. Create past or future seasons through the admin form or API.
Dates cannot overlap. The active flag is chosen at creation, and season definitions
are immutable to protect historical attribution.

When a season ends, the worker (or the next rating request) saves its final result
rows and ranks. Difficulty history is evaluated only before the end boundary, even
if finalization occurs later. Pending accepts must finish recovery before sealing
the archive. Completed results and per-user histories survive subsequent difficulty
changes and account deactivation. There is no season deletion endpoint.

## AI setup

Set these backend environment variables and restart the backend:

```dotenv
DIFFICULTY_AI_PROVIDER=openai-compatible
DIFFICULTY_AI_BASE_URL=https://api.openai.com/v1
DIFFICULTY_AI_MODEL=your-json-capable-model
DIFFICULTY_AI_API_KEY=your-server-side-key
DIFFICULTY_AI_TIMEOUT_MS=45000
```

The adapter uses the documented [Chat Completions API](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)
with JSON mode, then validates the numeric range and explanation locally.
`difficultyProviders/openAiCompatible.js` contains provider-specific transport;
register another adapter in `difficultyService.js` to switch protocol/providers.
The model is configured explicitly. No paid API request is made automatically.
Evaluation sends only statement, input/output, constraints, samples, algorithms and
limits. It excludes hidden test cases, submissions and user information. Requests
have a timeout, input/output size limits and an admin-specific limit of five/minute.

The admin previews the AI rating and explanation, can change the numeric value,
and explicitly selects **Confirm and save**. Manual entry and clearing to Unrated
also work without an AI key. Concurrent problem edits are rejected with 409 so a
stale evaluation cannot overwrite changed content. Provider errors leave the problem
unchanged and expose a useful error without provider credentials or raw responses.

## API

| Method / path | Access | Purpose |
| --- | --- | --- |
| GET `/api/ratings/me` | Signed in | Overall/current ratings, ranks, history, previous results |
| GET `/api/ratings/leaderboard?scope=overall&page=1&limit=50` | Public | Overall ranking |
| GET `/api/ratings/leaderboard?scope=season&seasonId=...` | Public | Current or specified season ranking |
| GET `/api/ratings/seasons` | Public | Season metadata |
| POST `/api/ratings/seasons` | Admin / super admin | Create non-overlapping season |
| POST `/api/problems/:problemId/evaluate-difficulty` | Admin / super admin | AI preview; does not save difficulty |
| PUT `/api/problems/:problemId/difficulty-rating` | Admin / super admin | Confirm `{ difficultyRating, expectedVersion, expectedUpdatedAt }` |
| GET `/api/users/:username/dashboard` | Existing visibility rules | Existing profile plus `ratings` |

## Validation

Run `npm test --prefix backend`, `npm test --prefix frontend` and
`npm run build --prefix frontend`. Rating tests cover coverage milestones,
monotonicity, concurrent duplicates, first-AC migration, season boundaries,
archiving, ties, authorization, manual overrides, stale proposals, invalid AI output,
and timeouts. Frontend tests exercise review/confirmation, cancellation, private
admin controls, error states, chart switching, and empty profiles. AI calls are
stubbed in tests; validate the chosen live provider separately after configuring it.
