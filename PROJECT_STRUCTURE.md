# Project Structure Overview — WBOJ (Wanbang Online Judge)

**Repository:** `liunyong/wboj`
**Default branch:** `main`
**Stack:** Node.js (Express, ESM) + React (Vite) + MongoDB + Docker + Judge0 API
**Purpose:** Full-stack Online Judge platform covering problem authoring, submissions, grading, user activity, and admin tooling.

---

## Top-Level Layout

```
wboj/
├── backend/                  # Express API + Judge0 integration
├── frontend/                 # Vite + React SPA served by Nginx in production
├── docker-compose.yml        # Backend + Frontend + Mongo orchestration (Judge0 external)
├── Caddyfile                 # Reverse proxy / TLS for wboj.app
├── TEST_PLAN.md              # Manual QA checklist
├── CHANGELOG.md              # Release notes
├── docs/                     # Authoring/security notes
├── README.md                 # High-level setup
└── PROJECT_STRUCTURE.md      # (You are here)
```

---

## Backend (Express + MongoDB)

**Entrypoints**
- `src/server.js`: Starts the Express app (`app.js`) and connects to Mongo via `config/database.js`.
- `src/app.js`: Wires middlewares, SEO headers, session keepalive, routes, and error handlers.

**Configuration & Middleware**
- `src/config/`: Database connection, JWT/auth secrets, and nodemailer transport (`auth.js`, `database.js`, `email.js`).
- `src/middlewares/`: Auth guard, request validation, SEO/search bot logging, and rate limiter factories.

**Routes → Controllers → Services → Models**
- `src/routes/*.js`: Public and admin routers (auth, users, problems, submissions, uploads, languages, dashboard, announcements, sessions, sitemap).
- `src/controllers/`: HTTP layer for each feature; maps to services and marshals responses.
- `src/services/`: Business logic such as Judge0 submission orchestration, zip parsing for test cases, email flows, problem numbering, stats aggregation, sitemap generation, and streaming submission updates.
- `src/models/`: Mongoose schemas (User, Problem, Submission, Announcement, Counters, ProblemUpdate history, per-day stats) plus helper counters.

**Validation & Utilities**
- `src/validation/`: Joi schemas for auth, dashboard, problem creation/updates, submissions, announcements, languages, and password rules.
- `src/utils/`: Slug generation, HTML/markdown sanitization, language resolution, multer/zip adapters, rate-limit backing store, and source sanitization.

**Testing**
- `tests/*.routes.test.js`: Integration-style Vitest suites hitting routers for auth, problems, submissions (including resubmit/delete flows), uploads, dashboard, languages, sessions, announcements, and role enforcement.
- `tests/*service*.test.js`: Unit coverage for Judge0 stream service, sitemap generation, and session service.
- Shared test helpers live in `tests/utils.js` and `tests/setup.js`.

**Request/Job Lifecycles (quick reference)**
1. Request enters `app.js` → SEO/search bot logging → auth & validation → route handler.
2. Controller delegates to a service; services may call Judge0 (`services/judge0Service.js`), emit submission stream events, parse zip uploads (`testCaseZipService.js`), or send emails.
3. Mongo persistence through models; counters handled by `Counter`/`problemNumberService`.
4. Responses standardized at controller layer; stream updates broadcast via `submissionStreamService`.

---

## Frontend (Vite + React)

**Entrypoints & Routing**
- `src/main.jsx`: Bootstraps React app and providers (React Query, Auth context) and mounts `App`.
- `src/App.jsx`: Defines router layout, protected routes (`RequireAuth`, `RequireAdmin`), and SEO defaults.
- `vite.config.js`, `nginx.conf`: Build output configuration and production server rules (SPA history fallback, gzip/brotli).

**Pages & Components**
- `src/pages/`: Dashboard, home, problems list/detail/edit, admin create/uploads/users, submissions, authentication (login/register/forgot/reset/verify), settings, and user dashboard.
- `src/components/`: Layout shell (header/footer), problem statement/editor, submission viewer modal, test-case modals, session expiry dialog, heatmap, auth/admin guards, markdown/code rendering, and reusable dialogs.
- `src/styles.css`: Global Tailwind-like utility styles for layout, tables, forms, and modals.

**State, Hooks, and Utilities**
- Context: `context/AuthContext.jsx` handles JWT persistence/refresh, user info, and login/logout helpers.
- Hooks: Submission streaming, resubmit/delete helpers, language fetching, session keep-alive, SEO, and user progress.
- Utilities: Markdown pipeline (`utils/markdown.js`), time formatting (`utils/time.js`), submission formatting helpers, SEO helpers (canonical + hreflang), and language/slug utilities.
- Tests: Component/page hooks covered via Vitest in colocated `*.test.jsx` files.

**Data Flow (API usage)**
1. Auth context injects access token headers and refreshes tokens when needed.
2. React Query fetches REST endpoints under `/api` (problems, submissions, users, dashboard stats, announcements, languages).
3. Live submissions are streamed with `useSubmissionStream` backed by the backend event source.
4. Markdown and code blocks are sanitized client-side before rendering.

---

## Operations & Environment

- Environment samples: `backend/.env.example` and `frontend/.env.example` (configure Mongo URI, Judge0 URL, JWT secrets, SMTP, and `VITE_API_URL`).
- Docker: `docker-compose.yml` builds backend/frontend and attaches Mongo; Judge0 URL expected as external service.
- Proxy: `Caddyfile` fronts the SPA and API with HTTPS and path routing.
- Scripts: `backend/scripts/` contains seeding utilities for demo data (e.g., A+B problem) and helper tooling.

Use this file as the quick reference when opening the repo or running the Codex CLI. Each section names the key entrypoints so you can jump directly to the relevant controller, service, page, or hook.