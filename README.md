# Judge0-enabled Playground

Full-stack example that uses a Node.js + MongoDB backend with Judge0 for code execution and a React frontend for interacting with problems and submissions.

## Project Structure

- `backend/` — Express API. Stores problems and submissions in MongoDB and forwards execution requests to Judge0.
- `frontend/` — React single page app powered by Vite. Lists problems, submits code, and displays per-test-case results.
- `docker-compose.yml` — Spins up MongoDB, the backend, and the frontend. Point the stack at an existing Judge0 deployment.

## Prerequisites

- Node.js 18+
- npm 9+
- MongoDB 6+ (local or remote)
- Access to a Judge0 instance (API base URL, default `http://localhost:2358`)

## Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# edit .env with your Mongo URI and Judge0 URL
npm run seed     # optional: load sample problem
npm run dev      # start the API on http://localhost:4000
```

### Key Endpoints

- `GET /api/health` — Basic health check.
- `GET /api/languages` — Proxy of Judge0 language catalogue (cached).
- `GET /api/problems` — Fetch available problems.
- `POST /api/problems` — Create a problem (expects title, slug, description, testCases).
- `POST /api/submissions` — Submit solution `{ problemId, languageId, sourceCode }`.
- `GET /api/submissions` — Recent submissions with verdicts.

Each submission triggers Judge0 for every stored test case and persists the results.

## Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
# set VITE_API_URL (defaults to http://localhost:4000)
npm run dev      # Vite dev server on http://localhost:5173
```

The UI dynamically fetches Judge0 languages, lets you pick a problem, select a supported language, edit code, submit, and review Judge0 outputs alongside submission history.

## Running with Docker Compose

```bash
export JUDGE0_URL=http://host.docker.internal:2358   # adjust if Judge0 runs elsewhere
docker compose up --build
```

Services exposed:

- Backend API — `http://localhost:4000`
- Frontend UI — `http://localhost:3000`
- MongoDB — `mongodb://localhost:27017/judge0`

> **Note:** This compose file assumes you already run a Judge0 deployment with workers. If not, follow the official Judge0 docs to provision `api` and `worker` services and update `JUDGE0_URL` accordingly.

## Seeding Sample Data

Any time you need a clean database with the starter “A+B Problem”, run:

```bash
npm run seed --prefix backend
```

The seed clears existing problems and inserts one that expects the sum of two integers.

## Next Steps

- Add authentication/authorization for problem management.
- Expand problem schema with difficulty, tags, and IO constraints.
- Queue submissions asynchronously instead of sequential Judge0 blocking calls.
