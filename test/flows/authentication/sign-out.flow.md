# Sign Out User Flow

## Overview

An authenticated user ends their session via the header "Sign out" link. The
frontend clears the local session and redirects through the Defra ID
end-session endpoint, returning the user to a signed-out confirmation page.

## Steps

### Step 1 — Initiate sign-out `[IMPLEMENTED]`

- **Route:** `GET /auth/logout`
- **Template:** None (redirect only)
- **Auth required:** No (the "Sign out" header link is only rendered when `isAuthenticated`)
- **Backend endpoint:** None
- **Description:** The header "Sign out" link (`layouts/page.njk`, shown when
  `isAuthenticated`) points to `/auth/logout`. The handler resets the `yar`
  session (`request.yar.reset()`) and builds the OIDC end-session URL
  (`id_token_hint` from the stored `idToken`, `post_logout_redirect_uri` from
  config).
- **Validation:** None
- **On success:** Redirects to the OIDC end-session endpoint (stub in
  local/github, real Defra ID in e2e), which redirects back to `/auth/signed-out`
- **On error:** If the end-session URL cannot be built (OIDC discovery failure),
  redirects directly to `/auth/signed-out`

### Step 2 — Signed-out confirmation `[IMPLEMENTED]`

- **Route:** `GET /auth/signed-out`
- **Template:** `src/server/auth/signed-out.njk`
- **Auth required:** No
- **Backend endpoint:** None
- **Description:** Renders the confirmation page — heading "You have been signed
  out", body (`data-testid="signed-out-body"`) "You have been signed out of the
  BNG metric service.", and a "Return to the home page" link to `/`.
- **Validation:** None (display-only)
- **On success:** Renders the signed-out page (200)
- **On error:** N/A

## Notes

- The end-session round-trip exits the service to the identity provider. In
  local/github the `cdp-defra-id-stub` handles it; in e2e it is the real Defra ID
  end-session endpoint.
- After `reset()`, the `no-store` Cache-Control header (`auth-scheme.js`
  `onPreResponse`) prevents the browser from showing cached authenticated pages.
- `/auth/signed-out` is directly reachable by `GET` with no auth, so the page
  render is testable in all modes independently of the logout redirect.
- **The interactive logout click-through is not E2E-tested.** The OIDC session is
  stored server-side (the cookie holds only a session ID), so `/auth/logout`'s
  `request.yar.reset()` destroys the session keyed by the **shared**
  `STORAGE_STATE` cookie — tearing it down mid-run cascades failures across every
  other completer-authenticated test. The journey is therefore covered by its two
  non-destructive endpoints: the header "Sign out" link targets `/auth/logout`
  (`sign-out.spec.js`) and the `/auth/signed-out` destination renders
  (`signed-out.spec.js`). Full click-through coverage would require a dedicated
  throwaway completer session minted in `auth.setup.js`.
