# Repository Guidelines

## Project Structure & Module Organization
- `backend/` hosts the Express API; route logic stays under `src/{controllers,routes,services,validation}` with accompanying integration specs in `tests/*.routes.test.js`.
- `frontend/` is a Vite + React SPA (`src/App.jsx`, `src/main.jsx`, `src/styles.css`) bundled for Nginx.
- Seed data and utilities live under `backend/scripts/`, and Docker orchestration is defined in `docker-compose.yml` alongside the Mongo and Judge0 dependencies.

## Build, Test, and Development Commands
- `npm run dev --prefix backend` starts the backend watcher; `npm start --prefix backend` runs the production server on `:4000`.
- `npm run dev --prefix frontend` launches the Vite dev server on `:3000`; use `npm run build --prefix frontend` followed by `npm run preview --prefix frontend` to inspect the production bundle.
- `npm run seed --prefix backend` reloads the sample A+B problem, safe to rerun when resetting data.
- `npm test --prefix backend` executes Vitest suites against the in-memory MongoDB and Judge0 stubs.

## Coding Style & Naming Conventions
- Write modern ESM with 2-space indentation and group imports by source (Node core → packages → local modules).
- Prefer `camelCase` for functions and variables, `PascalCase` for React components and Mongoose models, and kebab-case for URL segments or slugs.
- No linter is enforced; format with Prettier or verify syntax via `node --check` before committing.

## Testing Guidelines
- Keep specs under `backend/tests`, mirroring routes with `<feature>.routes.test.js` filenames.
- Cover success, validation errors, and Judge0 retry flows; highlight skipped edge cases in the PR description.
- Run `npm test --prefix backend` locally before every push to ensure the mocked Judge0 and in-memory Mongo stay green.

## Commit & Pull Request Guidelines
- Use short, imperative commit subjects (e.g., `add submission throttle`) under 72 characters, splitting unrelated backend and frontend work.
- PRs should outline behavioural changes, list executed commands (`npm test`, `npm run build --prefix frontend`), mention new env vars, and attach UI screenshots or GIFs when relevant.

## Environment & Configuration Tips
- Copy each `.env.example` and set `MONGO_URI`, `JUDGE0_URL`, and `VITE_API_URL` prior to running services or tests.
- Adjust Judge0 concurrency knobs via backend env vars (`JUDGE0_MAX_CONCURRENCY`, `JUDGE0_MAX_RETRIES`, `JUDGE0_TIMEOUT_MS`).
- Reset demo data with `npm run seed --prefix backend` before walkthroughs or QA sessions, and export `JUDGE0_URL` when running `docker compose up --build`.
