# Post-Intervention Habitat Details User Flow (read-only view)

## Overview

A BNG Completer opens a feature from the post-intervention habitat list and views its
details. **Every post-intervention feature renders a read-only page** — area, hedgerow and
watercourse features each get a page specific to their type _and_ their intervention
(retention) category; individual trees render an unsupported-feature placeholder. There is
no editable form on this route: `POST /post-intervention-habitat-details` returns
**501 Not Implemented**.

**Layout: the stacked "sections" design is now the norm.** Seven of the eight rendered
pages extend `layouts/pi-view-only-sections-page.njk` (bold label on one line, value on the
next; no `govukSummaryList` rows; a bordered "Habitat units delivered" summary row at the
bottom; the parcel **ref** as the H1). The **retained hedgerow** page is the only one still
on the older `layouts/pi-view-only-page.njk` `govukSummaryList` design, with the generic
"Post-intervention habitat details" H1 and a "Units in this habitat" row.

### Page routing

The controller calls `resolveViewOnlyPage(type, retentionCategory)`, where `type` is the
backend's discriminator (`habitat`, `tree`, `hedgerow`, `watercourse`) and
`retentionCategory` is `normaliseRetentionCategory(feature.retentionCategory)` — a leading
`"N. "` list prefix and surrounding whitespace are stripped ("1. Enhanced" → "Enhanced"),
`null` when there is no usable value.

| Feature type            | `Enhanced`                         | `Created`                                        | anything else (incl. `Retained`, unrecognised, absent) |
| ----------------------- | ---------------------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| `habitat`               | `pi-habitat-details-enhanced`      | `pi-habitat-details-created`                     | `pi-habitat-details` (Step 1)                          |
| `hedgerow`              | `pi-hedgerow-details-enhanced`     | `pi-hedgerow-details-enhanced` (different model) | `pi-hedgerow-details` (Step 2)                         |
| `watercourse`           | `pi-watercourse-details-enhanced`  | `pi-watercourse-details-created`                 | `pi-watercourse-details` (Step 3)                      |
| `tree` / any other type | `pi-feature-unsupported` (Step 10) | —                                                | —                                                      |

A category the map does not know (the backend only persists `Retained`/`Created`/`Enhanced`,
so this is defensive) falls through to the retained page for its type, with the Intervention
row showing the raw normalised value.

### Value sourcing

- **`proposed`-first is the norm.** `buildSharedPiViewOnlyFields` reads distinctiveness,
  condition and their scores from `feature.proposed`; the sections pages additionally read
  `proposed.broadType` / `proposed.type` and every time/difficulty derivation from
  `proposed`. This covers the retained area page, the retained hedgerow page and all six
  Created/Enhanced pages.
- **The retained watercourse page (Step 3) is the sole exception** — it still uses
  `buildViewOnlyViewModel`, whose `retained(key)` helper reads `baseline[key] ?? proposed[key] ?? ''`
  for descriptive values (habitat type, condition, both encroachments) while taking scores
  and multipliers from `proposed`. For a retained watercourse the engine derives its
  multipliers from the baseline encroachments, so reading value and multiplier from
  different sides would pair a value with a multiplier not computed from it.
- **A `proposed`-read still shows baseline-derived values for a Retained feature** — the
  _backend_ does the fallback, not the frontend. At import,
  `copyRetainedProposedFromBaseline` (backend `utilities/baseline/`) copies the baseline
  identity fields onto `proposed` whenever a Retained feature's proposed identity side is
  entirely empty: `type`/`broadType`/`condition`/`strategicSignificance` for areas,
  `type`/`condition` for hedgerows, plus both encroachments for watercourses. So a fixture
  with blank Proposed GPKG columns still renders its baseline values on the retained pages.
  This is why moving the retained area page to a `proposed`-only read (BMD-608) was not a
  visible behaviour change — but it does mean the two layers must be considered together
  when reasoning about a blank row.
- Distinctiveness and Condition render as `"Value (score)"` via `withMultiplier`; a missing
  score yields the bare value, a missing value yields an empty cell.
- Strategic significance is the fixed string `"Low (1)"` on every page (MVS).
- "Habitat units delivered" / "Units in this habitat" is `formatHabitatUnits(feature.units)`
  — 2 decimal places, capped at 7 significant figures.

The **Intervention** row shows the normalised retention category, defaulting to
`"Retained"` when the feature carries none (`interventionDisplay`).

### "View baseline details" link

Resolved by matching the parcel `ref` across every baseline layer (habitats, trees,
hedgerows, watercourses) — baseline and post-intervention are independent uploads with
independent `featureId`s, so `ref` is the only stable join key. Hidden when no baseline
feature shares the ref (e.g. no baseline uploaded). On a sections page the link renders
**after the first section**, before the units row. **Created hedgerows suppress the link
unconditionally** (`buildCreatedHedgerowViewOnlyViewModel` forces `baselineFeatureId: null`)
— Created areas and Created watercourses do **not**, and still resolve it by ref.

### Shared route contract

Every GET step below shares this contract, so it is stated once rather than repeated:

- **Route:** `GET /post-intervention-habitat-details?featureId={featureId}&projectId={projectId}`
- **Auth required:** Yes (session + approved BNG Completer role)
- **Backend endpoints:**
  - `GET /projects/{projectId}/post-intervention/features/{featureId}` — returns
    `{ type, feature }` with `type` in `habitat | tree | hedgerow | watercourse`; 404 if the
    project or feature is not found (mapped to `Boom.notFound` by the frontend)
  - `GET /projects/{projectId}` — supplies the project name for the caption **and** the
    baseline feature lists used to resolve the "View baseline details" link. Failures are
    swallowed: the caption falls back to `"Project"` and the link is hidden
- **Validation:** `featureId` and `projectId` are both required UUIDs → **400** if missing
  or malformed; BNG Completer role required → redirect to `/auth/forbidden`;
  unauthenticated → redirect to sign-in; feature not found → **404**
- **On error:** 400 for invalid/missing query params; 404 if the feature does not exist

## Steps

### Step 1 — View retained area habitat details (read-only) `[IMPLEMENTED]`

- **Route:** shared GET contract (area feature; retention category not `Enhanced`/`Created`)
- **Template:** `src/server/habitat-details/pi-habitat-details.njk` (extends `layouts/pi-view-only-sections-page.njk`; BMD-608, frontend PR#191)
- **Backend endpoint:** shared GET contract
- **Description:** Single-section stacked page. H1 is the parcel **ref** (`pageTitle` falls
  back to "Post-intervention habitat details" when the feature has no ref); the project name
  is the caption; the section heading is "Post-intervention habitat details". Rows, in
  order: **Intervention**, **Size (hectares)**, **Broad habitat**, **Habitat type**,
  **Distinctiveness**, **Condition**, **Strategic significance**. Then the "View baseline
  details" link, then the bordered **"Habitat units delivered"** row. There is **no
  Reference row** (the ref is the H1), **no "Units in this habitat" row** (replaced by the
  units summary row) and no trading-rules row. Size uses `formatAreaHectaresValue`
  (10 significant figures, **no `ha` suffix** — the label carries the unit). Broad habitat
  and habitat type read `proposed.broadType` / `proposed.type`. Back link to
  `/projects/{projectId}/post-intervention-habitat-list#area-habitats`.
- **Validation:** shared GET contract
- **On success:** Renders the read-only stacked area details page
- **On error:** shared GET contract

---

### Step 2 — View retained hedgerow details (read-only, summary list) `[IMPLEMENTED]`

- **Route:** shared GET contract (hedgerow feature; retention category not `Enhanced`/`Created`)
- **Template:** `src/server/habitat-details/pi-hedgerow-details.njk` (extends `layouts/pi-view-only-page.njk`; BMD-723)
- **Backend endpoint:** shared GET contract
- **Description:** **The only remaining `govukSummaryList` page.** H1 is the generic
  "Post-intervention habitat details" (not the ref); the project name is the caption. Rows:
  **Reference**, **Intervention**, **Length (km)**, **Habitat type**, **Distinctiveness**,
  **Condition**, **Strategic Significance**, **Units in this habitat**. Below the list, the
  "View baseline details" link. There is no "Habitat units delivered" summary row and no
  Broad habitat row (hedgerows have no broad-habitat dimension). Length uses `formatLengthKm`
  (7 significant figures, **no `km` suffix** — the label carries the unit). All values
  including habitat type come from `proposed`. Back link anchors to `#hedgerows`.
- **Validation:** shared GET contract
- **On success:** Renders the read-only hedgerow summary-list page
- **On error:** shared GET contract

---

### Step 3 — View retained watercourse details (read-only) `[IMPLEMENTED]`

- **Route:** shared GET contract (watercourse feature; retention category not `Enhanced`/`Created`)
- **Template:** `src/server/habitat-details/pi-watercourse-details.njk` (extends `layouts/pi-view-only-sections-page.njk`; BMD-724, frontend PR#192)
- **Backend endpoint:** shared GET contract
- **Description:** Single-section stacked page, same chrome as Step 1. H1 is the parcel
  **ref**. Rows: **Intervention**, **Size (kilometres)**, **Habitat type**,
  **Distinctiveness**, **Condition**, **Watercourse encroachment**, **Riparian
  encroachment**, **Strategic significance**. Then the "View baseline details" link, then
  the bordered "Habitat units delivered" row. Size uses `formatLengthKm` (no `km` suffix).
  **This is the one page that still sources descriptive values baseline-first** (see
  _Value sourcing_): habitat type, condition and both encroachment values read
  `baseline.* ?? proposed.* ?? ''`, paired with `proposed.conditionScore`,
  `proposed.waterEncroachmentMultiplier` and `proposed.riparianEncroachmentMultiplier`.
  Back link anchors to `#watercourses`.
- **Validation:** shared GET contract
- **On success:** Renders the read-only stacked watercourse details page
- **On error:** shared GET contract

---

### Step 4 — View Created area habitat details (read-only, two-section) `[IMPLEMENTED]`

- **Route:** shared GET contract (area feature whose normalised `retentionCategory === "Created"`)
- **Template:** `src/server/habitat-details/pi-habitat-details-created.njk` (extends `layouts/pi-view-only-sections-page.njk`; BMD-736, frontend PR#180)
- **Backend endpoint:** shared GET contract
- **Description:** Two-section stacked page, H1 = parcel ref, caption = project name.
  - **Section 1 — "Post-intervention habitat details":** Intervention, **Area**, Broad
    habitat, Habitat type, Distinctiveness, Condition, Strategic significance. Note the
    label is `Area` (not "Area (hectares)") and the value carries its own **`ha` suffix**
    via `formatAreaHectares` — the opposite convention to the retained area page in Step 1.
  - **"View baseline details"** link renders here, after the first section.
  - **Section 2 — "Time to target / difficulty":** Target condition, Standard time to
    target condition, Standard difficulty, Advance or delay?, Final time to target
    condition, Applied difficulty multiplier.
  - Then the bordered **"Habitat units delivered"** row.
  - **Standard time to target condition** (`formatStandardTimeToTarget`,
    `post-intervention-habitat-details/view-only-shared.js`) renders the condition
    _transition_ `"<baseline condition> to <proposed condition> - N years"` (frontend
    PR#193), with any `"N. "` prefix stripped from both conditions. **Frontend PR#211
    (2026-08-12) changed the missing-baseline case:** when the baseline condition is absent
    or empty the row now renders the target alone — `"<proposed condition> - N years"` — in
    place of the previous empty string. It renders **empty** only when the **target
    condition** or the **year count** is missing.

    **Frontend PR#206 (BMD-706, 2026-08-13) widened "absent":** the GeoPackage sentinels
    `"N/A"` and any `"N/A - …"` value count as _no_ baseline condition, so they take the
    short form too rather than reading `"N/A - Other to Good - 5 years"`. Natural England
    files commonly populate a created parcel's baseline condition with those sentinels
    instead of leaving the column blank, so this is the branch most real uploads hit.

    This matters most on the Created pages (Steps 4, 7, 8): a created feature has no
    baseline counterpart, so `feature.baseline.condition` is typically absent and this row
    is exactly the short form. A test asserting an empty cell for a Created feature with a
    target condition and year count is now wrong.

    Coverage note: a **Lost**-sourced Created parcel keeps its baseline condition and so
    takes the _transition_ branch — which is why the two-week PR#193 regression (row blank
    on every genuinely created feature, BMD-736) passed the suite unnoticed. Reaching the
    created branch needs a parcel whose Retention Category is literally `Created`. Two
    fixtures do it, one per absent-baseline flavour:

    - **Cleared columns** — `Post-intervention - created area habitat.gpkg` (H2-7,
      `Good - 5 years`), generated by `test/example-files/fixture-mutations.py`, covers the
      Created **area** page (Step 4).
    - **`N/A` sentinels** — `Post-intervention - created linear features.gpkg` (HG005,
      HG010, HG013, HG018, all `Baseline Condition = "N/A"`) covers the Created
      **hedgerow** page (Step 7) via HG013, `Good - 20 years` (BMD-737). This is the branch
      real Natural England uploads hit.

  - **Target condition and Condition render the identical string** — both are
    `withMultiplier(stripConditionPrefix(proposed.condition), proposed.conditionScore)`.
  - Every value on this page reads from `proposed`.
  - Back link to `/projects/{projectId}/post-intervention-habitat-list#area-habitats`.
- **Validation:** shared GET contract
- **On success:** Renders the Created two-section read-only area details page
- **On error:** shared GET contract

---

### Step 5 — View Enhanced area habitat details (read-only, two-section) `[IMPLEMENTED]`

- **Route:** shared GET contract (area feature whose normalised `retentionCategory === "Enhanced"`)
- **Template:** `src/server/habitat-details/pi-habitat-details-enhanced.njk` (extends `layouts/pi-view-only-sections-page.njk`; BMD-725, frontend PR#170)
- **Backend endpoint:** shared GET contract
- **Description:** **Identical in every respect to Step 4** — the two templates set the same
  `sections` structure and both view models delegate to
  `buildAreaSectionsViewOnlyFields`. They differ only in the Intervention row value
  ("Enhanced" vs "Created") and in the template file selected. Same row labels (including
  `Area` with the `ha` suffix), same time/difficulty section, same baseline-link placement,
  same `proposed`-only sourcing.
- **Validation:** shared GET contract
- **On success:** Renders the Enhanced two-section read-only area details page
- **On error:** shared GET contract

---

### Step 6 — View Enhanced hedgerow details (read-only, two-section) `[IMPLEMENTED]`

- **Route:** shared GET contract (hedgerow feature whose normalised `retentionCategory === "Enhanced"`)
- **Template:** `src/server/habitat-details/pi-hedgerow-details-enhanced.njk` (extends `layouts/pi-view-only-sections-page.njk`; frontend PR#179)
- **Backend endpoint:** shared GET contract
- **Description:** Two-section stacked page, H1 = feature ref.
  - **Section 1 — "Post-intervention habitat details":** Intervention, **Length**, Habitat
    type, Distinctiveness, Condition, Strategic significance. No Broad habitat row. Length
    uses `formatLengthDisplay` — the value carries its own **`km` suffix**, unlike the
    retained hedgerow page in Step 2.
  - **"View baseline details"** link after the first section, resolved by ref.
  - **Section 2 — "Time to target / difficulty":** the same six rows as Step 4.
  - Then the bordered "Habitat units delivered" row. All values read from `proposed`.
  - Back link anchors to `#hedgerows`.
- **Validation:** shared GET contract
- **On success:** Renders the Enhanced two-section read-only hedgerow details page
- **On error:** shared GET contract

---

### Step 7 — View Created hedgerow details (read-only, two-section) `[IMPLEMENTED]`

- **Route:** shared GET contract (hedgerow feature whose normalised `retentionCategory === "Created"`)
- **Template:** `src/server/habitat-details/pi-hedgerow-details-enhanced.njk` — **the same template as Step 6**, rendered with `buildCreatedHedgerowViewOnlyViewModel` (frontend PR#186)
- **Backend endpoint:** shared GET contract
- **Description:** Same rows, same two sections and same formatting as Step 6. **The one
  behavioural difference: the "View baseline details" link is never shown.** The Created
  view model calls the Enhanced builder with `baselineFeatureId: null`, because a created
  hedgerow has no baseline counterpart — so the link stays hidden even if an unrelated
  baseline feature happens to share the same ref. The Intervention row shows "Created".

  Fixture note: the `created linear features` pair is what makes that suppression testable.
  Its baseline half carries HG001–HG018, so the Created hedgerow HG013 **does** have a
  ref-matching baseline feature — the link is therefore hidden by the view model rather
  than by the absence of a match, which is what an assertion needs to be non-vacuous. The
  same pair supplies the `N/A`-sentinel time-to-target case (see Step 4's coverage note).

- **Validation:** shared GET contract
- **On success:** Renders the Created two-section read-only hedgerow details page, with no baseline link
- **On error:** shared GET contract

---

### Step 8 — View Created watercourse details (read-only, two-section) `[IMPLEMENTED]`

- **Route:** shared GET contract (watercourse feature whose normalised `retentionCategory === "Created"`)
- **Template:** `src/server/habitat-details/pi-watercourse-details-created.njk` (extends `layouts/pi-view-only-sections-page.njk`; BMD-739, frontend PR#187)
- **Backend endpoint:** shared GET contract
- **Description:** Two-section stacked page, H1 = feature ref.
  - **Section 1 — "Post-intervention habitat details":** Intervention, **Length**, Habitat
    type, Distinctiveness, Condition, **Strategic significance**, **Watercourse
    encroachment**, **Riparian encroachment**. Note the order differs from the retained
    watercourse page in Step 3 — here Strategic significance sits **above** the two
    encroachment rows. Length carries its own `km` suffix (`formatLengthDisplay`).
  - **"View baseline details"** link after the first section, resolved by ref (**not**
    suppressed, unlike the Created hedgerow in Step 7).
  - **Section 2 — "Time to target / difficulty":** the same six rows as Step 4.
  - Then the bordered "Habitat units delivered" row.
  - **Encroachment values read from `proposed`**, not baseline-first — for a created or
    enhanced watercourse the engine takes its encroachment inputs from the proposed side.
    This is the opposite of the retained watercourse page (Step 3).
  - Back link anchors to `#watercourses`.
- **Validation:** shared GET contract
- **On success:** Renders the Created two-section read-only watercourse details page
- **On error:** shared GET contract

---

### Step 9 — View Enhanced watercourse details (read-only, two-section) `[IMPLEMENTED]`

- **Route:** shared GET contract (watercourse feature whose normalised `retentionCategory === "Enhanced"`)
- **Template:** `src/server/habitat-details/pi-watercourse-details-enhanced.njk` (extends `layouts/pi-view-only-sections-page.njk`; BMD-735, frontend PR#188)
- **Backend endpoint:** shared GET contract
- **Description:** **Identical in every respect to Step 8** — the two templates set the same
  `sections` structure and both view models delegate to
  `buildWatercourseSectionsViewOnlyFields`. They differ only in the Intervention row value
  ("Enhanced" vs "Created") and in the template file selected.
- **Validation:** shared GET contract
- **On success:** Renders the Enhanced two-section read-only watercourse details page
- **On error:** shared GET contract

---

### Step 10 — Unsupported feature placeholder (individual trees) `[IMPLEMENTED]`

- **Route:** shared GET contract (tree feature, or any type with no view-only page)
- **Template:** `src/server/habitat-details/pi-feature-unsupported.njk` (extends `layouts/page.njk` directly — neither view-only layout)
- **Backend endpoint:** shared GET contract
- **Description:** Individual trees (and IGGIs, if ever reachable) have no details page yet.
  Renders the "Post-intervention habitat details" heading with the project name as caption
  and the message "Individual tree and IGGI features are not yet supported in this view."
  No rows, no baseline link, no units row. Back link to
  `/projects/{projectId}/post-intervention-habitat-list#area-habitats`.
- **Validation:** shared GET contract
- **On success:** Renders the placeholder page
- **On error:** shared GET contract

---

### Step 11 — Save is not implemented (read-only route) `[IMPLEMENTED]`

- **Route:** `POST /post-intervention-habitat-details`
- **Template:** None
- **Auth required:** Yes (session + approved BNG Completer role — the route keeps the same
  `auth: 'session'` + `requireBngCompleterRole` guards as the GET)
- **Backend endpoint:** None — no page renders a form that posts here.
- **Description:** Every post-intervention details page is read-only, so nothing submits to
  this route. It stays registered and its handler throws `Boom.notImplemented` so a stale
  page or client gets an explicit **501** rather than a 404. The previous editable-form save
  (which called `PUT /projects/{projectId}/post-intervention/habitats/{featureId}`) has been
  removed from this route; the backend endpoint still exists but is no longer called from
  here. BMD-845 (which added the habitat-list "Intervention type" column) confirmed there
  are no per-intervention-type _editable_ variations to build.
- **Validation:** None — the handler declares no payload schema and reads no input.
- **On success:** N/A — the handler always throws.
- **On error:** 501 Not Implemented.

---

## Notes on retention categories

- The backend persists only `Retained`, `Created` and `Enhanced` on the feature root
  (`feature.retentionCategory`). A **Lost area habitat** is a baseline habitat that was
  removed and replaced, so the backend maps it to **Created** at import — it reaches Step 4
  with its Intervention row showing "Created". **Lost hedgerows, watercourses and trees are
  excluded at import** and never reach this route or the habitat list.
- Both the frontend (`normaliseRetentionCategory` in
  `post-intervention-habitat-details/retention.js`) and the backend
  (`utilities/baseline/retention-category.js`) strip a `"N. "` list prefix. The project
  document keeps whatever the upload carried, so the frontend must normalise before
  comparing or displaying.
