# View Post-Intervention User Flow

## Overview

A BNG Completer opens a feature from the post-intervention habitat list and views its
details. Retained features — and features with no retention category, which are treated
as retained — render a read-only details page specific to their feature type (area,
hedgerow, watercourse). Individual trees render an unsupported-feature placeholder.
Created, Enhanced and Lost features fall through to the shared editable details form,
documented canonically in [`habitat-details.flow.md`](habitat-details.flow.md) — this doc
covers only what differs on the post-intervention route.

Retention is normalised before comparison ("1. Retained" → "Retained"), mirroring the
backend's `normaliseRetentionCategory`, because the backend never writes the normalised
value back to the project document.

## Steps

### Step 1 — View retained area habitat details (read-only) `[IMPLEMENTED]`

- **Route:** `GET /post-intervention-habitat-details?featureId={featureId}&projectId={projectId}`
- **Template:** `src/server/habitat-details/pi-habitat-details.njk` (extends `layouts/pi-view-only-page.njk`; BMD-608)
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoints:**
  - `GET /projects/{projectId}/post-intervention/features/{featureId}` — returns `{ type, feature }` with a type discriminator (`habitat`, `tree`, `hedgerow`, `watercourse`); 404 if not found
  - `GET /projects/{projectId}` — fetches the project name for the caption **and** the baseline feature lists used to resolve the "View baseline details" link by ref; failures are swallowed (name falls back to `"Project"`, link is hidden)
- **Description:** Read-only `govukSummaryList` rows: Reference, Intervention, Area (hectares), Broad habitat, Habitat type, Distinctiveness, Condition, Strategic Significance (fixed "Low (1)"), Units in this habitat. No dropdowns, no Save button, and no trading-rules row (dropped relative to the baseline details page). Value sourcing: descriptive values (broad habitat, habitat type, condition, encroachments) read from the feature's `baseline` sub-object falling back to `proposed` — for a retained feature the engine derives everything from the baseline side; derived scores/multipliers read from `proposed`, where the backend writes them. Distinctiveness and Condition render as "Value (score)" via `withMultiplier`. The Intervention row shows the normalised retention category, defaulting to "Retained" when absent. Below the list, a "View baseline details" link to `/baseline-habitat-details?featureId={baselineFeatureId}&projectId={projectId}` — the baseline feature is matched by parcel `ref` across all baseline layers (baseline and post-intervention uploads have independent featureIds); hidden when no baseline feature shares the ref (e.g. no baseline uploaded). Back link to `/projects/{projectId}/post-intervention-habitat-list#area-habitats`.
- **Validation:**
  - `featureId` required, valid UUID → 400 if missing or invalid
  - `projectId` required, valid UUID → 400 if missing or invalid
  - BNG Completer role required → redirects to `/auth/forbidden` if missing
  - Unauthenticated → redirects to sign-in
  - Feature not found → 404
- **On success:** Renders the read-only area details page
- **On error:** 400 for invalid/missing query params; 404 if feature does not exist

### Step 2 — View retained hedgerow details (read-only) `[IMPLEMENTED]`

- **Route:** `GET /post-intervention-habitat-details?featureId={featureId}&projectId={projectId}` (hedgerow feature)
- **Template:** `src/server/habitat-details/pi-hedgerow-details.njk` (extends `layouts/pi-view-only-page.njk`; BMD-723)
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** Same as Step 1
- **Description:** Same shared chrome and value sourcing as Step 1. Rows: Reference, Intervention, Length (km), Habitat type, Distinctiveness, Condition, Strategic Significance, Units in this habitat — no Broad habitat row (hedgerows have no broad-habitat dimension). Back link anchors to `#hedgerows`.
- **Validation:** Same as Step 1
- **On success:** Renders the read-only hedgerow details page
- **On error:** Same as Step 1

### Step 3 — View retained watercourse details (read-only) `[IMPLEMENTED]`

- **Route:** `GET /post-intervention-habitat-details?featureId={featureId}&projectId={projectId}` (watercourse feature)
- **Template:** `src/server/habitat-details/pi-watercourse-details.njk` (extends `layouts/pi-view-only-page.njk`; BMD-724)
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** Same as Step 1
- **Description:** Same shared chrome and value sourcing as Step 1. Rows: Reference, Intervention, Length (km), Habitat type, Distinctiveness, Condition, **Watercourse encroachment**, **Riparian encroachment**, Strategic Significance, Units in this habitat. Encroachment _values_ come from the baseline side (falling back to proposed) — the engine's multipliers on `proposed` are derived from the baseline encroachments — and render as "Value (multiplier)" via `withMultiplier` using `proposed.waterEncroachmentMultiplier` / `proposed.riparianEncroachmentMultiplier`. Back link anchors to `#watercourses`.
- **Validation:** Same as Step 1
- **On success:** Renders the read-only watercourse details page
- **On error:** Same as Step 1

### Step 4 — Unsupported feature placeholder (individual trees) `[IMPLEMENTED]`

- **Route:** `GET /post-intervention-habitat-details?featureId={featureId}&projectId={projectId}` (tree feature)
- **Template:** `src/server/habitat-details/pi-feature-unsupported.njk`
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** Same as Step 1
- **Description:** Individual trees (and IGGIs, if ever reachable) have no details page yet. Renders the "Post-intervention habitat details" heading with the message "Individual tree and IGGI features are not yet supported in this view." Back link to `/projects/{projectId}/post-intervention-habitat-list#area-habitats`.
- **Validation:** Same as Step 1
- **On success:** Renders the placeholder page
- **On error:** Same as Step 1

### Step 5 — Non-retained feature falls through to the editable form `[IMPLEMENTED]`

- **Route:** `GET /post-intervention-habitat-details?featureId={featureId}&projectId={projectId}` (Created / Enhanced / Lost feature of any supported type)
- **Template:** `src/server/habitat-details/habitat-details.njk` (shared editable template via `createHabitatDetailsControllers`)
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** Same as Step 1, plus the per-type reference-data endpoints documented in [`habitat-details.flow.md`](habitat-details.flow.md) Step 1
- **Description:** Features whose normalised `baseline.retentionCategory` is anything other than "Retained" (Created, Enhanced, Lost) keep the editable dropdown form. The post-intervention feature is flattened for display (`proposed.*` promoted to top level). Differences from the baseline form: section heading "Post-intervention Details", form action `/post-intervention-habitat-details`, and back/cancel links rewritten to `/projects/{projectId}/post-intervention-habitat-list`. All field, strategy and client-side dropdown behaviour is as documented in `habitat-details.flow.md` — do not duplicate it here.
- **Validation:** Same as Step 1
- **On success:** Renders the editable habitat details form
- **On error:** Same as Step 1

### Step 6 — Save post-intervention habitat details `[IMPLEMENTED]`

- **Route:** `POST /post-intervention-habitat-details`
- **Template:** None (redirect only)
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** `PUT /projects/{projectId}/post-intervention/habitats/{featureId}` — persists broadType / habitatType / condition on the `postIntervention` document, recomputes derived values and units totals under a row lock (5 s timeout), and returns the updated feature. **Area habitats only** (`expectedType: 'habitat'`): a hedgerow or watercourse featureId → 404, surfaced as 502 by the frontend.
- **Description:** Submits the editable form from Step 5. The backend returns the bare feature document (no `type` wrapper), so the redirect anchor is always the area-habitat form `#habitat-{featureId}`.
- **Validation (payload):**
  - `projectId` required UUID; `featureId` required UUID
  - `broadHabitat` / `habitatType` / `condition` optional strings, empty allowed (coerced to null)
  - `watercourseEncroachment` / `riparianEncroachment` optional strings, empty allowed (only submitted by the watercourse form; **not persisted** — the PI save endpoint ignores them)
  - `crumb` optional (CSRF token)
- **On success:** Redirects to `/projects/{projectId}/post-intervention-habitat-list#habitat-{featureId}`
- **On error:** Backend 4xx/5xx → 502 Bad Gateway; backend 409 (lock timeout on concurrent edit) → 409 Conflict
