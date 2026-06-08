# Defra ID Login User Flow

## Overview

In e2e mode (deployed dev/test) the suite signs in through the **real Defra ID /
Government Gateway** journey instead of the `cdp-defra-id-stub`. A user clicks
"Sign in" on the home page and authenticates with a Government Gateway user ID
and password, landing on the project dashboard. Used by
`test/setup/auth.setup.js` to mint the completer `storageState` in e2e; local and
github runs continue to use the stub.

## Steps

### Step 1 — Start sign-in `[IMPLEMENTED]`

- **Route:** `GET /auth/login` → redirect to the Defra ID authorize endpoint
- **Auth required:** No (initiates authentication)
- **Description:** The home "Sign in" button links to `/auth/login`; the frontend
  begins the OIDC authorization code flow and redirects to Defra ID.

### Step 2 — Choose Government Gateway `[IMPLEMENTED]`

- **Page:** Defra ID (external, not in this repo's source)
- **Description:** Select "Sign in with Government Gateway", then click "Continue".

### Step 3 — Enter credentials `[IMPLEMENTED]`

- **Page:** Government Gateway (external)
- **Description:** Enter the Government Gateway user ID and password, then click
  "Sign in".
- **Credentials:** from `DEFRA_ID_USERNAME` / `DEFRA_ID_PASSWORD`.

### Step 4 — Return to service `[IMPLEMENTED]`

- **Route:** `GET /auth/callback` → redirect to `/manage-projects`
- **Description:** Defra ID redirects back with an auth code; the frontend
  exchanges it for a session and lands on the project dashboard.

## Notes

- The identity provider is **Azure AD B2C** (`*.b2clogin.com`), which federates to
  **Government Gateway** (`*.access.service.gov.uk`). Selectors are verified against
  dev; re-confirm with a headed run if the hosted pages change.
- The test account has **no MFA** step (confirmed against dev).
- Only the **completer** profile is produced via real login. The `no-role` and
  `no-projects` profiles still require the stub and stay skipped in e2e (see
  `skipInE2e` in `test/utils/env.js`).
