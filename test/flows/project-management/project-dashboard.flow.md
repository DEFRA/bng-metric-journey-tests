# Project Dashboard – List Projects User Flow

## Overview

The authenticated user navigates to the manage projects page to view all their projects, then optionally clicks through to a specific project. Since BMD-870 the row link is conditional: a baseline-only project opens its [project summary](project-summary.flow.md), anything else opens the task list.

## Steps

### Step 1 — Manage projects `[IMPLEMENTED]`

- **Route:** `GET /manage-projects`
- **Template:** `src/server/projects/index.njk`
- **Auth required:** Yes — active session + an **approved (status 3)** `bng completer` role (pre-method; redirects to `/auth/forbidden` otherwise). When the token carries a `currentRelationshipId`, the approved role must be for that relationship.
- **Backend endpoint:** `GET /users/{userId}/projects` (userId from session credentials). The backend does not trust the path segment — it uses the verified token `sub` — and returns only projects visible to the user (owned projects whose latest role for the project's relationship is approved, plus legacy projects with no relationship). The frontend sends no query params, so the backend's default ordering applies — `sort=updated_at`, `order=desc`. The backend also accepts optional `sort` (`created_at`/`updated_at`/`name`) and `order` (`asc`/`desc`) params, but the frontend does not forward them.
- **Organisation scoping (BMD-890, backend PR#207) `[IMPLEMENTED]`:** project visibility is scoped to the **organisation the user is currently signed in as**. `src/db/project-visibility.js` matches a project's `relationship_id` against the token's `currentRelationshipId`, so a user linked to several orgs sees a **different project list per org** — switching organisation changes what this page returns, and a project created under one org is not visible (404 on its task list) under another. See the callback-side state clearing in [`../authentication/defra-id-login.flow.md`](../authentication/defra-id-login.flow.md).
- **Description:** Renders a table of all projects belonging to the authenticated user. Each row shows project name (linked per the row-link rule below), last modified date, and date created (each shows `—` when null). A "Create project" button links to `/project-name`. If the user has no projects, redirects to `/project-name` instead of rendering the table.
- **Row link target (BMD-870, frontend PR#219) `[IMPLEMENTED]`:** the project name link is **conditional**, no longer always the task list. `projectsListController` maps each row to an `href` and `projects/index.njk` renders `{{ item.href }}`:

  | Project state                                       | `href`                           |
  | --------------------------------------------------- | -------------------------------- |
  | Baseline uploaded, no post-intervention             | `/projects/{id}/project-summary` |
  | Anything else (no baseline, or baseline **and** PI) | `/add-project-details/{id}`      |

  The test is `isBaselineOnlyProject(item.project)` — `Boolean(project?.baseline) && !project?.postIntervention` (`src/server/common/helpers/project-state.js`). `GET /users/{userId}/projects` returns whole project rows, so the JSONB the test needs is on the list response. A newly created project has no baseline, so it still links to the task list. See [`project-summary.flow.md`](project-summary.flow.md).

- **Validation:** None (display-only)
- **On success:** Renders the dashboard (`projects/index`) with the `projects` array, each entry carrying the `href` resolved above
- **On error:** Throws `Boom.badGateway` ("Failed to fetch projects") if the backend response status is ≥ 400

---

### Step 2 — View project task list `[IMPLEMENTED]`

> **Slated for deprecation.** BMD-870 states the project summary "replaces" the task list, which is "to be deprecated in due course". The route is unchanged and fully live — but it is no longer the only landing page for a project, and a baseline-only project reaches it only via a direct URL or the `project-summary` guard redirect. See [`project-summary.flow.md`](project-summary.flow.md).

- **Route:** `GET /add-project-details/{id}`
- **Template:** `src/server/projects/task-list.njk`
- **Auth required:** Yes — active session + an approved (status 3) `bng completer` role (same pre-method as Step 1)
- **Backend endpoint:** `GET /projects/{id}` — returns 404 both when the project does not exist and when it exists but is not visible to the user (RBAC)
- **Description:** Renders the task list for a specific project. The page heading shows the project name as a caption, above a short guidance list ("complete each section…", "you can edit sections…", "you can save your progress…"). The task list has four items: Project Name (Completed — links to `/change-project-name/{id}`), Project Details (Not yet started — links to `/project-details/{id}`), On-site baseline habitats (dynamic — see On success), On-site post intervention habitats (dynamic — see On success).
- **Validation:** `id` path param must be a valid UUID (Joi); invalid UUID → Hapi 400 validation error
- **On success:** Renders `projects/task-list` with task list items. `isBaselineUploaded = Boolean(data?.project?.baseline)` — if true, "On-site baseline habitats" shows "Completed" (links to `/projects/{id}/baseline-habitat-list`); if false, shows "Not yet started" (links to **`/projects/{id}/upload-file`**). `isPostInterventionUploaded = Boolean(data?.project?.postIntervention)` — if true, "On-site post intervention habitats" shows "Completed" (links to `/projects/{id}/post-intervention-habitat-list`); if false, shows "Not yet started" (links to **`/projects/{id}/upload-file`**).

  **BMD-850 (frontend PR#207):** both "Not yet started" rows now point at the shared file-type selection page, with **no `returnUrl`** query param — so its Back/Cancel default to `/add-project-details/{id}`, i.e. back here. Before that change they linked directly to `/projects/{id}/upload-baseline-file` and `/projects/{id}/upload-post-intervention-file` respectively. See [`test/flows/upload-file/choose-upload-type.flow.md`](../upload-file/choose-upload-type.flow.md).

  Note both rows resolve to the **same** href while neither upload exists; the selection page's radio choice is what disambiguates them.

- **On error:** If the backend returns a 404 (missing or not visible), renders the same template with `error: true` and caption "Project not found" — task list content is hidden; only the heading/caption is shown
