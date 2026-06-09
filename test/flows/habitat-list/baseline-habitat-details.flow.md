# Baseline Habitat Details User Flow

## Overview

A BNG Completer views and edits the classification details (habitat type, condition, and —
for area habitats only — broad habitat) for a single baseline feature. The page dispatches
to a per-type strategy ('habitat' or 'hedgerow') that controls which rows render and which
reference data is fetched. On save the user is returned to the correct tab on the habitat list.

## Steps

### Step 1 — View baseline habitat details `[IMPLEMENTED]`

- **Route:** `GET /baseline-habitat-details`
- **Template:** `src/server/baseline-habitat-details/baseline-habitat-details.njk`
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoints:**
  - `GET /projects/{projectId}/features/{featureId}` — returns `{ type, feature }` where `type` is `'habitat'` or `'hedgerow'`; `type` drives strategy dispatch
  - `GET /projects/{projectId}` — fetches project name (used in page caption)
  - Area habitats only (process-level cache): `GET /reference/habitat-types-by-broad` + `GET /reference/trading-rules`
  - Hedgerows only (process-level cache): `GET /reference/hedgerow-types` + `GET /reference/trading-rules`
  - Per-request (uncached): `GET /reference/conditions?habitatType={...}[&featureType=hedgerow]`
- **Description:** Renders a `govukSummaryList` with rows: Reference (read-only), size (read-only), Broad habitat (dropdown — **area only**, hidden for hedgerows), Habitat type (dropdown), Distinctiveness (derived, read-only — updated client-side), Condition (dropdown — options refreshed via `/api/reference/conditions` on type change), Strategic Significance (fixed "Low (1)" for MVS), Trading rules (derived, read-only — updated client-side), Habitat units (read-only). Includes Save button and Cancel link.
- **Type-specific behaviour:**
  - `type === 'habitat'`: heading prefix "Habitat", size label "Area (hectares)", Broad habitat row shown, back/cancel href → `/projects/{projectId}/baseline-habitat-list#habitat-{featureId}`
  - `type === 'hedgerow'`: heading prefix "Hedgerow", size label "Length (km)", Broad habitat row hidden, back/cancel href → `/projects/{projectId}/baseline-habitat-list#hedgerows`
- **Validation:**
  - `featureId`: required, UUID format → 400 if missing or invalid
  - `projectId`: required, UUID format → 400 if missing or invalid
  - BNG Completer role required → redirects to `/auth/forbidden` if missing
  - Unauthenticated → redirects to sign-in
- **On success:** Renders the habitat details form
- **On error:** 400 for missing/non-UUID query params; 404 if feature not found

### Step 2 — Save baseline habitat details `[IMPLEMENTED]`

- **Route:** `POST /baseline-habitat-details`
- **Template:** N/A (redirect on success)
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** `PUT /projects/{projectId}/features/{featureId}` — payload `{ broadType, habitatType, condition }` (null where blank); response `{ type, feature }`
- **Description:** Saves dropdown selections. The `type` in the backend response determines the redirect anchor.
- **Validation:**
  - `projectId`: required, UUID format
  - `featureId`: required, UUID format
  - `broadHabitat`, `habitatType`, `condition`: optional, string (allow empty)
- **On success:** Redirects to `/projects/{projectId}/baseline-habitat-list` with anchor:
  - `#hedgerows` if `response.type === 'hedgerow'`
  - `#watercourses` if `response.type === 'watercourse'` (anchor wired up; watercourse strategy not yet registered — `[PLANNED]`)
  - `#habitat-{featureId}` otherwise (area habitats and fallback)
- **On error:**
  - 409 if backend returns 409 (concurrent row-lock conflict)
  - 502 if backend call fails for other reasons

### Step 3 — Fetch conditions for habitat type `[IMPLEMENTED]`

- **Route:** `GET /api/reference/conditions`
- **Template:** N/A (JSON proxy response)
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** `GET /reference/conditions?habitatType={...}[&featureType={...}]`
- **Description:** Thin proxy used by client-side JS to refresh the Condition dropdown when the user changes the Habitat type selection. Re-encodes and forwards query params; returns the backend's conditions JSON array directly.
- **Validation:**
  - `habitatType`: required, minimum 1 character
  - `featureType`: optional; valid values `'habitat'` or `'hedgerow'`
- **On success:** Returns the backend's conditions array
- **On error:** 502 if the backend returns status ≥ 400
