# Post-Intervention Habitat Details User Flow (Created edits and retained reference forms)

## Overview

A BNG Completer opens a feature from its unit-type post-intervention page —
`area-post-intervention`, `hedgerows-post-intervention` or `watercourses-post-intervention`
(BMD-1043, frontend PR#352; it was the post-intervention habitat list, now removed) — and
views its details. **Every post-intervention feature renders a read-only page except a
Created area habitat, Created hedgerow or Created watercourse**, which renders an **editable form** (BMD-1048, frontend PR#418 /
backend PR#539, 2026-10-28) — area, hedgerow and watercourse features each get a page
specific to their type _and_ their intervention (retention) category; individual trees
render an unsupported-feature placeholder. `POST /post-intervention-habitat-details` saves
the Created form (Step 11) or a Retained reference form; unsupported features return **501 Not Implemented**.

**Layout:** Read-only details use `layouts/pi-view-only-sections-page.njk`:
stacked labels and values, with a bordered Habitat units delivered summary below.
Retained area, hedgerow and watercourse pages also carry a Habitat reference input,
Save and Cancel (BMD-1180); their heading names the feature type and saved reference.
Created forms extend `layouts/page.njk` and keep the two sections and units summary.

### Back link (BMD-1043)

Every page's Back link is `postInterventionBackHref(projectId, type, returnUrl)` in
`post-intervention-habitat-details/controller.js`. The destination is the feature type's
post-intervention page — `habitatDetailsDestination(projectId, type, 'postIntervention')`:
`/projects/{projectId}/area-post-intervention` for habitats and trees,
`/projects/{projectId}/hedgerows-post-intervention`, or
`/projects/{projectId}/watercourses-post-intervention`. A `returnUrl` query param is honoured
only when it is a safe relative path equal to that destination or starting with
`{destination}#`; the grids' Ref links pass their own page as `returnUrl`, so a click-through
returns there. Before BMD-1043 every Back link pointed at the post-intervention habitat list
with a tab anchor (`#area-habitats`, `#hedgerows`, `#watercourses`).

### Page routing

The controller calls `resolveViewOnlyPage(type, retentionCategory)`, where `type` is the
backend's discriminator (`habitat`, `tree`, `hedgerow`, `watercourse`) and
`retentionCategory` is `normaliseRetentionCategory(feature.retentionCategory)` — a leading
`"N. "` list prefix and surrounding whitespace are stripped ("1. Enhanced" → "Enhanced"),
`null` when there is no usable value.

| Feature type            | `Enhanced`                         | `Created`                                                   | anything else (incl. `Retained`, unrecognised, absent) |
| ----------------------- | ---------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------ |
| `habitat`               | `pi-habitat-details-enhanced`      | `pi-habitat-details-created-edit` (Step 4, form)            | `pi-habitat-details` (Step 1)                          |
| `hedgerow`              | `pi-hedgerow-details-enhanced`     | `pi-habitat-details-created-edit` (hedgerow form, BMD-1049) | `pi-hedgerow-details` (Step 2)                         |
| `watercourse`           | `pi-watercourse-details-enhanced`  | `pi-watercourse-details-created`                            | `pi-watercourse-details` (Step 3)                      |
| `tree` / any other type | `pi-feature-unsupported` (Step 10) | —                                                           | —                                                      |

The Created **area and hedgerow** cases are checked in the GET handler _before_ `resolveViewOnlyPage` is
called, so it never reaches the view-only map. A Lost area parcel is persisted as Created
(BMD-534), so it gets the edit form too.

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
- Strategic significance is the fixed string `"Low (1)"` on the **retained** pages. Created and Enhanced pages show the priced value with its multiplier (`"Low (1)"` / `"High (1.15)"`, BMD-1038) via `proposedStrategicSignificanceDisplay`, and **nothing** when the feature has no `strategicSignificanceCategory` (frontend PR #370, BMD-1051 — it used to fall back to `"Low (1)"`). That covers a value rejected on import (Medium, blank or unrecognised, which the backend leaves unpriced, so units delivered is blank — it was `0.00` before BMD-1070) **and** an uncalculated feature carrying a valid value, which shows blank too, with blank units delivered. No shipped fixture has such a hedgerow any more: all-unit-types HG012 (Good → Good), the old example, is now rejected by BMD-820 (`medium-hedgerow`, backend PR #477), so its whole proposed side is nulled and its units delivered are blank (null since BMD-1070).
- "Habitat units delivered" / "Units in this habitat" is `formatHabitatUnits(feature.units)`
  — 2 decimal places, capped at 7 significant figures.

The **Intervention** row shows the normalised retention category, defaulting to
`"Retained"` when the feature carries none (`interventionDisplay`).

### "View baseline details" link

Resolved by matching the parcel `ref` across every baseline layer (habitats, trees,
hedgerows, watercourses) — baseline and post-intervention are independent uploads with
independent `featureId`s, so `ref` is the only stable join key. Hidden when no baseline
feature shares the ref (e.g. no baseline uploaded).

**Since BMD-1056/BMD-1066 (backend PR#478, 2026-10-13) a fresh upload always matches a
Retained or Enhanced feature.** The post-intervention upload derives the baseline from the
file's own rows, so every Retained or Enhanced feature gets a baseline feature with the same
ref. The "hidden" branch is no longer reached by a pairing of separate baseline and
post-intervention files (which is how `complete-project` H2-2 and H2-3 reached it). It now
needs a baseline ref changed after upload, or a Created feature. On a read-only
sections page the link renders **after the first section**, before the units row.
Created area and hedgerow forms render the link before Intervention and size. They
resolve an explicit parent only within the matching baseline unit layer; an explicit
null parent suppresses the link. Service-template projects require that parent link.
Legacy non-template features without a parent field still resolve by ref. Created
watercourses keep the read-only ref-based link behavior.

**Matched on the cleaned ref (BMD-1058) `[IMPLEMENTED]`.** `comparableRef` in
`post-intervention-habitat-details/controller.js` trims both refs and cuts them to 100
characters before comparing them. That way a baseline saved before BMD-1058, which may still
hold `' H001'`, matches too. The heading is the PI ref as saved, untrimmed by the frontend. The
journey check is in `post-intervention-habitat-details.spec.js` › _habitat reference cleaning_.
The long-and-padded PI file's `"␣Café–Ω H003"` is headed exactly `"Café–Ω H003"` and shows the
link, matching the baseline's unpadded ref.

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
  the area habitats post-intervention page (see Back link above).
- **Validation:** shared GET contract
- **On success:** Renders the read-only stacked area details page
- **On error:** shared GET contract

---

### Step 2 — View retained hedgerow details and edit its reference `[IMPLEMENTED]`

- **Route:** shared GET contract for a Retained hedgerow.
- **Template:** `src/server/habitat-details/pi-hedgerow-details.njk`, extending
  `layouts/pi-view-only-sections-page.njk`.
- **Description:** Heading `Hedgerow {ref}`, project caption, reference input,
  then Intervention, Size (kilometres), Habitat type, Distinctiveness, Condition
  and Strategic significance. Size is a bare number with seven significant figures.
  The baseline link follows the section when a parent resolves, followed by
  Habitat units delivered and Save/Cancel. All attributes except reference stay fixed.
- **Validation:** shared GET and Retained reference-edit contracts.
- **On success:** renders saved details; a valid reference save returns to the hedgerow list.
- **On error:** reference errors redisplay the saved attributes and submitted reference.

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
  Back link to the watercourses post-intervention page.
- **Validation:** shared GET contract
- **On success:** Renders the read-only stacked watercourse details page
- **On error:** shared GET contract

---

### Step 4 — Edit Created area habitat details (form, BMD-1048) `[IMPLEMENTED]`

- **Route:** shared GET contract (area feature whose normalised `retentionCategory === "Created"`,
  including a Lost area parcel, which is persisted as Created)
- **Template:** `src/server/habitat-details/pi-habitat-details-created-edit.njk` (extends
  `layouts/page.njk`; BMD-1048, frontend PR#418, 2026-10-28). It replaced the read-only
  `pi-habitat-details-created.njk` (BMD-736, frontend PR#180), which was deleted.
- **Backend endpoints:** shared GET contract, plus `GET /reference/area-creation` (backend
  PR#539) for the dropdown options and derived values, cached in the frontend process
- **Description:** A form with H1 = parcel ref and caption = project name, an **"Upload
  file"** button in the header (to the upload-file page) and a GOV.UK error summary when
  Step 11 re-renders it with errors. Values come from `feature.proposed`.
  - **Section 1 — "Post-intervention habitat details":** a **Habitat reference** text input,
    the **"View baseline details"** link (when resolved), read-only **Intervention** and
    **"Size (hectares)"** (value without a unit suffix), the **Broad habitat** and **Habitat
    type** dropdowns, read-only **"Distinctiveness (multiplier)"**, and the **Strategic
    significance** dropdown.
  - **Section 2 — "Time to target / difficulty":** the **Target condition** dropdown,
    read-only Standard time to target condition and Standard difficulty, an **"Advance or
    delay?"** fieldset holding the "Habitat created in advance (years)" and "Delay in
    starting habitat creation (years)" dropdowns, then read-only **"Final time to target
    condition (multiplier)"** and Applied difficulty multiplier.
  - Then the **"Habitat units delivered"** row, and **Save** / **Cancel** (Cancel = back link).
  - Every dropdown leads with a "Choose …" option (`Choose broad habitat`, `Choose habitat
type`, `Choose target condition`, `Choose strategic significance`, `Choose advance`,
    `Choose delay`), selected when the saved value is null. Habitat type lists only the
    types for the selected broad habitat; Target condition lists only the conditions with a
    defined creation time to target for the selected type; the year dropdowns offer 0–30
    and 30+.
  - **Derived values update in the browser** (`src/client/javascripts/created-area-details.js`)
    as the dropdowns change; nothing is saved until Save (BMD-1048 AC4–AC10). Units are only
    recalculated by the backend on Save.
  - Unavailable imported habitat/condition choices show a hint that saving without a new
    selection clears them. Imported timing outside the offered range stays selected as
    unchanged until explicitly replaced or cleared. A reference over 100 characters shows
    a "Shorten it" hint.
  - The "View baseline details" link resolves through `parentFeatureId` when the feature
    carries one (BNG Service template, BMD-1083), otherwise by ref as above.
  - **Standard time to target condition** on first load is the view-only value below (the
    edit page reuses it while the selection is unchanged); after a change it is rebuilt by
    `createdAreaDerived` (`src/shared/created-area-details.js`) with the same rules — a real
    baseline condition gives the transition form, an absent or `N/A…` one the short form.
    The read-only value it reuses, `formatStandardTimeToTarget`
    (`post-intervention-habitat-details/view-only-shared.js`), renders the condition
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
      **hedgerow** page (Step 7) via HG013, `Good - 20 years` (BMD-737). The same file's
      **R003** covers the Created **watercourse** page (Step 8), `Fairly Poor - 2 years`
      (BMD-739). This is the branch real Natural England uploads hit.

  - There is **no separate Condition row** on this page: the proposed condition is the
    Target condition dropdown's selected option (its prefix stripped, no multiplier).
  - Back link and Cancel go to the area habitats post-intervention page (see Back link above).
- **Validation:** shared GET contract on load; the form's own rules are in Step 11
- **On success:** Renders the Created area edit form
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
  - Back link to the hedgerows post-intervention page.
- **Validation:** shared GET contract
- **On success:** Renders the Enhanced two-section read-only hedgerow details page
- **On error:** shared GET contract

---

### Step 7 — Edit Created hedgerow details `[IMPLEMENTED]`

- **Route:** shared GET contract (hedgerow whose normalised retention category is Created)
- **Template:** `src/server/habitat-details/pi-habitat-details-created-edit.njk`
- **Backend endpoints:** GET `/reference/hedgerow-creation` and PUT
  `/projects/{projectId}/post-intervention/hedgerows/{featureId}` (backend #564)
- **Description:** BMD-1049 uses the shared Created edit form, with fixed imported
  Length (km), no broad-habitat field and hedgerow-only habitat/target-condition choices.
  HR3 retains its baseline-to-target time wording; HG013 shows the target alone.
  Editable fields start from the saved feature. Imported timing outside the new-choice
  range stays selected as unchanged until explicitly replaced or cleared. Stored final-time
  text remains visible while its calculation inputs are unchanged.
  Created hedgerows keep valid stored-parent links; explicit null parents suppress them.
  Legacy non-template features without a parent field can still resolve a baseline by ref.
- **Validation:** shared Created form validation, including mutually exclusive positive
  advance/delay values and strict validation of newly selected years.
- **On success:** Save persists the edits, recalculated units/status and returns to the
  hedgerow list. Cancel and Upload discard local edits.
- **On error:** Field errors redisplay the form. A 404 from the creation-reference endpoint
  during rollout renders the previous read-only page; other backend failures propagate.

---

### Step 8 — Edit Created watercourse details (BMD-1050) `[IMPLEMENTED]`

- **Route:** shared GET contract for a Created watercourse.
- **Template:** `src/server/habitat-details/pi-habitat-details-created-edit.njk`.
- **Backend endpoints:** GET `/reference/watercourse-creation` and PUT
  `/projects/{projectId}/post-intervention/watercourses/{featureId}`.
- **Description:** Shared Created form with fixed imported Length (km), no broad habitat,
  watercourse-only habitat/condition options and separate Watercourse encroachment and
  Riparian encroachment dropdowns. Each has its own Choose default and can be cleared
  independently. Changes do not reset other inputs or recalculate displayed units.
  WC3 keeps its baseline-to-target wording; R003 keeps the absent-baseline short form.
  The imported lengths are pinned: WC3 is 24 m (0.024km), R003's geometry is
  178.98607010841465 m (0.1789861km), rather than its rounded 179 m attribute.
  Saved values populate the form; unsupported imported timing, condition and encroachment
  values have an explicit unchanged option. Explicit clearing sends null.
  Baseline links follow the same stored-parent rules as Created hedgerows.
- **Validation:** shared Created validation; positive advance and delay together fail on
  Save. Error text reuses the existing Created editor wording, pending Jack's final copy
  for invalid references and conflicting timing (BMD-1050 Open Points).
- **On success:** Save recalculates watercourse units, status and totals and returns to
  the watercourses list. Incomplete units remain null with zero aggregate contribution.
  Cancel and Upload discard unsaved changes.
- **On error:** redisplay field errors with all selections retained. A reference endpoint
  404 during rollout retains the old read-only Created page; other backend failures surface.

---

### Step 9 — View Enhanced watercourse details (read-only, two-section) `[IMPLEMENTED]`

- **Route:** shared GET contract (watercourse feature whose normalised `retentionCategory === "Enhanced"`)
- **Template:** `src/server/habitat-details/pi-watercourse-details-enhanced.njk` (extends `layouts/pi-view-only-sections-page.njk`; BMD-735, frontend PR#188)
- **Backend endpoint:** shared GET contract
- **Description:** Read-only stacked sections built by `buildWatercourseSectionsViewOnlyFields`.
  The first section shows Intervention, Length, Habitat type, Distinctiveness,
  Condition, Strategic significance and both encroachment values. Encroachments
  read from `proposed`, with their calculated multipliers. The baseline link follows
  the first section when a baseline feature resolves. The second section shows
  target condition, standard time and difficulty, advance or delay, final time and
  applied difficulty multiplier. Habitat units delivered appears below both sections.
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
  the area habitats post-intervention page (see Back link above).
- **Validation:** shared GET contract
- **On success:** Renders the placeholder page
- **On error:** shared GET contract

---

### Step 11 — Save Created area, hedgerow or watercourse details (BMD-1048/BMD-1049/BMD-1050) `[IMPLEMENTED]`

- **Route:** `POST /post-intervention-habitat-details`
- **Template:** `pi-habitat-details-created-edit.njk` on a field-validation failure
- **Auth required:** Yes (session, approved BNG Completer role and CSRF protection)
- **Backend endpoints:** GET the post-intervention feature to check type/retention, load
  `/reference/area-creation`, `/reference/hedgerow-creation` or `/reference/watercourse-creation`, then PUT to
  `/projects/{projectId}/post-intervention/habitats/{featureId}` for areas or
  `/projects/{projectId}/post-intervention/hedgerows/{featureId}` for hedgerows, or
  `/projects/{projectId}/post-intervention/watercourses/{featureId}` for watercourses.
  The backend validates the edit, uses shared enrichment and saves the feature, units and
  project totals. Incomplete features keep `units: null` and do not contribute units.
- **Description:** The Step 4, Step 7 and Step 8 forms post here. The handler:
  1. Validates UUIDs, editable strings and timing selections against the three Joi payload
     schemas. Timing selections can be blank, 0 to 30, 30+, or unchanged imported values.
     Areas require a broad habitat field; hedgerows and watercourses forbid it. Watercourses require both encroachment controls. Malformed payloads return
     400 before backend requests; the type-specific missing-area-broad guard runs after
     fetching the feature and before loading reference data.
  2. Handles Created areas, hedgerows and watercourses; Retained reference edits use their own handler. Unsupported features return 501.
  3. Validates choices and mutually exclusive positive advance/delay, resolving unchanged
     timing from per-feature imported metadata. Errors redisplay entered values, summary
     links and inline messages, including delay-only errors.
  4. Sends valid edits to the type-specific backend PUT. Blank fields send null; unchanged
     timing is omitted. All three backend routes resolve omissions from the locked stored row,
     retain 30+ metadata and still reject out-of-range newly selected years.
- **Validation:** References must be nonblank, valid UTF-8 and at most 100 characters.
  Habitat/condition/significance selections must be offered choices. Positive advance and
  delay cannot both be selected. Duplicate references and explicit blank dropdowns are
  allowed; missing calculation inputs leave the feature Incomplete.
- **On success:** 302 to the area, hedgerow or watercourse post-intervention list, respecting a safe
  returnUrl. The reopened row shows persisted selections, recalculated units and status.
- **On error:** 400 for malformed payloads, 501 for unsupported feature categories,
  redisplay for field errors, or 503 when hedgerow or watercourse creation reference data is not deployed.
  No PUT occurs on invalid input or the rollout-unavailable path.

---

## Notes on retention categories

- The backend persists only `Retained`, `Created` and `Enhanced` on the feature root
  (`feature.retentionCategory`). A **Lost area habitat** is a baseline habitat that was
  removed and replaced, so the backend maps it to **Created** at import — it reaches Step 4
  with its Intervention row showing "Created". **Lost hedgerows, watercourses and trees are
  excluded at import** and never reach this route or the post-intervention grids.
- Both the frontend (`normaliseRetentionCategory` in
  `post-intervention-habitat-details/retention.js`) and the backend
  (`utilities/baseline/retention-category.js`) strip a `"N. "` list prefix. The project
  document keeps whatever the upload carried, so the frontend must normalise before
  comparing or displaying.

## BMD-1049 review update — Created hedgerow editing [IMPLEMENTED]

Created hedgerows now use the Created edit form: imported Length (km), no broad
habitat, reference/type/significance/target/timing controls, Save/Cancel/Upload.
The reference endpoint is `/reference/hedgerow-creation`; until it is deployed
(a 404), GET retains the previous read-only page. Other backend failures propagate.
The standard-time row retains baseline-to-target wording when a baseline condition
is present; N/A baselines keep the short form. Unsupported imported timing is
selected as an unchanged imported option; only explicit clearing sends null.
Save uses PUT `/projects/{projectId}/post-intervention/hedgerows/{featureId}` and
returns to the hedgerow list. Incomplete units use the same null persistence as
import/resync. Created reference edits preserve the baseline parent separately.

Coverage: frontend unit tests cover dropdown previews, nulls, validation and the
rollout fallback; backend tests cover calculations and persistence. The two existing
HR3/HG013 journeys must witness the new form with real uploaded data and assert
the fixture lengths (24 m = 0.024km; 175.1389248737094 m geometry = 0.1751389km); a dedicated
project witnesses reference save/reload without mutating shared read-only fixtures.

## BMD-1050 approved coverage update

The existing WC3/R003 witnesses cover the real watercourse form, saved selections,
exact geometry lengths and both time-to-target display branches. Backend tests cover
calculator combinations, ownership, validation and null persistence; frontend tests
cover rendered controls and accessible validation, with the backend mocked.

The approved additional browser witness uses its own uploaded watercourse project.
It renames WC3, changes both encroachments, saves and checks the recalculated 0.09 units
in the grid and reopened details. It then clears delay, saves and verifies blank units,
a blank saved delay and unchanged advance and encroachments after reopening. This
connects browser null submission to real persistence and rendering across both services.
