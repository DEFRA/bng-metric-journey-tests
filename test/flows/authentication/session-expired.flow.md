# Session Expired User Flow

## Overview

When an authenticated user's tokens expire, the frontend attempts a silent
token refresh. If the refresh fails — or succeeds but the renewed token no
longer carries an approved BNG completer role — the session is ended and the
user is redirected to a "You have been signed out" page offering a "Sign in
again" link. This is distinct from the plain "Access denied" page shown to a
user who never signed in.

## Steps

### Step 1 — Session-expired redirect triggers `[BLOCKED: shared server-side session]`

- **Route:** Redirect to `GET /auth/session-expired`, triggered by the session
  auth scheme (`auth-scheme.js`) on a protected route in one of three cases:
  - the session's tokens have expired (`isSessionExpired` — the `exp` claim is
    past, within a 30s leeway, or unreadable) **and** the silent refresh
    (`refreshSession` → `refreshTokenGrant`) fails;
  - the silent refresh **succeeds** but the refreshed token no longer carries an
    approved `bng completer` role (the user was approved before the refresh but
    is not after — `expireSession` is called);
  - a `try`-mode page (the home page) already ended an expired session on an
    earlier request, leaving a `sessionEnded` breadcrumb; the next protected
    request finds no user but `wasSessionEnded` is true.
- **Template:** None (redirect only)
- **Auth required:** N/A (this is the session-ended path)
- **Backend endpoint:** None (the silent refresh calls the IdP token endpoint,
  not the backend)
- **Description:** `expireSession` resets the `yar` session (dropping the
  server-side cache entry and regenerating the session id, so a replayed cookie
  cannot resurrect it) and sets a `sessionEnded` breadcrumb. The request is
  redirected (`.takeover()`) to `/auth/session-expired`.
- **Validation:** A session with no readable `exp` claim is treated as expired.
  Expiry uses a 30-second leeway so a token about to lapse is refreshed before a
  later backend call in the same request can fail. The breadcrumb distinguishes
  an expired-then-ended session (→ `/auth/session-expired`) from a never-signed-in
  browser (→ `/auth/forbidden`).
- **On success:** Redirects to `/auth/session-expired`
- **On error:** N/A
- **Blocked reason:** Reproducing live token expiry requires tearing down the
  shared `STORAGE_STATE` session (`yar.reset()`), which cascades failures across
  every other completer-authenticated test in the run — the same constraint as
  the interactive sign-out click-through. The destination page is covered by its
  directly-reachable `GET` render below.

### Step 2 — Render session-expired page `[IMPLEMENTED]`

- **Route:** `GET /auth/session-expired`
- **Template:** `src/server/auth/session-expired.njk`
- **Auth required:** No
- **Backend endpoint:** None
- **Description:** Renders the page — heading "You have been signed out", body
  (`data-testid="session-expired-body"`) explaining the session ended and that
  saved answers are safe, a "Sign in again" button
  (`data-testid="sign-in-again-button"`, href `/auth/login`), and a "Return to
  the home page" link to `/`. The controller passes `navigation: []`, so the
  service navigation omits the default "Projects" link.

  **BMD-893 changed the header markup** (frontend PR#213, 2026-08-21,
  accessibility work). `session-expired.njk` and `signed-out.njk` **no longer
  override the `header` block** with their own GOV.UK header + service navigation.
  `layouts/page.njk` now splits that into two sub-blocks — `govukHeader` and
  `govukServiceNavigation` — so the parent `govuk/template.njk` still wraps the
  content in its `<header>` landmark; overriding the outer block had been
  orphaning it. The rendered header looks the same (the page is unauthenticated,
  so `navItems` is empty either way), but it now sits **inside the `<header>`
  landmark** rather than replacing it.

  The same PR wrapped `beforeContent` — the Beta phase banner and any breadcrumbs
  — in `<div role="region" aria-label="Page information">`, because it renders
  outside `<main>` and was otherwise orphaned outside every landmark. This affects
  **every page in the service**, not just this one: an accessibility test counting
  landmarks, or a locator anchored on the phase banner's position in the tree,
  sees a different structure than before.

- **Validation:** None (display-only)
- **On success:** Renders the session-expired page (200)
- **On error:** N/A

## Notes

- `/auth/session-expired` is directly reachable by `GET` with no auth, so the
  page render (and the "Sign in again" → `/auth/login` link) is testable in all
  modes independently of the expiry redirect (see `session-expired.spec.js`).
  Note `session-timeout.spec.js` does **not** cover this page: it clears the
  session cookie client-side, which leaves no `sessionEnded` breadcrumb and so
  redirects to `/auth/forbidden`, not here.
- After `expireSession`, the `no-store` Cache-Control header (`auth-scheme.js`
  `onPreResponse`) is not set on this response (the request is unauthenticated by
  the time it renders), but the reset session id prevents the old cookie from
  resurrecting the dead session.
- The silent refresh preserves Defra ID enrichment claims (`roles`,
  `relationships`, `currentRelationshipId`) that a `refresh_token` grant blanks —
  see `mergeRefreshedClaims` in `refresh-session.js` (BMD-829). Only a genuine
  role downgrade after a successful refresh ends the session here.
