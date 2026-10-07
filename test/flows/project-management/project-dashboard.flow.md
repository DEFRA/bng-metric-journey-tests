# Project Dashboard – List Projects User Flow

## Overview

The authenticated user navigates to the manage projects page to view all their projects, then optionally clicks through to a specific project. Since BMD-1043 (frontend PR#352, 2026-10-06) every row opens the project's [project summary](project-summary.flow.md); the project task list it used to open for a project without a baseline has been removed.

## Steps

### Step 1 — Manage projects `[IMPLEMENTED]`

- **Route:** `GET /manage-projects`
- **Template:** `src/server/projects/index.njk`
- **Auth required:** Yes — active session + an **approved (status 3)** `bng completer` role (pre-method; redirects to `/auth/forbidden` otherwise). When the token carries a `currentRelationshipId`, the approved role must be for that relationship.
- **Backend endpoint:** `GET /users/{userId}/projects` (userId from session credentials). The backend does not trust the path segment — it uses the verified token `sub` — and returns only projects visible to the user (owned projects whose latest role for the project's relationship is approved, plus legacy projects with no relationship). The frontend sends no query params, so the backend's default ordering applies — `sort=updated_at`, `order=desc`. The backend also accepts optional `sort` (`created_at`/`updated_at`/`name`) and `order` (`asc`/`desc`) params, but the frontend does not forward them.
- **Organisation scoping (BMD-890, backend PR#207) `[IMPLEMENTED]`:** project visibility is scoped to the **organisation the user is currently signed in as**. `src/db/project-visibility.js` matches a project's `relationship_id` against the token's `currentRelationshipId`, so a user linked to several orgs sees a **different project list per org** — switching organisation changes what this page returns, and a project created under one org is not visible (404 on its project summary) under another. See the callback-side state clearing in [`../authentication/defra-id-login.flow.md`](../authentication/defra-id-login.flow.md).
- **Description:** Renders a table of all projects belonging to the authenticated user. Each row shows project name (linked per the row-link rule below), last modified date, and date created (each shows `—` when null). A "Create project" button links to `/project-name`. If the user has no projects, redirects to `/project-name` instead of rendering the table.
- **Row link target (BMD-1043, frontend PR#352) `[IMPLEMENTED]`:** every project name links to `/projects/{id}/project-summary`, whatever the project's state — `projectsListController` sets `href` unconditionally and `projects/index.njk` renders `{{ item.href }}`. A project with no baseline lands on the summary's no-baseline variant (upload prompt).

  History: BMD-870 (PR#219) made the link conditional — summary with a baseline, else the task list `/add-project-details/{id}`; BMD-852 (PR#227) widened "baseline only" to "has a baseline"; BMD-933 (PR#230, backend PR#262/#286) moved the test onto a backend `has_baseline` list-row flag. BMD-1043 dropped the condition and the task list together. The backend still returns `has_baseline` on each row, but the frontend no longer reads it.

- **Validation:** None (display-only)
- **On success:** Renders the dashboard (`projects/index`) with the `projects` array, each entry carrying the `href` resolved above
- **On error:** Throws `Boom.badGateway` ("Failed to fetch projects") if the backend response status is ≥ 400

---

### Step 2 — View project task list `[REMOVED]`

Removed by **BMD-1043** (frontend PR#352, 2026-10-06): the `GET /add-project-details/{id}` route, `projectTaskListController` and `projects/task-list.njk` are gone, and the path now 404s. Every place that pointed at it — the dashboard row link, the project-details and change-name redirects and Back links, the default upload `returnUrl`, the error-file page's "Back to project" link and the unit-type pages' no-baseline guards — now points at `/projects/{id}/project-summary`.

The task list was the only page linking to `/change-project-name/{id}` and `/project-details/{id}`; nothing links to either form now (open question raised with the team, 2026-10-07). See [`project-summary.flow.md`](project-summary.flow.md).
