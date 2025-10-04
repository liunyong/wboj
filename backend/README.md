# Judge0 Backend

Node.js + Express + MongoDB backend that integrates with a Judge0 instance to manage coding problems and submissions.

## Environment Variables

Copy `.env.example` to `.env` (or create the file manually) and set:

- `PORT`: Port for the API server (default `4000`).
- `MONGO_URI`: Connection string for MongoDB.
- `JUDGE0_URL`: Base URL of the Judge0 API (e.g. `http://localhost:2358`).
- `JUDGE0_MAX_CONCURRENCY`: Max concurrent Judge0 submissions processed (default `2`).
- `JUDGE0_MAX_RETRIES`: Automatic retry attempts for Judge0 requests (default `2`).
- `JUDGE0_TIMEOUT_MS`: Judge0 HTTP client timeout in milliseconds (default `20000`).

## Scripts

- `npm run dev` — Start the server with Nodemon (development).
- `npm run start` — Start the server with Node.
- `npm run seed` — Seed MongoDB with sample problems.

## API Overview

- `GET /api/health` — Service health probe.
- `GET /api/problems` — List problems.
- `GET /api/problems/:idOrSlug` — Get problem by Mongo ID or slug.
- `POST /api/problems` — Create a new problem.
- `GET /api/languages` — Retrieve Judge0 language metadata (cached for 5 minutes, pass `forceRefresh=true` to bypass cache).
- `POST /api/submissions` — Submit solution for a problem (validates `problemId`, `languageId`, and `sourceCode`).
- `GET /api/submissions` — Recent submissions.
- `GET /api/submissions/:id` — Submission details.

All submissions are evaluated against stored test cases via Judge0.

## Local Development

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and update the connection details if you are not using Docker.
3. Run MongoDB (e.g. `docker compose up mongo`) and Judge0 (see docker compose stack) before starting the API.
4. Start the backend: `npm run dev`
5. (Optional) Seed sample data once the database is available: `npm run seed`

## Testing

Integration tests use an in-memory MongoDB instance. Run them with:

```bash
npm test
```

If Judge0 is not reachable during tests, mocked responses are used instead.
