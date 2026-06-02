# Baseline Habitat Details User Flow

## Overview

A BNG Completer views and edits the dropdown fields (Broad habitat, Habitat type,
Condition) for a single area habitat. On save the backend recomputes derived values
(distinctiveness, condition score, habitat units, status) and the user is returned
to the habitat list anchored to the edited row.

## Steps

### Step 1 — View habitat details `[IMPLEMENTED]`

- **Route:** `GET /baseline-habitat-details`
- **Template:** `src/server/baseline-habitat-details/baseline-habitat-details.njk`
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoints:**
  - `GET /projects/{projectId}/features/{featureId}` — fetches the specific feature record; 404 if not found
  - `GET /reference/habitat-types-by-broad` — fetches all habitat types grouped by broad habitat (cached in-process after first load)
  - `GET /reference/trading-rules` — fetches trading rules by distinctiveness band (cached in-process after first load)
  - `GET /reference/conditions?habitatType={broadType} - {type}` — fetches condition options for the current habitat type (only when both broadType and type are set)
- **Description:** Renders a summary list in a two-column layout. Read-only rows: Reference, Area (ha), Distinctiveness (updated by client JS on dropdown change), Strategic Significance (fixed "Low (1)"), Trading rules (updated by client JS), Habitat units. Editable rows: Broad habitat (select), Habitat type (select, filtered client-side by broad habitat selection), Condition (select, options loaded from reference endpoint). A JSON script tag (`#bhd-reference-data`) embeds all static reference data for client-side JS. Back link navigates to `/projects/{projectId}/habitat-list`. Cancel link navigates to `/projects/{projectId}/habitat-list#habitat-{featureId}`.
- **Validation (query params):**
  - `featureId` required, must be a valid UUID → 400 if missing or invalid
  - `projectId` required, must be a valid UUID → 400 if missing or invalid
  - BNG Completer role required → redirects to `/auth/forbidden` if missing
  - Unauthenticated → redirects to sign-in
  - Habitat not found → 404
- **On success:** Renders the habitat details form
- **On error:** 400 for invalid/missing query params; 404 if habitat does not exist

---

### Step 2 — Save habitat details `[IMPLEMENTED]`

- **Route:** `POST /baseline-habitat-details`
- **Template:** None (redirect only)
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** `PUT /projects/{projectId}/habitats/{featureId}` — persists broadType / habitatType / condition; backend recomputes distinctiveness, condition score, habitat units, and Complete/Incomplete status; uses row-level locking with a 5 s timeout
- **Description:** Submits the dropdown selections. Empty string values are coerced to null by the backend. The backend recomputes all derived fields atomically and returns the updated habitat.
- **Validation (payload):**
  - `projectId` required UUID
  - `featureId` required UUID
  - `broadHabitat` optional string, allow empty string
  - `habitatType` optional string, allow empty string
  - `condition` optional string, allow empty string
  - `crumb` optional (CSRF token injected by `appForm` macro)
- **On success:** Redirects to `/projects/{projectId}/habitat-list#habitat-{featureId}`
- **On error:** Backend returns 4xx or 5xx → 502 Bad Gateway; backend 409 (lock timeout from concurrent edit) → 502 Bad Gateway

---

### Step 3 — Fetch condition options (client-side proxy) `[IMPLEMENTED]`

- **Route:** `GET /api/reference/conditions`
- **Template:** None (JSON response)
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** `GET /reference/conditions?habitatType={habitatType}` — returns condition options for a given habitat type
- **Description:** Thin frontend proxy consumed by client-side JS when the user changes the Habitat type dropdown. Refreshes the Condition select options without a full page reload. The `habitatType` query param is the combined `"Broad - Type"` string (e.g. `"Grassland - Modified grassland"`).
- **Validation (query params):**
  - `habitatType` required, min length 1 → 400 if missing or empty
  - BNG Completer role required → redirects to `/auth/forbidden` if missing
- **On success:** Returns JSON array of condition objects from the backend
- **On error:** Backend returns 4xx or 5xx → 502 Bad Gateway
