# Access Denied (Forbidden) User Flow

## Overview

Requests that fail authentication or authorisation are redirected to a 403
"Access denied" page. This covers users with no session, authenticated users
lacking the BNG completer role, and login/callback failures.

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
- **Validation:** Role is parsed from colon-delimited token role entries
  (`relationshipId:roleName:statusNum`); access is granted only if any entry's
  role name equals `bng completer` (case-insensitive).
- **On success:** Redirects to `/auth/forbidden`
- **On error:** N/A

### Step 2 — Render forbidden page `[IMPLEMENTED]`

- **Route:** `GET /auth/forbidden`
- **Template:** `src/server/auth/forbidden.njk`
- **Auth required:** No
- **Backend endpoint:** None
- **Description:** Renders the 403 page — heading "Access denied", body
  (`data-testid="forbidden-body"`) "You do not have permission to view this
  page.", a note that access is limited to the **BNG completer** role, and a
  "Return to the home page" link to `/`.
- **Validation:** None (display-only)
- **On success:** Renders the forbidden page with HTTP 403
- **On error:** N/A

## Notes

- `/auth/forbidden` is directly reachable by `GET` with no auth, so the page
  render (and 403 status) is testable in all modes.
- The no-role redirect is reproducible in local/github via the stub's `no-role`
  profile; the single real Defra ID account in e2e cannot reproduce a no-role
  user, so those describes skip in e2e (see `skipInE2e` in `test/utils/env.js`).
