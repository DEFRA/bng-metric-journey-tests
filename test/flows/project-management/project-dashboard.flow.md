# Project Dashboard – List Projects User Flow

## Overview

The authenticated user navigates to the manage projects page to view all their projects, then optionally clicks through to a specific project. Since BMD-870 the row link is conditional: a project with a baseline opens its [project summary](project-summary.flow.md), one without opens the task list.

## Steps

### Step 1 — Manage projects `[IMPLEMENTED]`

- **Route:** `GET /manage-projects`
- **Template:** `src/server/projects/index.njk`
- **Auth required:** Yes — active session + an **approved (status 3)** `bng completer` role (pre-method; redirects to `/auth/forbidden` otherwise). When the token carries a `currentRelationshipId`, the approved role must be for that relationship.
- **Backend endpoint:** `GET /users/{userId}/projects` (userId from session credentials). The backend does not trust the path segment — it uses the verified token `sub` — and returns only projects visible to the user (owned projects whose latest role for the project's relationship is approved, plus legacy projects with no relationship). The frontend sends no query params, so the backend's default ordering applies — `sort=updated_at`, `order=desc`. The backend also accepts optional `sort` (`created_at`/`updated_at`/`name`) and `order` (`asc`/`desc`) params, but the frontend does not forward them.
- **Organisation scoping (BMD-890, backend PR#207) `[IMPLEMENTED]`:** project visibility is scoped to the **organisation the user is currently signed in as**. `src/db/project-visibility.js` matches a project's `relationship_id` against the token's `currentRelationshipId`, so a user linked to several orgs sees a **different project list per org** — switching organisation changes what this page returns, and a project created under one org is not visible (404 on its task list) under another. See the callback-side state clearing in [`../authentication/defra-id-login.flow.md`](../authentication/defra-id-login.flow.md).
- **Description:** Renders a table of all projects belonging to the authenticated user. Each row shows project name (linked per the row-link rule below), last modified date, and date created (each shows `—` when null). A "Create project" button links to `/project-name`. If the user has no projects, redirects to `/project-name` instead of rendering the table.
- **Row link target (BMD-870 PR#219, widened by BMD-852 PR#227) `[IMPLEMENTED]`:** the project name link is **conditional**, no longer always the task list. `projectsListController` maps each row to an `href` and `projects/index.njk` renders `{{ item.href }}`:

  | Project state                          | `href`                           |
  | -------------------------------------- | -------------------------------- |
  | Baseline uploaded (with or without PI) | `/projects/{id}/project-summary` |
  | No baseline yet                        | `/add-project-details/{id}`      |

  **BMD-933 changed where the answer comes from** (frontend PR#230, backend PR#262 and #286, 2026-08-19/26). The test is now:

  ```js
  project.has_baseline ?? hasBaselineData(project.project)
  ```

  `has_baseline` is a **flag computed by the backend and returned on each list row**. The JSONB check `hasBaselineData(project.project)` — `Boolean(project?.baseline)` (`src/server/common/helpers/project-state.js`) — survives only as a fallback covering the window where the frontend deploys ahead of the backend that sets the flag.

  **`GET /users/{userId}/projects` no longer returns whole project rows.** Backend BMD-933 stopped loading the full project document for the list page, so `project.project.baseline` is **not** on the list response any more and the fallback resolves to `false` in practice. A fixture or assertion built on the old shape is testing data the endpoint has stopped sending — the `??` will simply take the flag.

  Earlier history: BMD-852 widened the condition from `isBaselineOnlyProject` (`Boolean(baseline) && !postIntervention`), under which a project with post-intervention data fell through to the task list. A newly created project has no baseline, so it still links to the task list. See [`project-summary.flow.md`](project-summary.flow.md).

- **Validation:** None (display-only)
- **On success:** Renders the dashboard (`projects/index`) with the `projects` array, each entry carrying the `href` resolved above
- **On error:** Throws `Boom.badGateway` ("Failed to fetch projects") if the backend response status is ≥ 400

---

### Step 2 — View project task list `[IMPLEMENTED]`

> **Slated for deprecation.** BMD-870 states the project summary "replaces" the task list, which is "to be deprecated in due course". The route is unchanged and fully live — but it is no longer the only landing page for a project, and any project with a baseline reaches it only via a direct URL (since BMD-852 the summary no longer redirects here for a project that has both documents). See [`project-summary.flow.md`](project-summary.flow.md).

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
