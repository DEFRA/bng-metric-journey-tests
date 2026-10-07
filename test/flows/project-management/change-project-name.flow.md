# Change Project Name User Flow

## Overview

The user navigates to the change-name form for an existing project (since BMD-1043 removed the task list, the only page that linked here, it is reachable only by URL — open question raised with the team, 2026-10-07), which is pre-populated with the current name, edits the name, and submits it. On success they are returned to the project summary (BMD-1043, frontend PR#352; it was the project task list, now removed).

## Steps

### Step 1 — View change project name form `[IMPLEMENTED]`

- **Route:** `GET /change-project-name/{id}`
- **Template:** `src/server/change-project-name/index.njk`
- **Auth required:** Yes (session + BNG completer role)
- **Backend endpoint:** `GET /projects/{id}`
- **Description:** User navigates to the form. The input is pre-populated with the project's current name fetched from the backend.
- **Validation:** `id` path param must be a valid UUID; if the backend returns 4xx the handler throws a bad-gateway error; if the project is not found the handler throws a 404.
- **On success:** Renders the form with `projectName` pre-filled
- **On error:** Boom.badGateway if backend call fails; Boom.notFound if project does not exist

### Step 2 — Submit updated project name `[IMPLEMENTED]`

- **Route:** `POST /change-project-name/{id}`
- **Template:** `src/server/change-project-name/index.njk`
- **Auth required:** Yes (session + BNG completer role)
- **Backend endpoint:** `PATCH /projects/{id}`
- **Description:** User submits the form with a new project name. The frontend sends `{ project: { name } }` to the backend, which updates the name in the `project` JSONB column via `jsonb_set`.
- **Validation:**
  - Required — empty/missing value: "Enter a project name"
  - Max 1,000 characters: "Project name must be 1000 characters or fewer"
  - No control characters (code points < U+0020), no DEL (U+007F), no Unicode surrogates (U+D800–U+DFFF): "Project name must only contain valid characters"
  - Trimmed before validation (leading/trailing whitespace stripped)
- **On success:** Redirects to `/projects/{id}/project-summary`
- **On error (validation):** Re-renders form with GOV.UK error summary and inline field error on `#project-name`; page title prefixed with "Error:"
- **On error (backend 4xx):** Throws Boom.badGateway — not shown inline
