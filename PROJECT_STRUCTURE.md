# Project Structure Overview — WBOJ (Wanbang Online Judge)

**Repository:** `liunyong/wboj`  
**Default branch:** `main`  
**Stack:** Node.js (Express) + React (Vite) + MongoDB + Docker + Judge0 API  
**Purpose:** Full-stack Online Judge platform for programming problems, submissions, grading, and user dashboards.

---

## Folder Structure

wboj/
├── backend/ # Node.js + Express server
│ ├── src/
│ │ ├── controllers/ # Problem, Submission, Auth controllers
│ │ ├── models/ # Mongoose schemas (User, Problem, Submission, etc.)
│ │ ├── routes/ # Express route definitions
│ │ ├── services/ # Business logic (Judge0, SubmissionStream, ID services)
│ │ ├── middleware/ # Auth, Role-based access control, Error handling
│ │ ├── utils/ # HTML sanitization, token utils, date/time helpers
│ │ └── config/ # DB connection, environment variables
│ ├── tests/ # Vitest unit tests (submission stream, etc.)
│ ├── .env # SMTP setting (git ignored file)
│ ├── .env.example # Example environment variables
│ ├── package.json
│ └── server.js # Express app entry point
│
├── frontend/ # React (Vite) single-page application
│ ├── src/
│ │ ├── components/ # UI components (Problem viewer, Submission modal, Heatmap)
│ │ ├── pages/ # Page-level views (Dashboard, Problems, Submissions)
│ │ ├── context/ # Auth context, Theme context
│ │ ├── hooks/ # Custom React hooks (useAuth, useSubmissionStream, etc.)
│ │ ├── utils/ # Markdown rendering, time format, etc.
│ │ └── assets/ # Images, CSS
│ ├── vite.config.js
│ ├── package.json
│ └── .env.example
│
├── docker-compose.yml # Orchestrates backend, frontend, mongo
├── Caddyfile # Reverse proxy and SSL configuration for wboj.app
├── README.md
├── LICENSE
└── .gitignore


## ⚙️ Technologies and Libraries

### Backend
- **Runtime:** Node.js (ESM)
- **Framework:** Express.js
- **Database:** MongoDB (via Mongoose ODM)
- **Auth:** JWT (Access + Refresh tokens)
- **Judge Engine:** Judge0 REST API integration
- **Testing:** Vitest
- **Utilities:** bcryptjs, jsonwebtoken, dotenv, sanitize-html
- **Architecture:** Service-layer pattern (controllers → services → models)
- **Event Handling:** Internal EventEmitter for live submission updates
- **Environment Variables:**
  - `MONGO_URI`
  - `JUDGE0_URL`
  - `ACCESS_TOKEN_SECRET`
  - `REFRESH_TOKEN_SECRET`
  - `ADMIN_EMAIL`, `ADMIN_PASSWORD`, etc.

### Frontend
- **Framework:** React 18
- **Bundler:** Vite
- **Router:** React Router v6
- **State & Data:** TanStack React Query v5
- **Markdown Rendering:** marked + DOMPurify
- **UI/UX Enhancements:**
  - Relative time (`Intl.RelativeTimeFormat`)
  - Live submission feed via WebSocket/EventStream
  - Code highlight and modal views for submissions
- **Auth Handling:** Context-based JWT persistence and refresh
- **Environment Variables:**
  - `VITE_API_URL` → backend base URL (e.g. `http://localhost:4000`)

### Infrastructure
- **Database:** MongoDB 6+ container (or remote instance)
- **Containerization:** Docker Compose (Backend, Frontend, MongoDB)
- **Reverse Proxy:** Caddy (wboj.app → frontend/backend)
- **Deployment:** Works on VPS
- **Judge Server:** External Judge0 instance accessible via API

---

## 🧩 Key Functional Modules

### Backend
| Module | Description |
|--------|--------------|
| `controllers/problemController.js` | CRUD for problems, sanitize and decode HTML entities |
| `controllers/submissionController.js` | Handle code submissions, communicate with Judge0 |
| `services/submissionStreamService.js` | EventEmitter-based stream of submission updates |
| `services/testCaseZipService.js` | Parse `.zip` uploads containing input/output test cases |
| `middleware/auth.js` | JWT verification, role check (user, admin, super_admin) |
| `models/User.js` | Mongoose schema for user accounts |
| `models/Problem.js` | Problem statement, difficulty, and statistics |
| `models/Submission.js` | Submission data linked to user and problem |
| `utils/sanitizeHtml.js` | Decode HTML entities and sanitize markdown fields |

### Frontend
| Component | Purpose |
|------------|----------|
| `ProblemSubmissionsPanel.jsx` | Live submission list for a specific problem |
| `SubmissionViewerModal.jsx` | Shows source code, verdict, and runtime info |
| `Heatmap.jsx` | Yearly activity visualization (submission streaks) |
| `useSubmissionStream.js` | Hook for listening to backend event stream |
| `time.js` | Converts server timestamps to relative/absolute local time |
| `markdown.js` | Configures `marked` + `DOMPurify` rendering pipeline |

---

## Running Locally

### Backend
```bash
cd backend
npm install
npm run seed   # optional: create admin + sample problem
npm run dev
# Runs on http://localhost:4000