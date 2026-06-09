# Create Project User Flow

## Overview

The user creates a new Biodiversity Net Gain project by entering a project name on the project dashboard, and is then directed to the project task list to begin filling in project details.

## Steps

### Step 1 — View project dashboard `[IMPLEMENTED]`

- **Route:** `GET /manage-projects`
- **Template:** `src/server/projects/index.njk`
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** `GET /users/{userId}/projects`
- **Description:** The user sees a table of their existing projects (sorted by `updated_at desc` by default) and a "Create project" button linking to `/project-name`. If the user has no projects, the dashboard redirects immediately to `/project-name` instead of rendering the table.
- **Validation:** None (display-only)
- **On success:** Renders the project dashboard
- **On error:** Throws `Boom.badGateway` (502) if the backend call fails

---

### Step 2 — View project name form `[IMPLEMENTED]`

- **Route:** `GET /project-name`
- **Template:** `src/server/project-name/index.njk`
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** None
- **Description:** The user sees a single text input for a project name with a hint ("Give your project a unique name so you can find it later"), a "Back" link to `/manage-projects`, and a "Save and continue" button.
- **Validation:** None (display-only)
- **On success:** Renders the project name form
- **On error:** N/A

---

### Step 3 — Submit project name `[IMPLEMENTED]`

- **Route:** `POST /project-name`
- **Template:** `src/server/project-name/index.njk`
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** `POST /projects/new`
- **Description:** The user submits the project name. The frontend validates it locally before calling the backend to create the project, passing the name and the authenticated user's `sub` as `userId`.
- **Validation:**
  - `projectName` required; empty or whitespace-only rejected — "Enter a project name"
  - Max 1000 characters — "Project name must be 1000 characters or fewer"
  - No control characters (codepoints `< 0x20`, `= 0x7F`, or surrogate range `0xD800–0xDFFF`) — "Project name must only contain valid characters"
  - Leading/trailing whitespace is trimmed before validation
- **On success:** Redirects to `/manage-projects`
- **On error (validation):** Re-renders the form with GOV.UK error summary and inline field error; pre-fills the input with the submitted value
- **On error (backend):** Throws `Boom.badGateway` ("Failed to create project", 502) if `POST /projects/new` returns ≥ 400

---

### Step 4 — View project task list `[IMPLEMENTED]`

- **Route:** `GET /add-project-details/{id}`
- **Template:** `src/server/projects/task-list.njk`
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** `GET /projects/{id}`
- **Description:** The user clicks the project name link on the dashboard and sees a GOV.UK task list with four items: "Project Name" (Completed), "Project Details" (Not yet started), "On-site baseline habitats" (dynamic — see below), and "On-site post intervention habitats" (Cannot start yet). The project name appears as a caption.
- **Validation:** `id` path parameter must be a valid UUID
- **On success:** Renders the task list with the project name as caption. `isBaselineUploaded = Boolean(data?.project?.baseline)` — if true, "On-site baseline habitats" shows "Completed" (links to `/projects/{id}/baseline-habitat-list`); if false, shows "Not yet started" (links to `/projects/{id}/upload-baseline-file`)
- **On error:** If the backend returns a 404, the Boom error is caught and the page re-renders with `error: true` — the task list body is hidden via `{% if not error %}`; only the heading/caption are shown
