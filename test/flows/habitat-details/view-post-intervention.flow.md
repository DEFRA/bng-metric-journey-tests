# View Post-Intervention User Flow

## Overview

A BNG Completer opens a feature from the post-intervention habitat list and views its
details. **Every post-intervention feature renders a read-only details page regardless of
its retention category** (BMD-608/723/724): area, hedgerow and watercourse features each
get a read-only page specific to their type, and individual trees render an
unsupported-feature placeholder. Retention category no longer gates the page — a Created
or Enhanced feature gets the same read-only page as a Retained one. BMD-845 (which added
the habitat-list "Intervention type" column) confirmed there are no per-intervention-type
editable variations to build — Retained/Enhanced/Created features of a given type render
the same read-only template, differing only in the "Intervention" row's value. There is no
editable form on this route: the `POST /post-intervention-habitat-details` handler now
returns 501 Not Implemented.

The retention category is displayed in the "Intervention" row. It is normalised for
display ("1. Retained" → "Retained"), mirroring the backend's `normaliseRetentionCategory`.
The backend (BMD-534) persists a normalised category on the feature root
(`feature.retentionCategory`); the display lifts it from there, defaulting to "Retained"
when absent.

## Steps

### Step 1 — View area habitat details (read-only) `[IMPLEMENTED]`

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

### Step 2 — View hedgerow details (read-only) `[IMPLEMENTED]`

- **Route:** `GET /post-intervention-habitat-details?featureId={featureId}&projectId={projectId}` (hedgerow feature)
- **Template:** `src/server/habitat-details/pi-hedgerow-details.njk` (extends `layouts/pi-view-only-page.njk`; BMD-723)
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** Same as Step 1
- **Description:** Same shared chrome and value sourcing as Step 1. Rows: Reference, Intervention, Length (km), Habitat type, Distinctiveness, Condition, Strategic Significance, Units in this habitat — no Broad habitat row (hedgerows have no broad-habitat dimension). Back link anchors to `#hedgerows`.
- **Validation:** Same as Step 1
- **On success:** Renders the read-only hedgerow details page
- **On error:** Same as Step 1

### Step 3 — View watercourse details (read-only) `[IMPLEMENTED]`

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

### Step 5 — Non-retained features are read-only too `[IMPLEMENTED]`

- **Route:** `GET /post-intervention-habitat-details?featureId={featureId}&projectId={projectId}` (Created / Enhanced feature of any supported type)
- **Template:** The same per-type read-only templates as Steps 1–3 (`pi-habitat-details.njk` / `pi-hedgerow-details.njk` / `pi-watercourse-details.njk`)
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** Same as Step 1
- **Description:** Retention category no longer gates the page (BMD-608/723/724): a Created or Enhanced feature renders the same read-only details page as a Retained one, and its Intervention row shows its category. There is no editable dropdown form on this route. **Lost handling (backend BMD-531/534, PR #141, merged):** a Lost _area_ habitat is one whose baseline habitat was removed and replaced, so the backend maps it to Created — it still reaches this read-only page, with its Intervention row showing "Created". Lost hedgerows, watercourses and trees are truly gone: the backend excludes them at import, so they never reach this route or the habitat list. BMD-845 confirmed there are no per-intervention-type editable variations to build — this shared read-only template, with the correct Intervention value per category, is the final behaviour.
- **Validation:** Same as Step 1
- **On success:** Renders the read-only details page for the feature type
- **On error:** Same as Step 1

### Step 6 — Save is not implemented (read-only route) `[IMPLEMENTED]`

- **Route:** `POST /post-intervention-habitat-details`
- **Template:** None
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** None — no page posts to this route.
- **Description:** Every post-intervention details page is read-only (BMD-608/723/724), so nothing renders a form that submits here. The route stays registered and its handler returns **501 Not Implemented** (`Boom.notImplemented`) so a stale page or client gets an explicit "not implemented" response rather than a 404. The previous editable-form save (which called `PUT /projects/{projectId}/post-intervention/habitats/{featureId}`) has been removed from this route.
- **Validation:** The GET route still validates `featureId` / `projectId` as required UUIDs; the POST handler takes no payload.
- **On success:** N/A — the handler always returns 501.
- **On error:** 501 Not Implemented.
