# Project Dashboard – List Projects User Flow

## Overview

The authenticated user navigates to the manage projects page to view all their projects, then optionally clicks through to a specific project's task list.

## Steps

### Step 1 — Manage projects `[IMPLEMENTED]`

- **Route:** `GET /manage-projects`
- **Template:** `src/server/projects/index.njk`
- **Auth required:** Yes — active session + an **approved (status 3)** `bng completer` role (pre-method; redirects to `/auth/forbidden` otherwise). When the token carries a `currentRelationshipId`, the approved role must be for that relationship.
- **Backend endpoint:** `GET /users/{userId}/projects` (userId from session credentials). The backend does not trust the path segment — it uses the verified token `sub` — and returns only projects visible to the user (owned projects whose latest role for the project's relationship is approved, plus legacy projects with no relationship). The frontend sends no query params, so the backend's default ordering applies — `sort=updated_at`, `order=desc`. The backend also accepts optional `sort` (`created_at`/`updated_at`/`name`) and `order` (`asc`/`desc`) params, but the frontend does not forward them.
- **Description:** Renders a table of all projects belonging to the authenticated user. Each row shows project name (linked to its task list at `/add-project-details/{id}`), last modified date, and date created (each shows `—` when null). A "Create project" button links to `/project-name`. If the user has no projects, redirects to `/project-name` instead of rendering the table.
- **Validation:** None (display-only)
- **On success:** Renders the dashboard (`projects/index`) with the `projects` array
- **On error:** Throws `Boom.badGateway` ("Failed to fetch projects") if the backend response status is ≥ 400

---

### Step 2 — View project task list `[IMPLEMENTED]`

- **Route:** `GET /add-project-details/{id}`
- **Template:** `src/server/projects/task-list.njk`
- **Auth required:** Yes — active session + an approved (status 3) `bng completer` role (same pre-method as Step 1)
- **Backend endpoint:** `GET /projects/{id}` — returns 404 both when the project does not exist and when it exists but is not visible to the user (RBAC)
- **Description:** Renders the task list for a specific project. The page heading shows the project name as a caption, above a short guidance list ("complete each section…", "you can edit sections…", "you can save your progress…"). The task list has four items: Project Name (Completed — links to `/change-project-name/{id}`), Project Details (Not yet started — links to `/project-details/{id}`), On-site baseline habitats (dynamic — see On success), On-site post intervention habitats (dynamic — see On success).
- **Validation:** `id` path param must be a valid UUID (Joi); invalid UUID → Hapi 400 validation error
- **On success:** Renders `projects/task-list` with task list items. `isBaselineUploaded = Boolean(data?.project?.baseline)` — if true, "On-site baseline habitats" shows "Completed" (links to `/projects/{id}/baseline-habitat-list`); if false, shows "Not yet started" (links to `/projects/{id}/upload-baseline-file`). `isPostInterventionUploaded = Boolean(data?.project?.postIntervention)` — if true, "On-site post intervention habitats" shows "Completed" (links to `/projects/{id}/post-intervention-habitat-list`); if false, shows "Not yet started" (links to `/projects/{id}/upload-post-intervention-file`)
- **On error:** If the backend returns a 404 (missing or not visible), renders the same template with `error: true` and caption "Project not found" — task list content is hidden; only the heading/caption is shown
