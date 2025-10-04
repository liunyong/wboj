# Repository Guidelines

## Project Structure & Module Organization
- `backend/` – Express API; logic in `src/{controllers,routes,services,validation}` and Vitest specs in `tests/*.routes.test.js`; seeding utilities live under `scripts/`.
- `frontend/` – Vite + React UI (`src/App.jsx`, `src/main.jsx`, `src/styles.css`) that targets the backend API and ships via Nginx.
- `docker-compose.yml` – Starts MongoDB, the backend (`:4000`), and the frontend (`:3000`); supply a Judge0 base URL through `JUDGE0_URL`.

## Build, Test, and Development Commands
- `npm run dev` / `npm start` (backend) – Nodemon watcher for local work, Node process for production.
- `npm run seed` (backend) – Imports the sample “A+B” problem; reruns reset the collection.
- `npm test` (backend) – Runs Vitest integration suites with in-memory MongoDB.
- `npm run dev` / `npm run build` / `npm run preview` (frontend) – Vite dev server, production bundle, and static preview.
- `docker compose up --build` – Builds and launches the full stack; export `JUDGE0_URL` before invoking.

## Coding Style & Naming Conventions
- Use ESM syntax, 2-space indentation, and group imports by origin (Node core → packages → local).
- Adopt `camelCase` for variables/functions, `PascalCase` for React components and Mongoose models, and kebab-case for slugs or URL segments.
- Keep controllers thin by pushing domain logic into `backend/src/services`; validate every request with Zod schemas from `backend/src/validation`.
- No linter is bundled—run Prettier or `node --check` before commits.

## Testing Guidelines
- Keep specs in `backend/tests` named `<feature>.routes.test.js` to mirror each route.
- Use `tests/setup.js` for in-memory Mongo and Judge0 stubs; avoid real Judge0 calls in CI.
- Cover happy paths, validation failures, and Judge0 retries; note skipped cases in the PR.

## Commit & Pull Request Guidelines
- Write concise, imperative commits (`add submission throttle`, `fix frontend polling`) capped at 72 characters.
- Group backend and frontend updates by directory or feature; open separate commits for unrelated work.
- Pull requests must describe behaviour changes, list executed commands (`npm test`, `npm run build`), and call out configuration updates or new env vars.
- Attach screenshots or GIFs for UI changes and link tracking issues when available.

## Environment & Configuration Tips
- Copy `.env.example` within each app and set `MONGO_URI`, `JUDGE0_URL`, and `VITE_API_URL` before running locally.
- Tune Judge0 concurrency and retry knobs via the backend `.env` (`JUDGE0_MAX_CONCURRENCY`, `JUDGE0_MAX_RETRIES`, `JUDGE0_TIMEOUT_MS`).
- Reset demo data with `npm run seed --prefix backend` when preparing walkthroughs or QA sessions.
