# Analyse User Flow — Reference

## Purpose

Produce or update a `test/flows/<flow-name>.flow.md` file that reflects the current state of the named user flow in the frontend and backend source. Flow docs are the single source of truth consumed by `/discover-user-journey` and `/verify-integration-coverage`.

---

## Step 1 — Resolve the flow name to source directories

The flow name argument is kebab-case (e.g. `create-project`, `upload-baseline`). Use it to locate the relevant directories:

1. Read `../bng-metric-frontend/src/server/router.js` — identify every route that belongs to this flow. A flow groups all the routes a user traverses to complete one task (e.g. all routes involved in creating a project).
2. List the route handler directories at `../bng-metric-frontend/src/server/` that correspond to those routes.
3. For each directory, read:
   - `index.js` — route handler (reveals auth requirements, validation, backend calls)
   - `index.njk` — Nunjucks template (reveals form fields, links to next step, error messages)
4. Read `../bng-metric-backend/src/routes/` — identify any backend API endpoints the frontend handler calls during this flow.

Do **not** read frontend unit tests, frontend integration tests, or any test files. Source routes and templates only.

---

## Step 2 — Read the existing flow doc (if present)

Check if `test/flows/<flow-name>.flow.md` already exists. If it does, note which steps are already documented and what their current markers are. You will be updating, not replacing, existing content where possible.

---

## Step 3 — Assign status markers

For each route/step identified in Step 1:

| Marker              | When to assign                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[IMPLEMENTED]`     | Route handler and Nunjucks template both exist and are complete (not stubs)                                                                                   |
| `[PLANNED]`         | Route is declared in router.js but handler or template is missing or clearly stubbed                                                                          |
| `[BLOCKED: reason]` | Implemented in source but cannot be covered by an E2E test — state the specific reason (e.g. `requires third-party OIDC redirect`, `requires live S3 bucket`) |

---

## Step 4 — Produce the flow doc

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
- Populate **Validation** from the Joi schema or validation helper in the route handler. List every distinct rule as it determines the edge cases that `/discover-user-journey` will recommend testing.
- Populate **On success** and **On error** from the controller's redirect and view calls. These tell `/discover-user-journey` what journeys to assert and tell `/verify-integration-coverage` what response codes and behaviours to check in integration tests.
- For `[PLANNED]` or `[BLOCKED]` steps, fill in as much as is known from the router declaration; leave unknown fields as `Unknown`.

---

## Step 5 — Approval gate

Present the proposed flow doc (or a diff if updating an existing one) and explain any marker changes. **Stop here.** Do not write to `test/flows/<flow-name>.flow.md` until the user explicitly approves.

On approval: write the file. Do not touch any spec, page object, fixture, or test file.
