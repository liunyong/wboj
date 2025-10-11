# Judge0-enabled Playground

Full-stack online judge featuring a Node.js + MongoDB backend with Judge0 execution, JWT authentication with role-based access control, and a React dashboard for contestants and administrators.

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
# Set MONGO_URI, JUDGE0_URL, ACCESS/REFRESH secrets, and optional admin seed credentials
npm run seed              # creates admin account + sample problem
npm run dev               # start the API on http://localhost:4000
```

### Key Endpoints

- `POST /api/auth/register` / `POST /api/auth/login` — Issue access + refresh tokens.
- `POST /api/auth/refresh` — Rotate tokens when the access token expires.
- `GET /api/auth/me` — Session info for the currently authenticated user.
- `GET /api/problems` — List public problems (admins can request `visibility=all`).
- `POST /api/problems` — Admin-only creation with difficulty, tags, samples, visibility.
- `POST /api/submissions` — Authenticated submission `{ problemId, languageId, sourceCode }`.
- `GET /api/submissions/mine` — Personal submission history.
- `GET /api/submissions` — Global submissions list (metadata only) for any authenticated user.
- `GET /api/problems/:problemId/submissions` — Problem-scoped submissions with `scope=mine|all` pagination.
- `GET /api/submissions/:id` — Submission detail with source gated to the owner or administrators.
- `GET /api/dashboard/me/summary` + `/me/heatmap` — Yearly stats for dashboards.
- `GET /api/users` — Admin search, plus role/status management via `PATCH` endpoints.

The backend queues Judge0 runs per test case, stores per-case verdicts, updates per-problem counters, and maintains a daily submission cache (`user_stats_daily`) for dashboard heatmaps.

## Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
# set VITE_API_URL (defaults to http://localhost:4000)
npm run dev      # Vite dev server on http://localhost:5173
```

The UI wraps React Router with TanStack Query and an auth context to offer:

- Login/register flow with token persistence and automatic refresh.
- Header that swaps between “Login” and a user dropdown (Dashboard, Settings, Logout).
- Dashboard heatmap + summary cards powered by `/api/dashboard` endpoints.
- Profile + password update flows under Settings.
- Admin panel with problem CRUD/visibility toggles and user role/status management.
- Problem detail pages with submission forms, samples, and scoped submissions tabs (My vs All) that respect source-code privacy.
- Global submissions view (`/submissions`) for signed-in users with filters, pagination, and live updates; admin-only actions remain role-locked.

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

The seed clears existing problems, inserts a sample addition challenge, and provisions an admin account based on `ADMIN_USERNAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in the backend `.env`.

## Next Steps

- Harden refresh-token storage (e.g., persistent session store or Redis revocation).
- Add end-to-end tests for login → submit → dashboard refresh.
- Streamline Judge0 execution with async workers and webhooks.
