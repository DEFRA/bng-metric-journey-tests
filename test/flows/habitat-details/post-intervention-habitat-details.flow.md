# Post-Intervention Habitat Details User Flow (read-only view)

## Overview

A BNG Completer opens a feature from the post-intervention habitat list and views its
details. **Every post-intervention feature renders a read-only details page regardless of
its retention category** (BMD-608/723/724): area, hedgerow and watercourse features each
get a read-only page specific to their type, and individual trees render an
unsupported-feature placeholder. Retention category no longer gates _whether_ a page
renders — every supported feature reaches a read-only page. **Enhanced area habitats
(BMD-725) now render a dedicated two-section read-only page** — habitat details plus a
"Time to target / difficulty" section — reading their values from `proposed` (where the
engine writes the Enhanced derivations). **Retained area habitats now use the same
stacked label-over-value layout with a single section** — the
parcel ref is the page heading and the units row is the bordered "Habitat units
delivered" summary. Retained hedgerow and watercourse features keep the single-list
per-type page. The redesigned pages are still
read-only — there is no editable form on this route, and the
`POST /post-intervention-habitat-details` handler returns 501 Not Implemented. BMD-845
(which added the habitat-list "Intervention type" column) confirmed there are no
per-intervention-type _editable_ variations to build.

The retention category is displayed in the "Intervention" row. It is normalised for
display ("1. Retained" → "Retained"), mirroring the backend's `normaliseRetentionCategory`.
The backend (BMD-534) persists a normalised category on the feature root
(`feature.retentionCategory`); the display lifts it from there, defaulting to "Retained"
when absent.

## Steps

### Step 1 — View area habitat details (read-only) `[IMPLEMENTED]`

- **Route:** `GET /post-intervention-habitat-details?featureId={featureId}&projectId={projectId}`
- **Template:** `src/server/habitat-details/pi-habitat-details.njk` (extends `layouts/pi-view-only-sections-page.njk`)
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoints:**
  - `GET /projects/{projectId}/post-intervention/features/{featureId}` — returns `{ type, feature }` with a type discriminator (`habitat`, `tree`, `hedgerow`, `watercourse`); 404 if not found
  - `GET /projects/{projectId}` — fetches the project name for the caption **and** the baseline feature lists used to resolve the "View baseline details" link by ref; failures are swallowed (name falls back to `"Project"`, link is hidden)
- **Description:** Stacked label-over-value read-only layout. Page heading is the feature **ref** (`pageTitle` = ref, falling back to "Post-intervention habitat details"); project name is the caption. A single "Post-intervention habitat details" section with rows: Intervention, Size (hectares) (plain number, no "ha" suffix — the label names the unit), Broad habitat, Habitat type, Distinctiveness, Condition, Strategic significance (fixed "Low (1)"), then a bordered "Habitat units delivered" summary row (label left, value right). There is no Reference row — the ref moved into the heading. No dropdowns, no Save button, and no trading-rules row (dropped relative to the baseline details page). Value sourcing: descriptive values (broad habitat, habitat type, condition, encroachments) read from the feature's `baseline` sub-object falling back to `proposed` — for a retained feature the engine derives everything from the baseline side; derived scores/multipliers read from `proposed`, where the backend writes them. Distinctiveness and Condition render as "Value (score)" via `withMultiplier`. The Intervention row shows the normalised retention category, defaulting to "Retained" when absent. After the section, a "View baseline details" link to `/baseline-habitat-details?featureId={baselineFeatureId}&projectId={projectId}` — the baseline feature is matched by parcel `ref` across all baseline layers (baseline and post-intervention uploads have independent featureIds); hidden when no baseline feature shares the ref (e.g. no baseline uploaded). Back link to `/projects/{projectId}/post-intervention-habitat-list#area-habitats`.
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

- **Route:** `GET /post-intervention-habitat-details?featureId={featureId}&projectId={projectId}` (Created / Enhanced feature — see the Enhanced-area exception below)
- **Template:** The same per-type read-only templates as Steps 1–3 (`pi-habitat-details.njk` / `pi-hedgerow-details.njk` / `pi-watercourse-details.njk`) — **except an Enhanced _area_ feature, which is routed to the dedicated two-section page in Step 6**
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** Same as Step 1
- **Description:** Retention category no longer gates whether a page renders (BMD-608/723/724): a Created or Enhanced feature renders a read-only details page and its Intervention row shows its category. There is no editable dropdown form on this route. A **Created** area feature, and Enhanced (or any-category) **hedgerow/watercourse** features, still use the single-list per-type template above; only an **Enhanced area** feature diverges (Step 6). **Lost handling (backend BMD-531/534, PR #141, merged):** a Lost _area_ habitat is one whose baseline habitat was removed and replaced, so the backend maps it to Created — it still reaches this read-only page, with its Intervention row showing "Created". Lost hedgerows, watercourses and trees are truly gone: the backend excludes them at import, so they never reach this route or the habitat list. BMD-845 confirmed there are no per-intervention-type _editable_ variations to build — these read-only templates, with the correct Intervention value per category, are the final behaviour.
- **Validation:** Same as Step 1
- **On success:** Renders the read-only details page for the feature type
- **On error:** Same as Step 1

### Step 6 — View Enhanced area habitat details (read-only, two-section) `[IMPLEMENTED]`

- **Route:** `GET /post-intervention-habitat-details?featureId={featureId}&projectId={projectId}` (area feature whose normalised `retentionCategory === "Enhanced"`)
- **Template:** `src/server/habitat-details/pi-habitat-details-enhanced.njk` (extends `layouts/pi-view-only-sections-page.njk`; BMD-725)
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** Same as Step 1
- **Description:** The controller's `resolveViewOnlyPage(type, retentionCategory)` routes an area feature (type `habitat`) with a normalised retention category of `Enhanced` to a dedicated two-section stacked-field layout (bold label over value on the next line, not a `govukSummaryList`). Page heading is the feature **ref** (`pageTitle` = ref, falling back to "Post-intervention habitat details"); project name is the caption.
  - **Section 1 — "Post-intervention habitat details":** Intervention, Area (hectares), Broad habitat, Habitat type, Distinctiveness ("value (score)" via `withMultiplier`), Condition ("value (score)"), Strategic significance (fixed "Low (1)"). The "View baseline details" link renders **after this first section** — to `/baseline-habitat-details?featureId={baselineFeatureId}&projectId={projectId}`, resolved by matching the parcel `ref` across baseline layers; hidden when no baseline feature shares the ref.
  - **Section 2 — "Time to target / difficulty":** Target condition ("value (score)"), Standard time to target condition (formatted "Baseline condition to target condition - N years"), Standard difficulty, Advance or delay?, Final time to target condition, Applied difficulty multiplier.
  - **Then** a bordered "Habitat units delivered" summary row (label left, value right).
  - **Value sourcing differs from the retained area page (Step 1):** every descriptive and derived value reads from `proposed` (where the backend writes the Enhanced derivations), not baseline-first. Back link to `/projects/{projectId}/post-intervention-habitat-list#area-habitats`.
- **Validation:** Same as Step 1 (`featureId`/`projectId` required UUIDs → 400; BNG Completer role → `/auth/forbidden`; unauthenticated → sign-in; feature not found → 404)
- **On success:** Renders the Enhanced two-section read-only area details page
- **On error:** 400 for invalid/missing query params; 404 if feature does not exist

### Step 7 — Save is not implemented (read-only route) `[IMPLEMENTED]`

- **Route:** `POST /post-intervention-habitat-details`
- **Template:** None
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** None — no page posts to this route.
- **Description:** Every post-intervention details page is read-only (BMD-608/723/724), so nothing renders a form that submits here. The route stays registered and its handler returns **501 Not Implemented** (`Boom.notImplemented`) so a stale page or client gets an explicit "not implemented" response rather than a 404. The previous editable-form save (which called `PUT /projects/{projectId}/post-intervention/habitats/{featureId}`) has been removed from this route.
- **Validation:** The GET route still validates `featureId` / `projectId` as required UUIDs; the POST handler takes no payload.
- **On success:** N/A — the handler always returns 501.
- **On error:** 501 Not Implemented.
