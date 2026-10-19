# TaskFlow — Team Task Management System

Next.js 15 (App Router) frontend + NestJS 11 API + MongoDB (Mongoose).

| | URL |
|---|---|
| Live app | _add your Vercel URL_ |
| API | _add your Render URL_ `/api/health` |

> **Try it:** register an account — **the first account becomes the Admin**; everyone after is a regular User.
> Admins can promote others to Manager under *Admin → Users & roles*.

## Features

**Core:** registration/login · task CRUD (title, description, due date, priority, status) · assign to any registered user · notification on assignment · dashboard (assigned to me / created by me / overdue) · search (title + description) · filters (status, priority, due-date range, overdue) · sorting · pagination.

**Advanced (all implemented):**
RBAC (Admin / Manager / User) · real-time notifications (Socket.io) · recurring tasks (daily/weekly/monthly) · audit log · PWA with queued offline writes · analytics dashboard · customizable notifications (in-app, email, per-type mute) · Jest unit tests.

## Architecture

```
frontend (Next.js) ──/api/* rewrite──▶ backend (NestJS) ──▶ MongoDB
        └────────── Socket.io (direct, short-lived token) ──┘
```

* **Auth / sessions:** passwords hashed with bcrypt (cost 12). Session = signed JWT (7 d) in an **HttpOnly, SameSite=Lax, Secure (prod)** cookie — not readable by JS, so XSS can't steal it. Next.js proxies `/api/*` to the backend, so the cookie is first-party and no cross-site cookie tricks are needed.
* **Socket.io** can't go through the Vercel rewrite, so the browser fetches a **5-minute, socket-only JWT** (`/api/auth/socket-token`) and connects straight to the API. That token is rejected by the REST guard, and each socket only joins its own `user:<id>` room.
* **Validation:** global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`) with class-validator DTOs; `ObjectIdPipe` on every `:id`; search text is regex-escaped; Helmet; rate limiting (global 300/min, 10/min on login/register).
* **Authorization is server-side**, never UI-only:

| Action | User | Manager | Admin |
|---|---|---|---|
| See tasks | own (created or assigned) | all | all |
| Edit/delete task | creator only | any | any |
| Change status | creator or assignee | any | any |
| Team analytics, audit log | – | ✔ | ✔ |
| Change roles | – | – | ✔ |

  Tasks you can't see return **404** (not 403) so ids can't be probed.

## Setup

Requires Node 20+ and a MongoDB (local or Atlas).

```bash
# API
cd backend
cp .env.example .env        # set MONGODB_URI and a long random JWT_SECRET
npm install --legacy-peer-deps
npm run start:dev           # http://localhost:4000/api
npm test                    # unit tests

# Web (new terminal)
cd frontend
cp .env.example .env.local
npm install --legacy-peer-deps
npm run dev                 # http://localhost:3000
```

### Demo accounts and dummy data

There are no default accounts until you register or run the seeder. To populate the database configured by `MONGODB_URI`, run from `backend`:

```bash
npm run build
npm run seed
```

The seeder reads `backend/.env` (or environment variables on Render). Run `npm run seed` once in the Render service shell after deploying, or run it locally with `MONGODB_URI` pointing to the same Atlas database as the deployed API. Keep it out of the build and start commands.

| Role | Email | Default password |
|---|---|---|
| Admin | `admin@taskflow.test` | `TaskFlow123!` |
| Manager | `manager@taskflow.test` | `TaskFlow123!` |
| User | `user@taskflow.test` | `TaskFlow123!` |

Optionally set `SEED_PASSWORD` before running to use a different password for all three accounts. Use demo credentials only in a demo database: the Admin account can manage users and tasks.

It adds 12 tasks covering all priorities and statuses, overdue dates, recurring tasks, assignment notifications, and audit entries. Re-running preserves existing records, passwords, roles, task edits, and dates without duplicating seed records. If a demo email already has a different password or role, the command stops before writing data. A failure during writes can be retried to fill in missing records.

### Deploy
1. **MongoDB Atlas:** create a free cluster, allow network access, copy the connection string.
2. **API on Render:** New → Blueprint → select this repo (`render.yaml`). Set `MONGODB_URI` and `FRONTEND_ORIGINS` (your Vercel URL, no trailing slash). Railway works the same way (root dir `backend`, build `npm i --legacy-peer-deps && npm run build`, start `npm start`).
3. **Web on Vercel:** import the repo, root directory `frontend`. Env vars: `BACKEND_URL=https://<your-api>.onrender.com` and `NEXT_PUBLIC_API_URL=https://<your-api>.onrender.com`.

### Render build troubleshooting

For a manually configured Render web service, use root directory `backend`, build command `npm install --legacy-peer-deps && npm run build`, and start command `npm start`. Compilation belongs in the build command; the start command runs the compiled `dist/main` server.

The backend build script allows up to 1024 MB of Node.js old-space heap for Nest compilation. This addresses `Reached heap limit` failures around 256 MB; it does not reserve that memory or increase the Render instance's physical memory. If the build still runs out of physical memory, use a build environment with more memory.

Render supplies `PORT` automatically, and the API listens on that port on `0.0.0.0`. A port-scan message while compilation is failing is a consequence of the server not starting. Keep `MONGODB_URI` set to the database connection string and `FRONTEND_ORIGINS` set to the frontend's HTTP(S) origin.

## Design decisions & edge cases handled

* **Recurring tasks** spawn the next occurrence when a task goes `todo/in_progress → done`. The transition is detected with an atomic `findOneAndUpdate(new:false)`, so two concurrent "complete" clicks can't create duplicates. Next due date advances until it is in the future (finishing a daily task 5 days late doesn't create an already-overdue copy), and monthly recurrence clamps (Jan 31 → Feb 28). Recurring tasks require a due date.
* **Registration race:** uniqueness is enforced by a unique index (duplicate-key → 409), not just a pre-check. Login does a dummy bcrypt compare for unknown emails and returns one generic error, to avoid user enumeration/timing leaks.
* **Roles are re-read from the DB on every request**, so demotions apply immediately even with a valid JWT. Admins can't demote themselves (no lock-out).
* **Notifications** respect the recipient's preferences, never notify you about your own actions, and never break the main request if delivery fails. Email uses SMTP when configured, otherwise it logs.
* **Frontend:** debounced search, out-of-order response guard, filters reset to page 1, overdue highlighting, loading/empty/error states, keyboard-labelled controls, dark mode, responsive layout.
* **Offline (PWA):** service worker caches the shell and static assets. Private API responses are fetched from the network without shared offline caching so accounts cannot see each other's cached data. Task create/update/delete made offline are queued per account in `localStorage` and replayed after that account signs in and reconnects. Existing data already displayed remains visible while the page stays open.

## Assumptions & trade-offs

* Offline writes are **last-write-wins** replayed in order; permanently rejected ones (deleted/forbidden meanwhile) are dropped. Network failures, server errors, expired sessions, and rate limits retain the queue for retry. The old shared queue is discarded because its account ownership is unknown. No merge UI.
* Priority sort ranks in memory (small-team scale); a numeric priority field would let Mongo sort it.
* Analytics trend buckets are computed in Node over the last 14 days of tasks — fine for a small team, would move to `$group` pipelines at scale.
* No email verification / password reset (out of scope); JWTs are stateless, so logout clears the cookie but doesn't revoke an already-copied token.
* Tests are unit-level with mocked models (business rules, permissions, recurrence maths, query building, auth). There's no DB-backed integration suite yet.

## How I used AI

> ✏️ **Edit this section in your own words before submitting** — they ask for detail and will probe it in the interview.

I used Claude (Claude Code) as a pair-programmer: I gave it the assignment PDF, it proposed the architecture and generated the code, and I reviewed the decisions.
* **Where it helped:** scaffolding both apps, DTO/validation boilerplate, the Mongo filter builder, Socket.io wiring, Recharts pages, service-worker boilerplate.
* **Decisions to be able to explain:** why a Next.js `/api` proxy + HttpOnly cookie instead of localStorage tokens; why a separate socket token; why 404 instead of 403; how recurrence avoids duplicates; the permission matrix above.
* **What I checked by hand:** _list what you actually tested/changed_.
