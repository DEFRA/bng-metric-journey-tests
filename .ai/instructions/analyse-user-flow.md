# Analyse User Flow — Reference

## Purpose

Produce or update a `test/flows/<flow-name>.flow.md` file that reflects the current state of the named user flow in the frontend and backend source. Flow docs are the single source of truth consumed by `/discover-journey-tests` and `/verify-integration-coverage`.

---

## Pre-flight check

Before doing anything else, ask the user to confirm **both** of the following:

1. "Have you run `docker compose pull` to pull the latest service images?"
2. "Have you run the full test suite (`docker compose up --wait` → `npm run test:github`) against those images and confirmed all tests pass with no failures?"

If the answer to either is **no**, stop and ask the user to complete the pre-flight first:

```sh
docker compose pull
docker compose up --wait
npm run test:github
```

Only proceed once the user confirms both steps are done and all tests passed.

---

## Step 1 — Interpret the argument and identify routes

The argument may be a kebab-case name (e.g. `create-project`) or a natural language description (e.g. "user enters a project name and is redirected to the dashboard"). Both are valid. Treat it as a hint, not a directory path.

1. Read `../bng-metric-frontend/src/server/router.js` in full. Use the argument to identify every route that belongs to the requested flow. A flow groups all the routes a user traverses to complete one task — think about the user's journey, not just one route.
2. If the argument is ambiguous or could match multiple distinct flows, list the candidates and ask the user to confirm which one before proceeding.
3. List the route handler directories at `../bng-metric-frontend/src/server/` that correspond to the matched routes.
4. For each directory, read:
   - `index.js` — route handler (reveals auth requirements, validation, backend calls)
   - `index.njk` — Nunjucks template (reveals form fields, links to next step, error messages)
5. Read `../bng-metric-backend/src/routes/` — identify any backend API endpoints the frontend handler calls during this flow.

Do **not** read frontend unit tests, frontend integration tests, or any test files. Source routes and templates only.

---

## Step 2 — Determine the flow file name

If the argument is already a kebab-case name (e.g. `create-project`), use it as the flow file name.

If the argument is a natural language description, derive a concise kebab-case name from the routes and user goal identified in Step 1 (e.g. `define-project-name`, `upload-baseline`, `sign-in`). Propose the name to the user and confirm before proceeding — the file name is the stable identifier used by all other commands.

---

## Step 3 — Read the existing flow doc (if present)

Check if `test/flows/<flow-name>.flow.md` already exists. If it does, note which steps are already documented and what their current markers are. You will be updating, not replacing, existing content where possible.

---

## Step 4 — Assign status markers

For each route/step identified in Step 1:

| Marker              | When to assign                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[IMPLEMENTED]`     | Route handler and Nunjucks template both exist and are complete (not stubs)                                                                                   |
| `[PLANNED]`         | Route is declared in router.js but handler or template is missing or clearly stubbed                                                                          |
| `[BLOCKED: reason]` | Implemented in source but cannot be covered by an E2E test — state the specific reason (e.g. `requires third-party OIDC redirect`, `requires live S3 bucket`) |

---

## Step 5 — Produce the flow doc

Use this structure for `test/flows/<flow-name>.flow.md`:

```markdown
# <Flow Name> User Flow

## Overview

<One or two sentences describing the user goal this flow achieves.>

## Steps

### Step 1 — <short imperative description, e.g. "View project name form"> `[IMPLEMENTED]`

- **Route:** `GET /path`
- **Template:** `src/server/<dir>/index.njk`
- **Auth required:** Yes / No
- **Backend endpoint:** `METHOD /api/path` (or None)
- **Description:** What the user sees and does at this step.
- **Validation:** None (display-only) — or list any query-param / pre-condition checks
- **On success:** Renders the form
- **On error:** N/A

### Step 2 — <short imperative description, e.g. "Submit project name"> `[IMPLEMENTED]`

- **Route:** `POST /path`
- **Template:** `src/server/<dir>/index.njk`
- **Auth required:** Yes / No
- **Backend endpoint:** `METHOD /api/path` (or None)
- **Description:** User submits the form.
- **Validation:** <list each rule, e.g. "field required; max N characters; allowed values: X, Y">
- **On success:** Redirects to `/next-path`
- **On error:** Re-renders form with GOV.UK error summary and inline field error(s)
```

Rules:

- Include both the GET (display) and POST (submit) for every form step — each is its own numbered step.
- Populate **Validation** from the Joi schema or validation helper in the route handler. List every distinct rule as it determines the edge cases that `/discover-journey-tests` will recommend testing.
- Populate **On success** and **On error** from the controller's redirect and view calls. These tell `/discover-journey-tests` what journeys to assert and tell `/verify-integration-coverage` what response codes and behaviours to check in integration tests.
- For `[PLANNED]` or `[BLOCKED]` steps, fill in as much as is known from the router declaration; leave unknown fields as `Unknown`.

---

## Step 6 — Approval gate

Present the proposed flow doc (or a diff if updating an existing one) and explain any marker changes. **Stop here.** Do not write to `test/flows/<flow-name>.flow.md` until the user explicitly approves.

On approval: write the file. Do not touch any spec, page object, fixture, or test file.
