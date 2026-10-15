# Access Denied (Forbidden) User Flow

## Overview

Requests that fail authentication or authorisation are redirected to a 403
"Access denied" page. This covers users with no session, authenticated users
without an approved BNG completer role, and login/callback failures.

## Steps

### Step 1 — Forbidden redirect triggers `[IMPLEMENTED]`

- **Route:** Redirect to `GET /auth/forbidden`, triggered by one of:
  - the session auth scheme (`auth-scheme.js`) when a **required-auth** route
    has no authenticated session **and** no `sessionEnded` breadcrumb. With the
    breadcrumb (an expired session was already ended on an earlier request) it
    redirects to `/auth/session-expired` instead — see
    [session-expired](session-expired.flow.md). `try`-mode routes (the home
    page) never redirect; they continue unauthenticated and render signed-out;
  - the `requireBngCompleterRole` pre-handler (`verify-role.js`) when an
    authenticated user lacks the `bng completer` role (used by protected routes,
    e.g. `projects`, `project-name`);
  - login initiation failure, an IdP `error=` response on the callback, or a
    failed token exchange (`auth/controller.js`). A callback with **no pending
    OIDC state** in the session redirects to `/auth/login`, not here.
- **Template:** None (redirect only)
- **Auth required:** N/A (this is the failure path)
- **Backend endpoint:** None
- **Description:** A failing request is redirected (`.takeover()`) to
  `/auth/forbidden` rather than reaching the protected handler.
- **Validation:** Role entries are colon-delimited (`relationshipId:roleName:status`).
  Access requires an **approved** `bng completer` role: the role name (rebuilt
  from the middle field(s), lower-cased, trimmed) must equal `bng completer`
  **and** the trailing status must be `3` (APPROVED). Statuses `1,2,4,5,6,7`
  (pending/rejected/removed) and any non-integer or out-of-range (not 1–7) status
  are treated as unauthorised. When the token carries a `currentRelationshipId`,
  the approved role must belong to that relationship (compared case-insensitively —
  both sides are trimmed and lower-cased by `canonicalRelationshipId`); otherwise any approved
  `bng completer` role suffices. (Mirrors the backend RBAC — see `verify-role.js`.)
- **On success:** Redirects to `/auth/forbidden`
- **On error:** N/A

### Step 2 — Render forbidden page `[IMPLEMENTED]`

- **Route:** `GET /auth/forbidden`
- **Template:** `src/server/auth/forbidden.njk`
- **Auth required:** No
- **Backend endpoint:** None
- **Description:** Renders the 403 page — heading "Access denied", body
  (`data-testid="forbidden-body"`) "You do not have permission to view this
  page.", a note that access is limited to an **approved BNG completer** role
  (with guidance to contact a Defra administrator if the role is still awaiting
  approval), and a "Return to the home page" link to `/`. The controller passes
  `navigation: []`, so the page's service navigation omits the default "Projects"
  link.
- **Validation:** None (display-only)
- **On success:** Renders the forbidden page with HTTP 403
- **On error:** N/A

## Notes

- `/auth/forbidden` is directly reachable by `GET` with no auth, so the page
  render (and 403 status) is testable in all modes.
- The no-role redirect is reproducible in local/github via the stub's `no-role`
  profile; the single real Defra ID account in e2e cannot reproduce a no-role
  user, so those describes skip in e2e (see `skipInE2e` in `test/utils/env.js`).

## Journey coverage

| Trigger / step                                         | Spec                                                                                                                                                                                 | Run mode                        |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| Step 2: page render, 403, return link, no Projects nav | `forbidden.spec.js`                                                                                                                                                                  | all; nav test needs a session   |
| No session, no breadcrumb → exactly `/auth/forbidden`  | one "unauthenticated access" test per protected route (dashboard, project name, change name, project details, both habitat-details pages, error file) plus `session-timeout.spec.js` | all                             |
| No role / non-approved (status 1) role                 | per-route no-role tests; `forbidden.spec.js` "non-approved role"                                                                                                                     | stub-only                       |
| IdP `error=` callback; failed token exchange           | `forbidden.spec.js` "OIDC callback failures"                                                                                                                                         | not on CDP (LoginFailed metric) |
| Callback with no pending state → `/auth/login`         | `forbidden.spec.js` "OIDC callback failures"                                                                                                                                         | not on CDP (LoginFailed metric) |
| Login initiation (discovery) failure                   | `[BLOCKED: no stub fault hook]` — `test.skip` placeholder; `auth/controller.test.js:130` (mocked)                                                                                    | —                               |
| Approved role on a non-current relationship            | `[BLOCKED: stub profiles have one relationship]` — `test.skip` placeholder; `verify-role.test.js:36`, `:177`                                                                         | —                               |

The unauthenticated tests used to accept `/auth/forbidden` **or** `/auth/login`. They were tightened to `/auth/forbidden` on 2026-10-15, after this doc was corrected.
