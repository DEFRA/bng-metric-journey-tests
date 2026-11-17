# Defra ID Login User Flow

## Overview

In e2e mode (deployed dev/test) the suite signs in through the **real Defra ID /
GOV.UK One Login** journey instead of the `cdp-defra-id-stub`. A user clicks
"Sign in" on the home page and authenticates with a One Login email address and
password, landing on the project dashboard. Used by
`test/setup/auth.setup.js` to mint the completer `storageState` in e2e; local and
github runs continue to use the stub.

## Steps

### Step 1 — Start sign-in `[IMPLEMENTED]`

- **Route:** `GET /auth/login` → redirect to the Defra ID authorize endpoint
- **Auth required:** No (initiates authentication)
- **Description:** The home "Sign in" button links to `/auth/login`; the frontend
  begins the OIDC authorization code flow and redirects to Defra ID.
- **Note:** `GET /auth/login?forceReselection=true` propagates `forceReselection=true`
  to the IdP authorization request (forces account/organisation re-selection);
  omitted otherwise.

### Step 2 — Choose to sign in `[IMPLEMENTED]`

- **Page:** GOV.UK One Login `/sign-in-or-create` (external, not in this repo's
  source)
- **Description:** BMD-1174 made Defra ID One Login-only, so Defra ID no longer
  shows a "choose how to sign in" page — B2C redirects straight to One Login's
  "Create your GOV.UK One Login or sign in". Click "Sign in".

### Step 3 — Enter credentials `[IMPLEMENTED]`

- **Pages:** One Login `/enter-email` then `/enter-password` (external)
- **Description:** Enter the email address and click "Continue", then the
  password and click "Continue".
- **Credentials:** from `DEFRA_ID_USERNAME` (the email) / `DEFRA_ID_PASSWORD`.

### Step 3a — Enter a security code `[IMPLEMENTED — not currently reached]`

- **Page:** One Login security-code page (external)
- **Description:** Only if One Login asks for two-factor authentication. Defra ID
  dev/test request password-only sign-in today, so a fresh browser returns to the
  service straight after the password. If the code page appears, the flow
  generates a 6-digit code from the authenticator-app setup key
  (`DEFRA_ID_TOTP_SECRET`, `test/utils/totp.js`) and clicks "Continue". The
  code-page selector is unverified until the page is seen.

### Step 4 — Return to service `[IMPLEMENTED]`

- **Route:** `GET /auth/callback` → redirect to `/manage-projects`
- **Backend endpoint:** `POST {backend}/auth/session` (best-effort) — after the
  token exchange the frontend forwards the `id_token` as a Bearer credential so
  the backend (`defra-jwt` strategy) upserts the user's identity, relationships
  and roles (`bng.users` / `bng.relationships` / `bng.roles`) in one transaction
  (204). Non-blocking: a failure is logged, recorded as a session-persist
  failure metric, and sign-in still proceeds.
- **Description:** Defra ID redirects back with an auth code; the frontend
  exchanges it for a session, persists the session to the backend (best-effort),
  and lands on the project dashboard.
- **Login metric:** At the callback the frontend also records a login outcome
  metric (`auth-metrics.js`) — `LoginSucceeded` when the claims carry an approved
  `bng completer` role, otherwise `LoginFailed` (RBAC). This is separate from the
  backend `login_audit` row written by `POST {backend}/auth/session`.
- **Role-less user:** The callback redirects to `/manage-projects` regardless of
  role. A user without an approved `bng completer` role is **not** bounced here —
  the per-route role gate (`requireBngCompleterRole`) redirects them to
  `/auth/forbidden` on that first protected request (see `access-denied.flow.md`).

### Step 5 — Clear journey state on an organisation switch `[BLOCKED: requires a second Defra ID organisation]`

- **Route:** part of `GET /auth/callback` (no separate route)
- **Backend endpoint:** None — this is frontend session housekeeping
- **Description:** BMD-890 (frontend PR#204). Before the session is replaced, the
  callback captures the old `auth.user.currentRelationshipId`; after the token
  exchange it calls `clearStateOnOrganisationSwitch`
  (`common/helpers/auth/organisation-switch.js`). When the previous relationship
  id exists **and differs** from the new token's `currentRelationshipId`, every
  key in `ORG_SCOPED_SESSION_KEYS` (`common/helpers/session-keys.js`) is cleared.

  **BMD-936 changed what "differs" means** (frontend PR#221 and #239, 2026-08-19/28).
  Relationship ids are GUIDs, and GUIDs are case-insensitive (RFC 4122) — **Defra ID
  emits the same `currentRelationshipId` in a different case on a `refresh_token`
  grant than on interactive sign-in**, confirmed by the drift classifier in
  `refresh-session.js` reporting `differs:case-only`. Every comparison of two
  relationship ids now goes through `canonicalRelationshipId` /
  `isSameRelationship` (`common/helpers/auth/relationship-id.js`), which trims and
  lower-cases before comparing. The same helper is mirrored in the backend
  (`src/services/defra-id/claims.js`) because the frontend forwards the raw token,
  so both ends must agree on what counts as the same relationship.

  **What this was fixing:** `hasBngCompleterRole` compared verbatim, so a single
  case flip failed the role check roughly 20 minutes into a session and signed the
  user out. The same bug class reached the org-switch check here — where a case
  flip read as a genuine switch and **wiped an in-flight upload journey** — plus
  the current-relationship resolver behind the organisation shown in the header,
  and the reselection check. A test that mints a relationship id in one case and
  asserts a switch on a case variant is now asserting deleted behaviour.
  That is all six per-upload-type `yar` keys for both types, deduped —
  `pendingUploadId`, `uploadStartedAt`, `uploadError`, `baselineValidationErrors`,
  `baselineValidationErrorsProjectId`, their `postIntervention*` counterparts, and
  the shared `validationUploadType`.

- **Why:** projects are scoped to the signed-in org (backend
  `project-visibility.js`, BMD-890 PR#207), so journey state naming the previous
  org's project would resurface as an upload-error banner or a validation-error
  list for a project the user can no longer open.
- **Deliberately not cleared:** `auth` (the switch replaces it), `oidc` (the
  callback clears its own PKCE state), `sessionEnded` (cleared by
  `clearSessionEnded`), `slidAt` (about the session, not a project).
- **On success:** Journey state dropped; user lands on `/manage-projects` showing
  the **new** org's projects
- **No-op cases:** a first sign-in (no previous relationship id), and re-signing in
  as the **same** org — e.g. after a mid-upload session expiry, where the in-flight
  journey is deliberately preserved
- **Blocked reason:** exercising the switch needs one account holding approved
  `bng completer` roles in **two** organisations. The single e2e Defra ID account
  has one, and the stub cannot mint a second relationship for an existing profile.
  Covered by frontend unit tests (`organisation-switch.test.js`,
  `session-keys.test.js`).

## Notes

- The identity provider is **Azure AD B2C** (`*.b2clogin.com`), which federates to
  **GOV.UK One Login integration** (`signin.integration.account.gov.uk`,
  `oidc.integration.account.gov.uk`). Government Gateway was dropped in BMD-1174.
  Selectors are verified against dev/test; re-confirm with a headed run if the
  hosted pages change.
- The e2e One Login account has an authenticator app set up, but One Login does
  not currently ask for a code (confirmed against test, 2026-11-17).
- The Defra ID account is matched by email, so the account kept its BNG
  completer role and projects when it moved from Government Gateway to One Login.
- Only the **completer** profile is produced via real login. The `no-role` and
  `no-projects` profiles still require the stub and stay skipped in e2e (see
  `skipInE2e` in `test/utils/env.js`).
