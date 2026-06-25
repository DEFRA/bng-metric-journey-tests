# Access Denied (Forbidden) User Flow

## Overview

Requests that fail authentication or authorisation are redirected to a 403
"Access denied" page. This covers users with no session, authenticated users
without an approved BNG completer role, and login/callback failures.

## Steps

### Step 1 — Forbidden redirect triggers `[IMPLEMENTED]`

- **Route:** Redirect to `GET /auth/forbidden`, triggered by one of:
  - the session auth scheme (`auth-scheme.js`) when a protected route has no
    authenticated session;
  - the `requireBngCompleterRole` pre-handler (`verify-role.js`) when an
    authenticated user lacks the `bng completer` role (used by protected routes,
    e.g. `projects`, `project-name`);
  - login/callback OIDC failures (`auth/controller.js`).
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
  the approved role must belong to that relationship; otherwise any approved
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
