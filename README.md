# TaskFlow - Team Task Management System

TaskFlow helps teams create, assign, prioritize, and track tasks. It combines a Next.js frontend, a NestJS REST API, MongoDB persistence, and Socket.io notifications.

This guide covers setup, configuration, deployment, API behavior, testing, architectural decisions, and interview questions with answers. Answers describe the current code; proposed improvements are identified separately.

## Contents

- [Features and stack](#features-and-stack)
- [Architecture and code map](#architecture-and-code-map)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Demo accounts and seeding](#demo-accounts-and-seeding)
- [Roles and permissions](#roles-and-permissions)
- [Data model](#data-model)
- [API reference](#api-reference)
- [Important request flows](#important-request-flows)
- [Deployment and troubleshooting](#deployment-and-troubleshooting)
- [Tests and verification](#tests-and-verification)
- [Interview questions and answers](#interview-questions-and-answers)
- [Known limitations and next steps](#known-limitations-and-next-steps)
- [Interview demonstration](#interview-demonstration)
- [Discussing AI assistance](#discussing-ai-assistance)

## Features and stack

| Area | Functionality |
|---|---|
| Accounts | Registration, login, logout, current user |
| Tasks | Create, view, edit, delete, assign, and change status |
| Organization | Search title/description; filter scope, status, priority, due dates, overdue tasks |
| Lists | Sorting and pagination |
| Dashboard | Assigned open tasks, created tasks, overdue tasks, counts |
| Permissions | Admin, Manager, and User roles enforced by the API |
| Recurrence | Daily, weekly, monthly next occurrence on completion |
| Notifications | Stored in-app alerts, live Socket.io delivery, polling fallback, optional SMTP |
| Preferences | Enable in-app/email alerts; mute assignment or update notifications |
| Analytics | Status/priority counts, completion rate, overdue totals, 14-day trends |
| Audit | Activity records for Managers and Admins |
| PWA | Manifest, cached shell/static assets, account-scoped offline task writes |
| Demo | Repeatable seed command with three roles and 12 tasks |

| Layer | Technologies |
|---|---|
| Frontend | Next.js 15 App Router, React, TypeScript |
| Styling/charts | Plain responsive CSS, system dark mode, Recharts |
| Backend | NestJS 11, Express adapter, TypeScript |
| Database | MongoDB, Mongoose |
| Authentication | Passport JWT, bcryptjs, HttpOnly cookies |
| Validation | class-validator, class-transformer |
| Real-time/email | Socket.io, Nodemailer |
| Tests | Jest, ts-jest, Node.js test runner |
| Deployment configuration | Render blueprint, Next.js rewrites for Vercel |

## Architecture and code map

```text
Browser
  |
  | /api/* + HttpOnly session cookie
  v
Next.js frontend (localhost:3000 / Vercel)
  |
  | rewrite to BACKEND_URL/api/*
  v
NestJS API (localhost:4000 / Render)
  +--> MongoDB: users, tasks, notifications, audit logs
  +--> SMTP: optional email delivery

Browser -- direct Socket.io + short-lived socket token --> NestJS
```

REST requests use the frontend origin. Socket.io connects directly to the API origin configured by `NEXT_PUBLIC_API_URL`.

```text
backend/src/
  main.ts          Environment checks, middleware, CORS, validation, listening
  app.module.ts    Root module and database connection
  auth/            Registration, login, JWT strategy, cookies
  users/           Directory, roles, notification preferences
  tasks/           CRUD, visibility, filters, recurrence, dashboard
  notifications/   Persistence, socket gateway, email
  analytics/       Counts and trends
  audit/           Activity recording and listing
  common/          Roles, guards, decorators, ObjectId validation
  seed.ts          Demo database population
frontend/
  app/             Dashboard, tasks, login, register, admin, analytics, settings
  components/      App shell, task form/item, notification bell
  lib/             API wrapper, auth context, types, refresh hook
  public/          Service worker, manifest, icons
  tests/           Queue, rewrite, service-worker regressions
render.yaml        Backend deployment blueprint
```

Useful code entry points: [backend bootstrap](backend/src/main.ts), [task service](backend/src/tasks/tasks.service.ts), [authentication](backend/src/auth/auth.service.ts), [frontend API wrapper](frontend/lib/api.ts), [auth context](frontend/lib/auth.tsx).

## Local setup

### Requirements

- Node.js 20+ and npm. Last local validation used Node.js 24.18.0.
- Local MongoDB or a reachable Atlas database.
- Separate terminals for the API and frontend.

On Windows PowerShell, use `npm.cmd` instead of `npm` if execution policy blocks `npm.ps1`.

### Backend

From the repository root:

```bash
cd backend
npm ci --legacy-peer-deps
```

Copy `.env.example` to `.env` and configure the values below. In PowerShell:

```powershell
Copy-Item .env.example .env
```

On macOS/Linux:

```bash
cp .env.example .env
```

Start the API:

```bash
npm run start:dev
```

Local health endpoint: `http://localhost:4000/api/health`.

### Frontend

In another terminal, from the repository root:

```bash
cd frontend
npm ci --legacy-peer-deps
```

Copy `.env.example` to `.env.local`. For local development, use:

```dotenv
BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_API_URL=http://localhost:4000
```

```bash
npm run dev
```

Open `http://localhost:3000`. Register an account or run the seeder. On an empty database, first registration normally gets Admin; concurrent initial registration has a limitation explained below.

### Production commands

Run separately inside each application directory:

```bash
npm run build
npm start
```

Build the backend before `npm start` or `npm run seed`. Rebuild the frontend when deployed environment configuration changes.

## Environment variables

### Backend: `backend/.env`

Use placeholders in committed examples. Keep database credentials, JWT secrets, and SMTP passwords out of Git.

```dotenv
PORT=4000
MONGODB_URI=mongodb://localhost:27017/taskflow
JWT_SECRET=replace-with-a-long-random-secret
FRONTEND_ORIGINS=http://localhost:3000
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=TaskFlow <no-reply@example.com>
```

| Variable | Required / purpose |
|---|---|
| `MONGODB_URI` | Required database URI, including the intended database |
| `JWT_SECRET` | Required signing secret; startup enforces at least 16 characters |
| `PORT` | Optional; fallback 4000 locally; supplied by Render |
| `NODE_ENV` | Set to `production` in deployment for Secure session cookies |
| `FRONTEND_ORIGINS` | Comma-separated frontend HTTP(S) origins for REST CORS and Socket.io |
| `SMTP_HOST` | Optional; if absent, email is logged instead of sent |
| `SMTP_PORT` | SMTP port; example uses 587 |
| `SMTP_USER`, `SMTP_PASS` | SMTP authentication when required |
| `SMTP_FROM` | Email sender name/address |
| `SEED_PASSWORD` | Optional password for creating/checking demo accounts |

`FRONTEND_ORIGINS` contains origins such as `https://your-app.vercel.app`, not a MongoDB URI. Use no path or trailing slash. The API and seeder must use the same database if they should share data.

### Frontend: `frontend/.env.local`

| Variable | Used by | Meaning |
|---|---|---|
| `BACKEND_URL` | Next.js configuration | API origin for REST rewrite, without `/api` |
| `NEXT_PUBLIC_API_URL` | Browser | Direct Socket.io API origin, without `/api` |

Example using the API URL supplied during development:

```dotenv
BACKEND_URL=https://task-assignment-u2k5.onrender.com
NEXT_PUBLIC_API_URL=https://task-assignment-u2k5.onrender.com
```

This is configuration context, not a current service-health check. Rewrites trim whitespace/trailing slashes to avoid double-slash paths. `NEXT_PUBLIC_*` values are visible in the browser and must never contain secrets.

`.env.example` is a template. Actual local frontend values belong in `.env.local`; backend values belong in `.env`.

## Demo accounts and seeding

No fixed accounts exist until registered or seeded. From `backend`, with `MONGODB_URI` configured:

```bash
npm run build
npm run seed
```

| Role | Email | Default password |
|---|---|---|
| Admin | `admin@taskflow.test` | `TaskFlow123!` |
| Manager | `manager@taskflow.test` | `TaskFlow123!` |
| User | `user@taskflow.test` | `TaskFlow123!` |

Set `SEED_PASSWORD` before running to choose another password for all three accounts. Use the same value on reruns. These credentials are for demo use; the Admin has full role-management permissions.

The seeder connects directly to MongoDB, checks account collisions, hashes passwords with bcrypt, and inserts three users, 12 tasks, assignment notifications, and audit entries. It closes the connection on success or failure.

Stable record IDs and insert-only updates make reruns repeatable. Existing passwords, roles, task edits, and dates are preserved. A demo email with a different password or role stops the command before writes. The seed is not a database reset or password-reset tool. A failure during writes may leave partial data; retry to fill missing records.

For deployed data, run locally against the same Atlas URI or in an available service shell after deployment. Keep seeding out of ordinary build/start commands.

## Roles and permissions

| Action | User | Manager | Admin |
|---|---|---|---|
| View tasks | Created by or assigned to them | All | All |
| Create tasks | Yes | Yes | Yes |
| Assign a task they can fully edit | Any registered user | Any registered user | Any registered user |
| Edit all fields | Creator only | Any task | Any task |
| Change status | Creator or assignee | Any task | Any task |
| Delete tasks | Creator only | Any task | Any task |
| Analytics | Personal visible tasks | Whole team | Whole team |
| Audit log | No | Yes | Yes |
| Change roles | No | No | Yes |
| Own notification preferences | Yes | Yes | Yes |

Admins cannot demote themselves through the role endpoint. API authorization is independent of hidden UI buttons. Invisible tasks return 404; forbidden edits to a visible task return 403.

## Data model

| Collection | Main fields | Relationships / indexes |
|---|---|---|
| Users | name, email, passwordHash, role, notificationPrefs, timestamps | Unique email; hash excluded from normal queries |
| Tasks | title, description, dueDate, priority, status, recurrence, completedAt, timestamps | Creator/assignee reference User; recurrenceParent references Task |
| Notifications | user, type, message, task, read, createdAt | User/task references; user and time indexes |
| Audit logs | actor, action, entityType, entityId, meta, createdAt | Actor references User; actor, action, time indexes |

```text
status:     todo | in_progress | done
priority:   low | medium | high
recurrence: none | daily | weekly | monthly
```

Tasks index creator, assignee, and status/due date. A title/description text index exists, but current search uses escaped case-insensitive regular expressions rather than `$text` queries.

Dates are persisted as dates and transferred as ISO strings. Task forms convert to local date/time inputs; analytics day buckets use UTC.

## API reference

All routes start with `/api`. Browser calls go through the frontend origin. Postman/direct API clients can preserve the API's session cookie or supply a valid session JWT as a Bearer token. Socket-only tokens cannot authorize REST calls.

| Method | Route | Access / behavior |
|---|---|---|
| GET | `/api/health` | Public process response |
| POST | `/api/auth/register` | Public registration; sets cookie |
| POST | `/api/auth/login` | Public login; sets cookie |
| POST | `/api/auth/logout` | Clears cookie |
| GET | `/api/auth/me` | Authenticated current account |
| GET | `/api/auth/socket-token` | Authenticated; five-minute socket token |
| GET | `/api/users` | Authenticated directory |
| PATCH | `/api/users/me/preferences` | Own preferences |
| PATCH | `/api/users/:id/role` | Admin only |
| POST | `/api/tasks` | Create task |
| GET | `/api/tasks` | Visibility-scoped list |
| GET | `/api/tasks/dashboard` | Personal dashboard |
| GET | `/api/tasks/:id` | Visible task |
| PATCH | `/api/tasks/:id` | Permission-checked edit |
| DELETE | `/api/tasks/:id` | Creator/Manager/Admin |
| GET | `/api/notifications` | Own latest items and unread count |
| PATCH | `/api/notifications/read-all` | Mark own notifications read |
| PATCH | `/api/notifications/:id/read` | Mark owned notification read |
| GET | `/api/analytics` | Personal/team summary by role |
| GET | `/api/audit` | Manager/Admin; paginated activity |

### Request examples

Registration:

```json
{"name":"Demo Person","email":"person@example.com","password":"ExamplePass123!"}
```

Task creation:

```json
{
  "title": "Review dashboard",
  "description": "Check layout, permissions, and charts.",
  "priority": "high",
  "status": "todo",
  "dueDate": "2027-01-15T12:00:00.000Z",
  "recurrence": "none"
}
```

Add `assignee` with a real user ObjectId to assign a task. In updates, `assignee: null` unassigns and `dueDate: null` clears the deadline. A task that remains recurring must keep a due date.

### Task list query parameters

| Parameter | Values / meaning |
|---|---|
| scope | all, assigned, created; all still obeys visibility |
| search | Title/description text, max 100 characters |
| status | todo, in_progress, done |
| priority | low, medium, high |
| dueFrom, dueTo | ISO date strings; inclusive bounds |
| overdue | true or false; true selects unfinished past-due tasks |
| sort | dueDate, createdAt, priority |
| page | Integer starting at 1 |
| limit | 1-100; default 20 |

```text
GET /api/tasks?scope=assigned&status=todo&priority=high&page=1&limit=10
```

```json
{"items":[],"total":0,"page":1,"limit":10}
```

Audit supports `page` and optional exact `action`, with page size 50. Notifications return the latest 50 items; unread count covers all unread records.

## Important request flows

### Login

1. Browser posts credentials to the frontend `/api/auth/login`.
2. Next.js rewrites to NestJS.
3. API normalizes email and explicitly queries the password hash.
4. bcrypt compares the password; unknown accounts use a dummy hash comparison.
5. Success sets a seven-day JWT in an HttpOnly cookie and returns sanitized user data.
6. Browser includes the cookie in subsequent same-origin requests.
7. JWT verification reloads the user from MongoDB so REST checks use the current role.

The cookie is SameSite=Lax, Path=/, and Secure in production. HttpOnly prevents direct JavaScript access; it does not eliminate XSS or every CSRF risk.

### Assignment

Validate input and assignee, save the task, attempt an audit write, apply the recipient's preferences, then store/emit an in-app notification and optionally send email. Return populated creator/assignee information. Notification failures are caught; audit failures are logged. These writes are not a transaction.

### Recurrence

An atomic `findOneAndUpdate` returns the pre-update task. A transition from not-done to done creates the next todo occurrence linked through `recurrenceParent`. Its deadline advances beyond now; monthly arithmetic clamps to month end. Clearing assignment during completion leaves the child unassigned. There is no background scheduler, and missed periods do not each create a task.

### Offline writes

Task mutations are queued in local storage on offline/network failure, under the current user's key. Replay runs in order after login/reconnection. It preserves changes added while a sync runs.

Network errors, server errors, 401, 408, and 429 retain entries. Other client errors are treated as permanent and dropped. Storage failures are shown. The old shared queue is discarded because its owner cannot be established.

The worker caches shell/static assets, not private API responses. An open page retains displayed data. A fresh offline load cannot retrieve tasks or validate its session from the API.

## Deployment and troubleshooting

### Render API

Use `render.yaml` or configure:

| Setting | Value |
|---|---|
| Root directory | backend |
| Build | `npm install --legacy-peer-deps && npm run build` |
| Start | `npm start` |
| Health path | `/api/health` |
| Variables | NODE_ENV=production, MONGODB_URI, JWT_SECRET, FRONTEND_ORIGINS |

The API listens on `0.0.0.0` and supplied `PORT`. Compilation belongs in the build phase. Configure Atlas access for the deployed service. The blueprint can generate a JWT secret; a manual service needs its own strong secret.

### Vercel frontend

Import with root `frontend`, use the Next.js build, and set both frontend API-origin variables. Redeploy when those values change. Set backend `FRONTEND_ORIGINS` to the real frontend origin for direct sockets.

After deployment, check health, login, task CRUD, another account's visibility, live notifications, analytics, and role restrictions. Working REST login does not prove socket configuration is correct.

### Common problems

| Symptom | Cause / action |
|---|---|
| Cannot POST //api/auth/login | Deploy normalized rewrite; use BACKEND_URL without `/api` |
| Old API origin still used | Rebuild/redeploy frontend after changing variables |
| Reached heap limit during Nest build | Provided build allows 1024 MB old-space heap |
| Process killed despite heap increase | Host physical memory may be insufficient; heap flags do not add RAM |
| No open port while build crashes | Server never started; fix compilation and use npm start |
| Missing required variable | Set MONGODB_URI and JWT_SECRET in backend environment |
| Database connection failure | Check URI, database, credentials, DNS, and Atlas network access |
| Origin rejected / no live alerts | FRONTEND_ORIGINS must match frontend HTTP(S) origin |
| Session disappears on local HTTP | Do not use production Secure-cookie mode for local HTTP |
| Demo login fails | Seed the API's actual database; check custom SEED_PASSWORD |
| Seed reports account collision | Preserve account; use actual credentials or separate demo database |
| PowerShell blocks npm.ps1 | Use npm.cmd |
| Assignee gets 403 on full edit | Assignees with User role may edit status only |
| No alert for self-assignment | Intentional; assign to another user |
| Email logged instead of sent | Configure SMTP and enable recipient's email preference |

## Tests and verification

From `backend`:

```bash
npm test -- --runInBand
npm run build
```

From `frontend`:

```bash
npm test
npm run build
```

Last recorded review: **30 backend and 6 frontend tests passed**, and both production builds passed. Local HTTP checks passed for login, registration, worker, manifest, icons, and unauthenticated protected-page redirects. This is local evidence, not verification of deployed database access or signed-in browser workflows.

| Tests | Coverage examples |
|---|---|
| Auth | Hashing, duplicate email, invalid login |
| Tasks/utilities | Visibility, permissions, notification triggers, recurrence dates, filters |
| Seed | Credentials, repeatability, collisions, connection cleanup |
| Analytics | Scoped recent queries and overdue totals |
| Gateway | Token purpose and authenticated room |
| Queue | Account isolation, retry retention, concurrent additions, storage errors |
| Config/worker | Rewrite normalization, old cache cleanup, private APIs bypass cache |

Database behavior is mostly tested with mocked models. MongoDB integration and full browser end-to-end suites are not implemented.

## Interview questions and answers

Use these to prepare, then explain the ideas in your own words. Only claim work you actually performed or reviewed.

### Project and architecture

**1. Explain TaskFlow in one minute.**

TaskFlow helps teams assign, prioritize, and track tasks. Next.js provides the UI and proxies REST calls to a NestJS API. MongoDB stores application data, JWT cookies handle sessions, and Socket.io delivers notifications. Roles protect team operations, while analytics and audit logs show progress and activity.

**2. Why Next.js and NestJS together?**

Next.js handles frontend routes, UI, and a same-origin API rewrite. NestJS owns validation, authentication, persistence, and business rules. The split allows independent deployment and clear API ownership. A smaller application could use one framework; this separation is a deliberate trade-off, not a requirement.

**3. What do modules, controllers, and services do?**

Controllers map HTTP requests to operations, services implement rules, and modules define dependencies. TasksController delegates to TasksService, which collaborates with users, audit, and notifications. Keeping rules in services makes them easier to reuse and test.

**4. What is dependency injection in this project?**

Nest supplies dependencies through constructors instead of services constructing them. TasksService receives its Mongoose model and collaborating services. Tests supply mocks through the same constructor, so business rules can run without starting the whole API.

**5. Why MongoDB rather than SQL?**

Users, tasks, preferences, and audit metadata fit document schemas, and MongoDB aggregation supports analytics. Mongoose supplies schemas and references. SQL would also fit these relationships and provide relational constraints; choosing MongoDB does not mean relational databases are unsuitable.

**6. Is every Next.js page server-rendered with its data?**

No. The main interactive pages are client components that fetch authenticated data in the browser. Next.js provides routing and build infrastructure, but that does not make each dashboard query server-side. Server components could be introduced where they provide a clear benefit.

### Authentication and security

**7. Explain the login request from browser to database.**

The browser posts to the frontend's /api/auth/login. A rewrite forwards it to NestJS. The API finds the normalized email, compares the supplied password with bcrypt, signs a JWT, sets a cookie, and returns sanitized user data. Subsequent requests verify the JWT and reload the account.

**8. Why hash passwords instead of encrypting them?**

The system needs to verify passwords, not recover them. bcrypt is salted and deliberately expensive; this code uses cost 12. Encryption introduces a key that could reveal every password if compromised. Password hashes are explicitly selected only when authentication needs them.

**9. Why an HttpOnly cookie instead of localStorage for the session?**

JavaScript cannot directly read an HttpOnly cookie, reducing direct token theft through script access. The frontend proxy keeps REST requests on one origin, and the browser attaches the cookie. HttpOnly does not eliminate XSS: malicious script can still make authenticated requests from the page.

**10. Explain Secure and SameSite=Lax.**

Secure restricts cookie transmission to HTTPS; it is enabled in production. SameSite=Lax limits inclusion in many cross-site contexts. These are defenses, not complete CSRF protection. Explicit origin/CSRF validation is a further improvement.

**11. Authentication versus authorization?**

Authentication establishes who the requester is through the JWT. Authorization decides what they may do using their current role and creator/assignee relationships. Being logged in does not let a User edit every task.

**12. Why reload the user for each REST request?**

MongoDB remains the source of truth for role and account existence. Demotions affect subsequent requests without waiting for the seven-day token to expire. The trade-off is a database lookup, so authentication is not completely database-independent.

**13. Does logout revoke a JWT?**

No. Logout clears the browser cookie, but a copied token may remain valid until expiry. There is no token revocation list or session-version mechanism. Short-lived access tokens with refresh rotation, session versioning, or server-managed sessions would improve revocation.

**14. How do you reduce account enumeration during login?**

Unknown email and wrong password return the same generic error. An unknown email still triggers a dummy bcrypt comparison to reduce a large timing difference. This reduces a signal; it does not guarantee identical timing under every workload.

**15. How do duplicate registrations behave?**

Email is normalized and protected by a unique MongoDB index. Duplicate-key errors become HTTP 409. A preliminary lookup alone would not be sufficient because concurrent requests could both pass it before inserting.

**16. Is first-user Admin creation atomic?**

No. UsersService checks the estimated user count before creating the account. Two concurrent first registrations can both see an empty database and become Admin. A production approach should use explicit Admin bootstrap or atomic initialization. Unique email enforcement does not solve this separate race.

**17. What validation protects task endpoints?**

ValidationPipe transforms inputs, whitelists DTO fields, and rejects extra fields. Decorators check types, lengths, enums, dates, IDs, and pagination bounds. Service rules verify assignees and recurring deadlines. Mongoose adds schema validation. These layers have different responsibilities.

**18. Why return 404 rather than 403 for another user's task?**

An unrelated user should not learn whether a task ID exists. Missing and invisible tasks therefore return the same status. For a task the user can see but cannot fully edit, 403 communicates insufficient permission.

**19. Does regex escaping prevent every injection issue?**

No. It makes the current search treat metacharacters as ordinary text. Whitelisted DTOs, explicit filter construction, and ObjectId validation provide other protections. Passing arbitrary client objects into database queries would still be unsafe.

**20. What security improvements would you prioritize?**

Explicit CSRF/origin controls, token revocation, email verification, password reset, shared rate-limit storage, and stronger integration tests. Password DTOs currently count characters, while bcrypt has a byte limit; multibyte input needs explicit UTF-8 byte-length validation.

### Tasks, queries, and concurrency

**21. How is task visibility enforced?**

Regular-user list queries require creator or assignee to match the authenticated user. Single reads and mutations check equivalent relationships. Managers and Admins can access all tasks. The API enforces this regardless of frontend navigation or button visibility.

**22. What can a regular assignee change?**

A User who is assigned but is not the creator can change only status. The service inspects supplied update keys and rejects other edits. Creators, Managers, and Admins can edit full task details within validation rules.

**23. How do search and pagination work?**

The API composes visibility with requested conditions. Normal lists sort, skip, limit, and count matching documents. Search uses escaped case-insensitive regex over title/description. The UI debounces filters and ignores older responses that arrive after newer ones.

**24. Why sort priority in memory?**

Alphabetic order of high/medium/low is not business priority order. The current code loads matching tasks, ranks them in memory, and slices the page. This is simple for demo data but scales poorly. A numeric indexed priority rank would support database sorting and pagination.

**25. What are populate and lean?**

Populate resolves user references into selected creator/assignee fields for display. Lean returns plain objects rather than hydrated Mongoose documents, reducing read overhead. Neither eliminates query costs or the need for suitable indexes.

**26. Which indexes are useful here?**

Unique email enforces identity uniqueness. Task creator/assignee indexes support visibility and dashboard queries; status/due date supports workflow filtering. Notification user/time and audit indexes support lists. Real index decisions should use explain plans and representative data.

**27. How does recurrence work?**

Completing a recurring task creates a new todo task linked to the previous occurrence. The next deadline advances beyond now; monthly recurrence clamps to month end. Completion is the trigger. There is no scheduler creating tasks while an earlier occurrence stays unfinished.

**28. Does atomic findOneAndUpdate guarantee exactly-once recurrence?**

It lets each completion request inspect its actual pre-update document, preventing the simple concurrent double-click case from spawning twice. Parent update and child insert are separate writes, so a crash can leave a completed parent without a child. Reopen/completion races need stronger handling. Transactions and occurrence uniqueness would improve guarantees.

**29. Why distinguish null from an omitted update field?**

Omitted means leave unchanged. For dueDate and assignee, null means clear the value using $unset. Without this distinction, a client could not express both keep the deadline and remove the deadline cleanly.

**30. Are task, audit, and notification writes transactional?**

No. Task persistence happens first; audit and notification work follows. Their failures do not fail the task action. For reliable side effects, an outbox written in the same transaction as the task plus a retrying worker would be stronger.

### Real-time updates and analytics

**31. Why use a separate socket token?**

The session cookie is HttpOnly and associated with the frontend origin, while Socket.io connects directly to the API. An authenticated REST call returns a five-minute socket-purpose JWT. The socket gateway accepts that purpose; the REST strategy rejects purpose-bearing tokens.

**32. How do you prevent users joining someone else's room?**

The gateway verifies the signed token and derives user:<id> from its subject. It checks token purpose and subject format. The client does not choose an arbitrary room or recipient. Notifications are emitted only to the recipient's derived room.

**33. How do reconnects work after five minutes?**

The frontend's Socket.io auth callback requests a fresh socket token for each connection attempt. Reusing one short-lived token indefinitely would fail after expiry. A 60-second notification poll provides fallback when sockets are unavailable.

**34. Does an established socket disconnect at JWT expiry?**

No. Verification occurs on connection. There is no timer disconnecting the socket at expiration and no continuous account check. Reconnects need fresh credentials. Active-connection revocation and account-deletion handling require additional work.

**35. How are notification preferences applied?**

The service reads the recipient's preferences before delivery. Assignment/update mute flags suppress a type, while in-app and email switches control channels independently. Task actions avoid sending notifications back to the actor for their own changes.

**36. How do personal analytics avoid leaking team data?**

User visibility and recent-date conditions stay in separate $and clauses. Both contain $or internally. Spreading them into the same object would overwrite one $or and could include other users' trend data. The regression test checks this query composition.

**37. How do you count overdue tasks correctly?**

A task must have a real deadline before now and be unfinished. Overall counts include visible unassigned tasks as well as assigned ones. Aggregations explicitly check the date type, preventing missing/null deadlines from being counted as overdue.

**38. What timezone do trends use?**

Backend trend buckets use UTC ISO dates. Task forms use local date/time inputs and send ISO timestamps. Around midnight, a local calendar day can differ from a UTC bucket. User-timezone reporting would require an explicit design change.

### Frontend and offline behavior

**39. Why use an authentication context?**

It shares user, loading state, refresh, logout, and offline queue identity across the app. Middleware redirects visitors without a cookie for UX, but cookie presence does not prove validity. Backend JWT checks remain authoritative.

**40. How do you prevent stale search responses?**

Filters are debounced for 300 ms. Each task load increments a request counter, and only the latest request may update state. This prevents a slow older result replacing the current search; it does not cancel the old HTTP request.

**41. What happens when deleting the last task on the last page?**

The UI calculates the last valid page from the new total. If the current page is beyond it, it changes page and reloads. This avoids staying on an empty out-of-range page.

**42. What does offline support actually promise?**

It saves eligible task mutations when local storage succeeds and attempts ordered replay later. The shell/static resources can be cached, and open pages retain rendered data. It does not guarantee fresh offline task retrieval, offline login, or acceptance of actions whose permissions have changed.

**43. How are offline changes separated between users?**

Queues use user-specific storage keys, and replay stops if active queue identity changes. The old ownerless queue is discarded. Private API responses bypass shared worker caching. Multiple tabs sharing cookies still need stronger coordination in a future version.

**44. Can an offline create be duplicated?**

Yes. The server might save a request while its response is lost. Retrying can create another task because the API has no idempotency-key mechanism. Stable operation IDs plus server-side deduplication would improve this.

**45. Why retain some failed queue entries and discard others?**

Network errors, server errors, expired sessions, timeouts, and rate limits may succeed later. Permanent client rejections such as forbidden/deleted resources are dropped so they do not block later entries. Conflict UI and scheduled backoff are not implemented.

**46. How is accessibility handled?**

Inputs have labels, actions use buttons, task titles are keyboard accessible, and CSS supports responsive wrapping and dark mode. The form identifies itself as a modal dialog. Full focus trapping, Escape handling, focus restoration, and a browser accessibility audit remain improvements.

### Testing, deployment, and ownership

**47. What do the tests prove?**

They check rules and known regressions: authorization, recurrence dates, scoped analytics, socket claims, seeding, queue behavior, and rewrite/cache configuration. Production builds check compilation and frontend types. Mocks do not prove real MongoDB behavior, hosted cookie delivery, SMTP, or complete signed-in browser flows.

**48. How was the Render memory failure diagnosed?**

The log showed JavaScript heap exhaustion near 256 MB during Nest compilation. The server had not started, explaining the port scan warning. The build now runs the CLI with a 1024 MB old-space limit and passed locally. Host RAM exhaustion still needs a sufficiently sized build environment.

**49. What caused Cannot POST //api/auth/login?**

A trailing slash in BACKEND_URL was concatenated with /api, creating a double slash. Configuration now trims whitespace and trailing slashes. Tests cover origins with no slash, a slash, and multiple slashes with whitespace.

**50. Why can login succeed while notifications fail?**

REST travels through the same-origin rewrite and session cookie. Socket.io connects directly, using its own public API URL, token handshake, and allowed-origin settings. An incorrect NEXT_PUBLIC_API_URL or FRONTEND_ORIGINS can break sockets independently.

**51. How would you scale this application?**

Move priority sorting and trend grouping into database queries, tune compound indexes, and consider cursor pagination. Multiple API instances need shared rate limits and a Socket.io adapter for cross-instance events. Add reliable background delivery, observability, integration tests, and load testing before claiming production scale.

**52. Which bugs did the recent review fix?**

Overlapping analytics $or conditions, overdue counts, recurring unassignment, silent task-action failures, out-of-range pagination, shared offline queues/caches, transient-error queue loss, socket-token reconnects, and filter-grid layout. These illustrate why permission boundaries and failure paths need explicit tests.

**53. What would you do with another week?**

Prioritize database/browser integration tests, atomic Admin bootstrap, recurrence transactions/idempotency, session revocation, and reliable delivery. Then improve multi-tab/offline conflict handling, accessibility, and large-data query performance.

**54. What is the biggest architectural trade-off?**

The project favors understandable modules and practical small-team functionality over operational complexity. In-memory priority sorting, Node-side trend buckets, best-effort side effects, and client-managed offline writes keep the implementation approachable. Their limits should be explained instead of presenting them as production guarantees.

## Known limitations and next steps

| Current limitation | Possible improvement |
|---|---|
| Concurrent first registrations may create multiple Admins | Explicit bootstrap or atomic initialization |
| Logout does not revoke copied JWTs | Revocation/session versioning or refresh-token rotation |
| No email verification or password reset | Expiring single-use verification/reset tokens |
| Password DTO limit counts characters | Validate bcrypt's UTF-8 byte limit |
| Recurrence uses separate parent/child writes | Transaction and unique occurrence/idempotency |
| Very old recurring dates can be costly; monthly loop has a 1000-iteration cap | Direct interval arithmetic and date-bound tests |
| Priority sorting loads all matches | Numeric indexed rank |
| Trend grouping loads recent tasks into Node | Database-side aggregation |
| Audit/notification side effects are best-effort | Transactional outbox and retry worker |
| Offline replay may duplicate creates/conflict with newer edits | Operation IDs, server deduplication, version checks, conflict UI |
| Limited cross-tab queue/session coordination | Cross-tab communication and sync ownership |
| No full offline session/data restore | Deliberate per-account storage/authorization model |
| Established sockets are not continuously reauthorized | Expiry and account-change disconnection |
| Rate limiting has no configured shared store | Shared limiter for multiple API instances |
| Search uses regex despite a text index | Requirement-driven indexed search |
| Cookie flags are not complete CSRF protection | Explicit CSRF/origin checks and tests |
| Incomplete modal accessibility | Focus trap, Escape handling, focus restoration |
| Static health response | Separate readiness/dependency checks where needed |
| No database/browser integration suite | Real MongoDB and end-to-end tests |

## Interview demonstration

Prepare a demo database and confirm logins beforehand. A useful sequence:

1. Explain the architecture and open the dashboard.
2. Log in as Admin and show users/roles.
3. Create a task assigned to Demo User with priority and deadline.
4. Open Demo User in another browser profile and show the notification.
5. Change its status; explain why an assignee cannot edit every field or delete it.
6. Search/filter tasks and show overdue highlighting.
7. Complete a recurring task and show the next occurrence.
8. Compare personal/team analytics and show the audit log.
9. Queue an offline change on an already-loaded page, reconnect, and verify replay.
10. Run tests; explain one regression and one remaining limitation.

Use separate browser profiles for simultaneous accounts: tabs in one profile share cookies. Be ready to explain failure paths as well as the happy path.

## Discussing AI assistance

Describe your actual process. Do not claim manual implementation or verification you have not performed.

A factual account of assistance in this development session:

> AI assistance helped diagnose a Nest build memory failure and malformed API rewrite, add a demo seeder, review application bugs, implement fixes, add regression tests, and prepare documentation. Local production builds, automated tests, and basic frontend HTTP checks were run. Signed-in browser flows against the deployed site were not verified during that review.

For your interview answer, explain which files you reviewed, what you personally changed, how you checked behavior, and what you would improve. Be able to trace login, authorization, recurrence, and offline replay through the code.
