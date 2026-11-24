# Post-Intervention Habitat Details User Flow (read-only view; Retained reference, Created area, hedgerow and watercourse edits, and Enhanced area, hedgerow and watercourse edits)

## Overview

A BNG Completer opens a feature from its unit-type post-intervention page —
`area-post-intervention`, `hedgerows-post-intervention` or `watercourses-post-intervention`
(BMD-1043, frontend PR#352; it was the post-intervention habitat list, now removed) — and
views its details. **A Created area habitat, hedgerow or watercourse** renders an **editable
form** (BMD-1048, frontend PR#418 / backend PR#539, 2026-10-28; watercourses since BMD-1050,
frontend PR#444, 2026-11-10). **An Enhanced area habitat** renders the same area form,
limited to the valid enhancements of its baseline (BMD-1045, frontend PR#518 / backend
PR#650, 2026-11-17). **An Enhanced hedgerow** renders the Created hedgerow form, limited the
same way (BMD-1046, frontend PR#526 / backend PR#660, 2026-11-17). **An Enhanced watercourse**
renders the Created watercourse form, limited the same way (BMD-1047, frontend PR#541 / backend
PR#694, 2026-11-23). **A Retained area habitat, hedgerow or
watercourse** renders its details read-only with an editable **Habitat reference** and Save /
Cancel (BMD-1180, frontend PR#423 / backend PR#552, 2026-11-03). **Every other feature renders
a read-only page.** Area, hedgerow and watercourse features each get a page specific to their
type _and_ their intervention (retention) category; individual trees use the area page with
two tree rows (BMD-1172, frontend PR#475). Only a feature type with no details page renders
the unsupported-feature placeholder. `POST /post-intervention-habitat-details` saves the Created
or Enhanced form (Step 11) or the Retained reference (Step 12); for any other feature it returns **501 Not
Implemented**.

**Layout: the stacked "sections" design is the norm.** All seven read-only and reference-form
pages extend `layouts/pi-view-only-sections-page.njk` (bold label on one line, value on the
next; no `govukSummaryList` rows; a bordered "Habitat units delivered" summary row at the
bottom; the parcel **ref** in the H1). `layouts/pi-view-only-page.njk` was removed by frontend
PR#423. The Created area edit page (Step 4) extends `layouts/page.njk` and keeps the same two
section headings and "Habitat units delivered" row.

### Retained H1 (BMD-1180)

The H1 is `Habitat <ref>` on all three retained types (PO ruling, 2026-11-03; the ticket's
designs). Frontend PR#482 (2026-11-17) brought the hedgerow and watercourse pages in line; until
then they read `Hedgerow <ref>` and `Watercourse <ref>`. The baseline details pages keep their
`Hedgerow`/`Watercourse` prefixes.

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

| Feature type   | `Enhanced`                                       | `Created`                                                   | anything else (incl. `Retained`, unrecognised, absent) |
| -------------- | ------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------ |
| `habitat`      | `pi-habitat-details-created-edit` (Step 5, form) | `pi-habitat-details-created-edit` (Step 4, form)            | `pi-habitat-details` (Step 1)                          |
| `hedgerow`     | `pi-hedgerow-details-enhanced`                   | `pi-habitat-details-created-edit` (hedgerow form, BMD-1049) | `pi-hedgerow-details` (Step 2)                         |
| `watercourse`  | `pi-habitat-details-created-edit` (Step 9, form) | `pi-habitat-details-created-edit` (Step 8, form)            | `pi-watercourse-details` (Step 3)                      |
| `tree`         | tree edit page, or area sections page (BMD-1172) | tree edit page (BMD-1172)                                   | `pi-habitat-details` + tree rows (Step 1)              |
| any other type | `pi-feature-unsupported` (Step 10)               | —                                                           | —                                                      |

The Created **area and hedgerow** cases, and the Enhanced **area** case (BMD-1045), are checked in
the GET handler _before_ `resolveViewOnlyPage` is called, so they never reach the view-only map.
An Enhanced area falls back to `pi-habitat-details-enhanced` only while the backend does not serve
`/reference/area-enhancement`. A Lost area parcel is persisted as Created
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
- Strategic significance is the fixed string `"Low (1)"` on the **retained** pages. Created and Enhanced pages show the priced value with its multiplier (`"Low (1)"` / `"High (1.15)"`, BMD-1038) via `proposedStrategicSignificanceDisplay`, and **nothing** when the feature has no `strategicSignificanceCategory` (frontend PR #370, BMD-1051 — it used to fall back to `"Low (1)"`). That covers a value rejected on import (Medium, blank or unrecognised, which the backend leaves unpriced, so units delivered is blank — it was `0.00` before BMD-1070) **and** an uncalculated feature carrying a valid value, which shows blank too, with blank units delivered. No shipped fixture has such a hedgerow any more: all-unit-types HG012 (Good → Good), the old example, is now rejected by BMD-820 (`medium-hedgerow`, backend PR #477), so its whole proposed side is nulled and its units delivered are blank (null since BMD-1070). The exception is a **Created** area or hedgerow: since frontend PR #465 (BMD-1048 PO ruling), its page shows units delivered as `0.00` when the units are null. That is display only, so storage is unchanged.
- "Habitat units delivered" is `formatHabitatUnits(feature.units)`
  — 2 decimal places, capped at 7 significant figures.

The **Intervention** row shows the normalised retention category, defaulting to
`"Retained"` when the feature carries none (`interventionDisplay`).

### "View baseline details" link

Resolved by matching the parcel `ref` across the baseline habitat, hedgerow and watercourse
layers — baseline and post-intervention are independent uploads with
independent `featureId`s, so `ref` is the only stable join key. Hidden when no baseline
feature shares the ref (e.g. no baseline uploaded).

**Never shown on a post-intervention tree page (BMD-1184, frontend PR #533).** Whatever its
Retention Category, a tree page links to no baseline tree (`isUnlinked` in
`baseline-feature-link.js`).

**Since BMD-1056/BMD-1066 (backend PR#478, 2026-10-13) a fresh upload always matches a
Retained or Enhanced feature.** The post-intervention upload derives the baseline from the
file's own rows, so every Retained or Enhanced feature gets a baseline feature with the same
ref. The "hidden" branch is no longer reached by a pairing of separate baseline and
post-intervention files (which is how `complete-project` H2-2 and H2-3 reached it). It now
needs a baseline ref changed after upload, or a Created feature. On a read-only or
Retained sections page the link renders **after the first section**, before the units row.
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

### "Supporting information" on Retained pages (BMD-1187) `[IMPLEMENTED]`

Backend PR#648 / frontend PR#519, 2026-11-13. A Retained habitat has no comment of its own:
it shows the comment saved on the baseline habitat it is joined to. The backend adds
`baselineComment` to the GET response for a **Retained** feature only
(`utilities/features/retained-baseline-comment.js`). It reads only the feature's own baseline
layer. A legacy upload joins by ref; a BNG Service template upload joins by the parent the row
names, and the row's own imported comment is not used. The value is `null` when the baseline
habitat has no comment or no single parcel can be identified.

- **Rendering:** the last read-only row of the first section, after **Strategic significance**
  and before the "View baseline details" link, labelled **Supporting information** (an `<h3>`
  row label like the others, not a section heading). Display-only: no text box. The value
  keeps its line breaks and wraps long words (`app-stacked-fields__value--multiline`,
  `white-space: pre-line`), with no truncation.
- **No comment:** the fixed text **"No data"** (also for a blank or whitespace-only comment).
  It has no effect on the habitat's units or status.
- **Scope:** the retained area page (trees included), hedgerow page and watercourse page. Created,
  Enhanced and Lost rows get no `baselineComment`, so the row is left off their pages.
- **Editing** happens on the baseline habitat details page (BMD-1112), whose save is reflected
  on the Retained page.
- **Journey checks:** `baseline-habitat-details.spec.js` › _supporting information_ (imported
  comment, "No data", line breaks, clearing) and › _supporting information on a tree_ (tree,
  long watercourse comment).

### "Supporting information" on Created edit forms (BMD-1153) `[IMPLEMENTED]`

Backend PR#667 / frontend PR#527, 2026-11-17. A **Created** area habitat, hedgerow, watercourse
or individual tree has its own comment, kept on the post-intervention row and separate from
any baseline, Retained or Enhanced comment. It is edited on the Created edit form. This is not
behind `SERVICE_TEMPLATE_ENABLED`. A legacy upload imports a Created row's own comment (e.g.
R4 in `Post-intervention - comments are valid.gpkg`). A Lost area row becomes Created, but its
comment stays on the baseline habitat only.

- **Rendering:** a GOV.UK textarea (`#comment`, 5 rows), labelled **Supporting information**
  (`govuk-label--m`). Its hint reads "Add any information that will help support your
  submission." (the baseline page keeps its own hint). It sits below **Habitat units delivered**
  and above Save / Cancel, and has no character count. It is filled from the saved comment,
  line breaks included, or is empty.
- **Save** (`POST`, field `comment`): CRLF is turned into LF and leading and trailing whitespace
  is trimmed. A blank or whitespace-only comment is saved as no value. The comment has no effect
  on units or status.
- **Refused** (validated on save only): invalid characters (U+FFFD) and more than 999
  characters once trimmed, counted in characters, not bytes. The messages are the BMD-1112 ones,
  marked interim. They are listed after every other field's errors, invalid characters first,
  each linking to `#comment`. Nothing on the page is saved and everything typed is kept.
- **Not on:** Retained pages (read-only, BMD-1187) or IGGIs. Enhanced habitats have their own
  box (BMD-1190, below).
- **Journey checks:**
  - `baseline-habitat-details.spec.js` › _supporting information_: R4's imported comment, the
    empty box on H3 and on Lost-as-Created H2-1, and a hedgerow round trip.
  - `post-intervention-habitat-details.spec.js`: the Created area and watercourse complete-edit
    saves, the area's Cancel and both-rules refusal, and the Created tree save.

### "Supporting information" on Enhanced edit forms (BMD-1190) `[IMPLEMENTED]`

Backend PR#676 / frontend PR#536, 2026-11-19. An **Enhanced** area habitat, hedgerow or
individual tree has its own comment, kept on the post-intervention row and separate from the
comment of the baseline habitat it enhances. Editing either one leaves the other alone. The
box, its save and its refusals are the Created ones above, on the Step 5 and Step 6 forms and
the Enhanced tree form. A legacy upload imports an Enhanced row's own comment onto the
post-intervention habitat, not the baseline (e.g. area H3 in
`Post-intervention - comments are valid.gpkg`).

- **Enhanced watercourses** have had the box since BMD-1047 (frontend PR#541) gave them the
  Created watercourse form (Step 9), whose box they inherit.
- Save returns to the unit-type page with the **Retained** tab selected, as for Created.
- The Enhanced tree form has no "View baseline details" link. Its baseline is reached from the
  Areas baseline page.
- The ticket's ACs say the limit is 999,999 characters. The service uses 999, the BMD-1112
  limit, for every comment box.
- **Journey checks:** `baseline-habitat-details.spec.js` › _supporting information_ (H3's
  imported comment, an empty box on hedgerow H1, area H2-3 and hedgerow H1 saves) and ›
  _supporting information on a tree_ (Enhanced tree T005 save). Refusals and the 999 boundary
  share the Created form and its rule, and are left to the Created and baseline tests.

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

### Step 1 — View retained area habitat details (reference form) `[IMPLEMENTED]`

- **Route:** shared GET contract (area feature; retention category not `Enhanced`/`Created`)
- **Template:** `src/server/habitat-details/pi-habitat-details.njk` (extends `layouts/pi-view-only-sections-page.njk`; BMD-608, frontend PR#191)
- **Backend endpoint:** shared GET contract
- **Description:** Single-section stacked page. H1 is `Habitat <ref>` (BMD-1180); the project
  name is the caption; the section heading is "Post-intervention habitat details". First in
  the section is the **Habitat reference** input, pre-filled with the saved ref and limited to
  99 characters (frontend PR#474; was 100). Read-only rows, in order: **Intervention**, **Size (hectares)**, **Broad
  habitat**, **Habitat type**, **Distinctiveness**, **Condition**, **Strategic significance**,
  **Supporting information** (BMD-1187). Then the "View baseline details" link, the bordered **"Habitat units delivered"** row, and
  **Save** and **Cancel** (Step 12). There is **no "Units in this habitat" row** (replaced by the
  units summary row) and no trading-rules row. An individual tree (BMD-1172) adds **Tree size** after Size,
  and a legacy tree **Number of trees** after that; a BNG Service template tree has no Count, so shows
  no number of trees. A tree has **no** "View baseline details" link (BMD-1184); journey checks in
  `post-intervention-habitat-details.spec.js` › _retained individual tree_ (legacy and BNG Service template). Size uses `formatAreaHectaresValue`
  (10 significant figures, **no `ha` suffix** — the label carries the unit). Broad habitat
  and habitat type read `proposed.broadType` / `proposed.type`. Back link to
  the area habitats post-intervention page (see Back link above).
- **Validation:** shared GET contract
- **On success:** Renders the stacked area details page with its reference form
- **On error:** shared GET contract

---

### Step 2 — View retained hedgerow details (reference form) `[IMPLEMENTED]`

- **Route:** shared GET contract (hedgerow feature; retention category not `Enhanced`/`Created`)
- **Template:** `src/server/habitat-details/pi-hedgerow-details.njk` (extends `layouts/pi-view-only-sections-page.njk`; BMD-723, stacked since BMD-1180)
- **Backend endpoint:** shared GET contract
- **Description:** Single-section stacked page, same chrome and reference form as Step 1. H1 is
  `Hedgerow <ref>` today; the PO's ruling is `Habitat <ref>` (see _Retained H1_). Read-only rows:
  **Intervention**, **Size (kilometres)**, **Habitat type**, **Distinctiveness**, **Condition**,
  **Strategic significance**, **Supporting information** (BMD-1187). Then the "View baseline
  details" link, the bordered "Habitat units delivered" row, and **Save** and **Cancel**. There is no Broad habitat row (hedgerows have no
  broad-habitat dimension). Size uses `formatLengthKm` (7 significant figures, **no `km` suffix**
  — the label carries the unit). All values including habitat type come from `proposed`. Back
  link to the hedgerows post-intervention page.
- **Validation:** shared GET contract
- **On success:** Renders the stacked hedgerow details page with its reference form
- **On error:** shared GET contract

---

### Step 3 — View retained watercourse details (reference form) `[IMPLEMENTED]`

- **Route:** shared GET contract (watercourse feature; retention category not `Enhanced`/`Created`)
- **Template:** `src/server/habitat-details/pi-watercourse-details.njk` (extends `layouts/pi-view-only-sections-page.njk`; BMD-724, frontend PR#192)
- **Backend endpoint:** shared GET contract
- **Description:** Single-section stacked page, same chrome and reference form as Step 1. H1 is
  `Watercourse <ref>` today; the PO's ruling is `Habitat <ref>` (see _Retained H1_). Read-only
  rows: **Intervention**, **Size (kilometres)**, **Habitat type**, **Distinctiveness**,
  **Condition**, **Watercourse encroachment**, **Riparian encroachment**, **Strategic
  significance**, **Supporting information** (BMD-1187). Then the "View baseline details" link, the bordered "Habitat units delivered"
  row, and **Save** and **Cancel**. Size uses `formatLengthKm` (no `km` suffix).
  **This is the one page that still sources descriptive values baseline-first** (see
  _Value sourcing_): habitat type, condition and both encroachment values read
  `baseline.* ?? proposed.* ?? ''`, paired with `proposed.conditionScore`,
  `proposed.waterEncroachmentMultiplier` and `proposed.riparianEncroachmentMultiplier`.
  Back link to the watercourses post-intervention page.
- **Validation:** shared GET contract
- **On success:** Renders the stacked watercourse details page with its reference form
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
  - Since frontend PR#532 (the PO ruling during BMD-1046 testing, 2026-11-18), a stored value
    the list does not offer is not shown or kept: the dropdown shows its default option and
    a save sends `null`. This covers a significance rejected on import, an out-of-list broad
    habitat, type, condition or encroachment, and a fractional or over-30 timing. Clearing a
    broad habitat or type also clears the choices under it. There is no "(imported value)"
    option or hint on any edit page.
    A reference over 99 characters shows a "Shorten it" hint.
  - The "View baseline details" link resolves through `parentFeatureId` when the feature
    carries one (BNG Service template, BMD-1083), otherwise by ref as above. A tree's edit
    page never shows it (BMD-1184, frontend PR #533); journey check in
    `post-intervention-habitat-details.spec.js` › _Created individual tree_.
  - **A Created tree's Standard time to target condition names only the target condition**
    (e.g. `"Poor - 10 years"`), even when its baseline tree has one (BMD-1184, frontend
    PR #528, `namesBaselineCondition: false` on the Created tree kind). Only a BNG Service
    template tree whose condition gets worse (Category Existing, Created) has a baseline
    condition, so this needs the service-template flag to observe (BMD-1088); a legacy
    Created tree is Newly Planted with an N/A baseline and shows the short form anyway.
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
- **Journey coverage (BMD-1048):** `post-intervention-habitat-details.spec.js`. The H2-7 test
  checks the saved selections and every option list (AC1). "Created area habitats — editing"
  covers an incomplete habitat from `Post-intervention - created area partly blank.gpkg`
  (AC2, including the list row's `0.00`, Distinctiveness and Strategic significance). It also
  covers the in-browser previews against the real `/reference/area-creation`: Broad habitat
  (AC4), Habitat type including a "Not Possible" exclusion (AC6), Target condition (AC8),
  and Advance / Delay (AC10). AC3, AC5, AC7 and AC9 are left to
  `src/client/javascripts/created-area-details.test.js` in the frontend.
- **Validation:** shared GET contract on load; the form's own rules are in Step 11
- **On success:** Renders the Created area edit form
- **On error:** shared GET contract

---

### Step 5 — Edit Enhanced area habitat details (form, BMD-1045) `[IMPLEMENTED]`

- **Route:** shared GET contract (area feature whose normalised `retentionCategory === "Enhanced"`)
- **Template:** `src/server/habitat-details/pi-habitat-details-created-edit.njk`, the Step 4
  form (BMD-1045, frontend PR#518, 2026-11-17). It replaced the read-only
  `pi-habitat-details-enhanced.njk` (BMD-725), which is still the fallback while the
  backend does not serve the enhancement reference.
- **Backend endpoints:** shared GET contract, plus
  `GET /reference/area-enhancement?broadType=&type=&condition=` (backend PR#650) with the
  baseline's broad habitat, type and condition. It lists only the valid enhancements of that
  baseline (the BMD-820 import rules, from bng-library), each condition with its
  enhancement time to target. The frontend caches each baseline's answer.
- **Description:** **The Step 4 form, with these differences:**
  - Intervention reads **"Enhanced"**.
  - **Broad habitat** lists only broad habitats with at least one valid enhancement of the
    baseline; **Habitat type** only the types within the chosen broad habitat that have one;
    **Target condition** only the conditions that make a valid enhancement with the chosen
    type. For example, a Modified grassland (Moderate) baseline offers ten broad habitats,
    Grassland offers four types (no Bracken), and Modified grassland itself offers only Good
    and Fairly Good. A Mixed scrub (Poor) baseline offers only Heathland and shrub, and no Poor.
  - **Standard time to target condition** is the enhancement time, as the transition
    `"<baseline condition> to <target condition> - N years"`.
  - **"View baseline details"** finds the baseline as the read-only Enhanced page did
    (`viewOnlyBaselineFeatureId`), not by `parentFeatureId`.
  - A stored proposal the list no longer offers shows the default option (frontend PR#532,
    see Step 4). An IGGI habitat type is never offered, so a save clears it and leaves the
    habitat Incomplete with zero units.
  - Advance and Delay are labelled as on the Created form, as per Figma.
  - The Supporting information box sits below the units, holding the Enhanced habitat's own
    comment (BMD-1190).
- **Journey coverage (BMD-1045):** `post-intervention-habitat-details.spec.js`, "Enhanced area
  habitats — editing". H2-3 and H3 of `Post-intervention - complete.gpkg` cover the saved
  values, the option lists of two baselines and "View baseline details" (AC1, AC11). An
  import-incomplete H2-3 from `Post-intervention - missing proposed habitat data.gpkg` covers
  AC2: the import nulls its significance with its type, so only the reference and Broad
  habitat are filled. One test covers the enhancement lists as Broad habitat, Habitat type and
  Target condition change (AC4, AC6, AC8). The previews and buttons it shares with the Created
  form (AC3, AC5, AC7, AC9, AC10, AC13–AC15) are left to the Step 4 and Step 11 tests.
- **Validation:** shared GET contract on load; the form's own rules are in Step 11
- **On success:** Renders the Enhanced area edit form
- **On error:** shared GET contract

---

### Step 6 — Edit Enhanced hedgerow details (form, BMD-1046) `[IMPLEMENTED]`

- **Route:** shared GET contract (hedgerow feature whose normalised `retentionCategory === "Enhanced"`)
- **Template:** `src/server/habitat-details/pi-habitat-details-created-edit.njk`, the Step 7
  form (BMD-1046, frontend PR#526, 2026-11-17). It replaced BMD-733's read-only
  `pi-hedgerow-details-enhanced.njk`, which is still the fallback while the backend does not
  serve the enhancement reference.
- **Backend endpoints:** shared GET contract, plus `GET /reference/hedgerow-enhancement`
  (backend PR#660) with the baseline hedgerow. It lists only the hedgerow types and
  conditions that make a valid enhancement of that baseline (the BMD-820 import rules,
  including the metric's G-6 "Enhancement through Distinctiveness" type moves), each with its
  enhancement time to target. Save is a PUT to
  `/projects/{projectId}/post-intervention/hedgerows/{featureId}` (Step 11).
- **Description:** **The Step 7 form, with these differences:**
  - Intervention reads **"Enhanced"**, and the size row is **"Size (kilometres)"** (value
    without a unit suffix), as per Figma.
  - **Habitat type** lists only the types with a valid enhancement of the baseline; **Target
    condition** only the conditions that make one with the chosen type. A Poor Line of trees
    (HG018) offers Line of trees and Line of trees - associated with bank or ditch (Moderate
    and Good), and Native hedgerow with trees (Poor, Moderate and Good).
  - **Standard time to target condition** is the enhancement time, as the transition
    `"<baseline condition> to <target condition> - N years"`. A move to a type of higher
    distinctiveness takes the G-6 type-to-type time whatever the condition (12 years for
    Line of trees to Native hedgerow with trees).
  - Strategic significance offers only High (1.15) and Low (1). A significance rejected on
    import (HG032) shows the default option (frontend PR#532, see Step 4).
  - **"View baseline details"** is shown, with the Supporting information box below the units
    (BMD-1190).
- **Journey coverage (BMD-1046):** `post-intervention-habitat-details.spec.js`, "Enhanced
  hedgerow habitats — editing", on the all-unit-types pair. HG018 covers the saved values, the
  option lists and "View baseline details" (AC1, AC9), and the enhancement lists and times as
  Habitat type, Target condition and Advance / Delay change (AC4-AC6, AC8). HG032 covers the
  incomplete form (AC2). The saves are in Step 11. The previews and buttons it shares with
  the Created hedgerow form (AC3, AC7, AC11-AC13) are left to the Step 7 tests.
- **Validation:** shared GET contract on load; the form's own rules are in Step 11
- **On success:** Renders the Enhanced hedgerow edit form
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
  range shows the default option (frontend PR#532, see Step 4). Stored final-time
  text remains visible while its calculation inputs are unchanged.
  Created hedgerows keep valid stored-parent links; explicit null parents suppress them.
  Legacy non-template features without a parent field can still resolve a baseline by ref.
- **Validation:** shared Created form validation, including mutually exclusive positive
  advance/delay values and strict validation of newly selected years.
- **On success:** Save persists the edits, recalculated units/status and returns to the
  hedgerow list. Cancel and Upload discard local edits.
- **Journey coverage (BMD-1049):** `post-intervention-habitat-details.spec.js`. The HG013 test
  checks the derived values and the Strategic significance, Advance and Delay option lists
  (AC1, AC7). "Created hedgerow habitats — editing" covers an incomplete hedgerow from
  `Post-intervention - created hedgerow partly blank.gpkg` (AC2), and the in-browser
  previews against the real `/reference/hedgerow-creation`: Habitat type including a
  "Not Possible" exclusion and clearing it (AC4, AC5), Target condition (AC6), and Advance /
  Delay (AC8). AC3 is covered by the Cancel test. AC2 without a habitat type and AC7's
  dropdown change are left to `src/client/javascripts/created-hedgerow-details.test.js`.
- **On error:** Field errors redisplay the form. A 404 from the creation-reference endpoint
  during rollout renders the previous read-only page; other backend failures propagate.

---

### Step 8 — Edit Created watercourse details (form, BMD-1050) `[IMPLEMENTED]`

> **Since frontend PR#444 (BMD-1050, 2026-11-10)** a Created watercourse renders the shared
> Created edit form, `pi-habitat-details-created-edit.njk` (Step 4). The read-only page
> described below is now only the rollout fallback. The form has a **Length (km)** row, no Broad habitat, and **Watercourse
> encroachment** and **Riparian encroachment** dropdowns after Strategic significance. Save
> goes through Step 11. The read-only description below is kept as the BMD-739 record: the
> same values (km length, proposed-side encroachments, the short-form time to target)
> still show on the form. Journey coverage: `post-intervention-habitat-details.spec.js`,
> "non-retained watercourse habitats" (WC3 form shape, saved values and option lists, WC3
> transition values, R003 short form) and "Created watercourse habitats — editing" (Step 11).

- **Route:** shared GET contract (watercourse feature whose normalised `retentionCategory === "Created"`)
- **Template (read-only fallback):** `src/server/habitat-details/pi-watercourse-details-created.njk` (extends `layouts/pi-view-only-sections-page.njk`; BMD-739, frontend PR#187). Since PR#444 it renders only during rollout, when `GET /reference/watercourse-creation` answers 404 (`CREATED_EDIT_KINDS.watercourse.readOnlyTemplate`), the same fallback Created hedgerows use
- **Backend endpoints:** shared GET contract, plus `GET /reference/watercourse-creation` for the dropdowns
- **Description (read-only fallback):** Two-section stacked page, H1 = feature ref.
  - **Section 1 — "Post-intervention habitat details":** Intervention, **Length**, Habitat
    type, Distinctiveness, Condition, **Strategic significance**, **Watercourse
    encroachment**, **Riparian encroachment**. Note the order differs from the retained
    watercourse page in Step 3 — here Strategic significance sits **above** the two
    encroachment rows. Length carries its own `km` suffix (`formatLengthDisplay`).
  - **"View baseline details"** link after the first section, resolved by ref when a
    matching baseline exists. Created hedgerow edit forms use the parent rules in Step 7.
  - **Section 2 — "Time to target / difficulty":** the same six rows as Step 4.
  - Then the bordered "Habitat units delivered" row.
  - **Encroachment values read from `proposed`**, not baseline-first — for a created or
    enhanced watercourse the engine takes its encroachment inputs from the proposed side.
    This is the opposite of the retained watercourse page (Step 3).
  - Back link to the watercourses post-intervention page.

  Fixture note: the `created linear features` pair supplies the `N/A`-sentinel
  time-to-target case for watercourses (see Step 4's coverage note) through **R003** —
  Created, `Baseline Condition = "N/A"`, target `Fairly Poor`, so the row reads the short
  form `Fairly Poor - 2 years` (BMD-739 re-work). WC3 in `watercourses mixed retention`
  cannot stand in: it is Created _with_ a real baseline condition (`Moderate`), so it takes
  the transition branch and never reaches that code.

- **Validation:** shared GET contract
- **On success:** Renders the Created watercourse edit form
- **On error:** shared GET contract

---

### Step 9 — Edit Enhanced watercourse details (form, BMD-1047) `[IMPLEMENTED]`

- **Route:** shared GET contract (watercourse feature whose normalised `retentionCategory === "Enhanced"`)
- **Template:** `src/server/habitat-details/pi-habitat-details-created-edit.njk`, the Step 8
  form (BMD-1047, frontend PR#541, 2026-11-23; `ENHANCED_WATERCOURSE_KIND` in
  `watercourse-edit-kinds.js`). It replaced BMD-735's read-only
  `pi-watercourse-details-enhanced.njk`, which is still the fallback while the backend does not
  serve the enhancement reference.
- **Backend endpoints:** shared GET contract, plus `GET /reference/watercourse-enhancement`
  (backend PR#694) with the baseline watercourse's type and condition. It lists only the
  watercourse types and conditions that make a valid enhancement of that baseline (BMD-820
  AC9-AC10), each with its enhancement time to target. Save is a PUT to
  `/projects/{projectId}/post-intervention/watercourses/{featureId}` (Step 11).
- **Description:** **The Step 8 form, with these differences:**
  - Intervention reads **"Enhanced"**, and the size row is **"Size (kilometres)"** (value
    without a unit suffix), as per Figma.
  - **Habitat type** lists only the types with a valid enhancement of the baseline; **Target
    condition** only the conditions that make one with the chosen type. A Medium baseline
    (Ditches or Canals) keeps its type and offers only better conditions: the default site's
    R006, Canals Fairly Poor, offers Canals at Moderate, Fairly Good and Good. A Culvert (Low)
    baseline offers Ditches and Canals at all five conditions, never Culvert.
  - **Standard time to target condition** is the enhancement time, as the transition
    `"<baseline condition> to <target condition> - N years"`: the same-habitat lookup for a
    Medium baseline (Fairly Poor to Moderate - 2 years), and a fixed 10 years for a Culvert
    moved to Ditches or Canals.
  - **Watercourse encroachment** and **Riparian encroachment** offer every reference value,
    not limited by the enhancement rules, and each counts towards completeness.
  - A lineage advance is not restored, unlike a Created watercourse.
  - **"View baseline details"** is shown, with the Supporting information box below the units
    (BMD-1190).
  - An incomplete Enhanced watercourse shows `0.00` units on the form and the list (display
    only, frontend PR#541's `includeEnhanced`); it was blank before.
- **Journey coverage (BMD-1047):** `post-intervention-habitat-details.spec.js`, "BNG Service
  template watercourses". R006 of the default site covers the saved values, the option lists and
  "View baseline details" (AC1, AC11). R001 of `watercourse-enhanced-culvert.gpkg` covers a
  Culvert baseline's lists and the previews as Habitat type, Target condition and Advance /
  Delay change (AC1, AC3-AC6, AC10). R006 of `watercourse-proposed-encroachment-blank.gpkg`
  covers the incomplete form's lists and `0.00` units (AC2); the same project's list row and
  saved selections are checked in `watercourses-post-intervention.spec.js` (BNG Service template
  blank proposed encroachment, BMD-1088). The save is in Step 11. Significance, the
  encroachments, Cancel, validation and Upload file (AC7-AC9, AC13-AC15) share the Created
  watercourse form and are left to the Step 8 tests. On the legacy run, the all-unit-types R007
  and mixed-retention WC2 tests check the same form.
- **Validation:** shared GET contract on load; the form's own rules are in Step 11
- **On success:** Renders the Enhanced watercourse edit form
- **On error:** shared GET contract

---

### Step 10 — Unsupported feature placeholder `[IMPLEMENTED]`

- **Route:** shared GET contract (any feature type with no details page)
- **Template:** `src/server/habitat-details/pi-feature-unsupported.njk` (extends `layouts/page.njk` directly — neither view-only layout)
- **Backend endpoint:** shared GET contract
- **Description:** Individual trees rendered this until BMD-1172 (frontend PR#475, 2026-11-09)
  gave them the area page; the frontend's code comment names IGGIs, but an IGGI is an area
  habitat type, so no upload reaches this page today. Not journey-covered; frontend controller
  tests cover it.
  Renders the "Post-intervention habitat details" heading with the project name as caption
  and the message "Individual tree and IGGI features are not yet supported in this view."
  No rows, no baseline link, no units row. Back link to
  the area habitats post-intervention page (see Back link above).
- **Validation:** shared GET contract
- **On success:** Renders the placeholder page
- **On error:** shared GET contract

---

### Step 11 — Save Created or Enhanced area, hedgerow or watercourse details (BMD-1048/BMD-1049/BMD-1050/BMD-1045/BMD-1046/BMD-1047) `[IMPLEMENTED]`

- **Route:** `POST /post-intervention-habitat-details`
- **Template:** `pi-habitat-details-created-edit.njk` on a field-validation failure
- **Auth required:** Yes (session, approved BNG Completer role and CSRF protection)
- **Backend endpoints:** GET the post-intervention feature to check type/retention, load
  `/reference/area-creation` or `/reference/hedgerow-creation`, then PUT to
  `/projects/{projectId}/post-intervention/habitats/{featureId}` for areas or
  `/projects/{projectId}/post-intervention/hedgerows/{featureId}` for hedgerows.
  The backend validates the edit, uses shared enrichment and saves the feature, units and
  project totals. An incomplete feature does not contribute units. An incomplete Created
  **area** edit saves `units: 0` (backend PR#614, BMD-1048 AC11 Scenario B); imports and
  hedgerow edits keep `units: null`. Either way, the Created area and hedgerow lists and
  the edit form show `0.00` (frontend PR#465, the PO ruling of 2026-11-06), and so do the
  Enhanced area and hedgerow lists since frontend PR#532 (display only).
- **Description:** Both Step 4 and Step 7 forms post here. The handler:
  1. Validates UUIDs, editable strings and timing selections against the two Joi payload
     schemas. Timing selections can be blank, 0 to 30 or 30+.
     Areas require a broad habitat field; hedgerows forbid it. Malformed payloads return
     400 before backend requests; the type-specific missing-area-broad guard runs after
     fetching the feature and before loading reference data.
  2. Sends Retained features to Step 12, and refuses with 501 any feature that is neither
     Created nor an Enhanced area, hedgerow (BMD-1046) or tree (BMD-1172).
  3. Validates choices and mutually exclusive positive advance/delay. Errors redisplay
     entered values, summary links and inline messages, including delay-only errors.
  4. Sends valid edits to the type-specific backend PUT. Blank fields, and stored values the
     list does not offer (frontend PR#532), send null. The backend still accepts a value sent
     back as stored, but the frontend no longer sends one.
- **Validation:** References must be nonblank, valid UTF-8 and at most 99 characters once trimmed (BMD-1175).
  Habitat/condition/significance selections must be offered choices. Positive advance and
  delay cannot both be selected. Duplicate references and explicit blank dropdowns are
  allowed; missing calculation inputs leave the feature Incomplete.
- **On success:** 302 to the area or hedgerow post-intervention list, respecting a safe
  returnUrl. The reopened row shows persisted selections, recalculated units and status.
- **On error:** 400 for malformed payloads, 501 for unsupported feature categories,
  redisplay for field errors, or 503 when hedgerow creation reference data is not deployed.
  No PUT occurs on invalid input or the rollout-unavailable path.
- **Created watercourses (BMD-1050, frontend PR#444):** the Step 8 form posts here as well.
  Its edit also carries the **Watercourse encroachment** and **Riparian encroachment**
  choices, and has no broad habitat. It loads `/reference/watercourse-creation`, PUTs to
  `/projects/{projectId}/post-intervention/watercourses/{featureId}`, and on success
  returns to the watercourses post-intervention list. The rules above that name only areas
  and hedgerows predate BMD-1050. An incomplete Created watercourse edit saves `units: 0`
  (backend PR #630) with its derived values null, as a Created area does under the PO ruling
  of 2026-11-06; the list shows `0.00`, the type's distinctiveness and the saved significance
  (frontend PR #502), and a blank Standard difficulty.
- **Enhanced areas (BMD-1045, frontend PR#518 / backend PR#650, PR#659):** the Step 5 form
  posts here. It loads `/reference/area-enhancement` for the feature's baseline and PUTs to
  the same `/projects/{projectId}/post-intervention/habitats/{featureId}`, where the backend
  checks the choices against the baseline's valid enhancements (`ENHANCEMENT_NOT_VALID`,
  shown against Target condition). Units are recalculated as
  `(B + (T − B) × temporal × difficulty) × proposed strategic significance`, where B and T are
  area × distinctiveness × condition for the baseline and the target. An incomplete edit saves
  `0` units and Incomplete. After an incomplete save the list blanks Distinctiveness, Standard
  difficulty and both time-to-target columns, and shows Target condition with no score. That is
  the shape the 2026-11-06 PO ruling changed for Created areas; it is an open question for
  Enhanced areas.
- **Enhanced watercourses (BMD-1047, frontend PR#541 / backend PR#694):** the Step 9 form
  posts here. It loads `/reference/watercourse-enhancement` for the feature's baseline and PUTs
  to `/projects/{projectId}/post-intervention/watercourses/{featureId}`, where the backend checks
  the choices against the baseline's valid enhancements (shown against Target condition). Units
  are the enhanced-habitat formula on the baseline's length and the feature's own, times both
  encroachment multipliers. An incomplete edit saves `0` units and Incomplete, and the list shows
  `0.00`.
- **Journey coverage (BMD-1047, Enhanced watercourse):** "BNG Service template watercourses"
  covers a complete save that changes R006's condition and both encroachments (AC12 Scenario A:
  row, units and total). Scenario B, Cancel, validation and Upload file share the Created
  watercourse code and tests, and the `0.00` display is witnessed by the Step 9 incomplete tests.
- **Journey coverage (BMD-1045, Enhanced area):** "Enhanced area habitats — editing" covers a
  complete save that changes the habitat type, condition, significance and delay (AC12
  Scenario A: row, units and total). Scenario B awaits the list-display ruling above. Cancel,
  validation and Upload file share the Created area code and tests.
- **Journey coverage (BMD-1046, Enhanced hedgerow):** "Enhanced hedgerow habitats — editing"
  covers a complete save that renames HG018 and changes its type, condition, significance and
  delay (AC10 Scenario A: row, units and total), and a save with Strategic significance
  cleared (AC10 Scenario B: Incomplete, `0.00`, the total drops; the list's other derived
  columns await the same ruling as the Created hedgerow's). Scenario B with a null Advance,
  Cancel, validation and Upload file share the Created hedgerow code and tests.
- **Journey coverage (BMD-1048, Created area):** `post-intervention-habitat-details.spec.js`,
  "Created area habitats — editing". It covers a complete save (AC11 Scenario A), completing
  an import-incomplete habitat whose units go from null to calculated, a save with
  Target condition cleared (AC11 Scenario B), Cancel (AC12), both validation rules failing
  together (AC13) and Upload file with unsaved changes (AC14). Each save gets its own project.
  The other tests reuse the read-only `created-area` project and never save.
- **Journey coverage (BMD-1049, Created hedgerow):** `post-intervention-habitat-details.spec.js`,
  "Created hedgerow habitats — editing". It covers a complete save that moves the hedgerow
  total (AC9 Scenario A), a save with Target condition cleared (AC9 Scenario B, page and
  total only: the stored `units: null` differs from the AC's "zero is saved" and awaits a
  ruling), Cancel (AC10, with an AC3 reference change), both validation rules failing
  together (AC11), a duplicate reference saving (AC11, the only witness) and Upload file
  with unsaved changes (AC12). Each save gets its own project; the rest reuse the
  read-only `created-linear` project.
- **Journey coverage (BMD-1050, Created watercourse):** `post-intervention-habitat-details.spec.js`,
  "Created watercourse habitats — editing", on WC3. It covers an import-incomplete
  watercourse (AC2, form and list), type and condition previews (AC4-AC6), the two
  independent encroachments and significance (AC7-AC9), timing (AC10), a complete save with
  both encroachment multipliers (AC11 Scenario A), a save with Riparian encroachment cleared
  (AC11 Scenario B: Incomplete, `0.00`, the total drops), Cancel (AC12, with AC3), both
  validation rules (AC13), a duplicate reference saving (AC13, the only witness) and Upload
  file with unsaved changes (AC14). AC1's saved values and option lists are on the "non-retained
  watercourse habitats" form test. Each save gets its own project; the rest reuse the
  read-only `watercourses` project.

---

### Step 12 — Save a Retained habitat reference (BMD-1180) `[IMPLEMENTED]`

- **Route:** `POST /post-intervention-habitat-details`
- **Template:** the feature's Step 1, 2 or 3 page on a refused save
- **Auth required:** Yes (session, approved BNG Completer role and CSRF protection)
- **Backend endpoint:** `PUT /projects/{projectId}/post-intervention/features/{featureId}`, which
  takes `{ ref }` only.
- **Description:** The handler checks the payload against `retainedRefPayloadSchema`
  (`projectId`, `featureId`, `habitatRef`, optional `returnUrl`). An unchanged reference redirects
  without a backend call. Otherwise it sends the trimmed reference. The backend renames the
  baseline parcel the row is joined to and carries the new reference onto every post-intervention
  row joined to that parcel. A row with no resolvable parcel, or a service-template row, is
  renamed alone.
- **Validation:** A blank, whitespace-only or non-UTF-8 reference shows the error summary "You
  have entered an invalid habitat reference." and the inline message "Enter a valid habitat
  reference.", keeping what was typed. The input stops at 99 characters. A longer changed reference
  is refused with "Enter a habitat reference of 99 characters or fewer." (frontend PR#474,
  BMD-1175); until then the backend truncated it.
- **On success:** 302 to the feature type's post-intervention page, respecting a safe `returnUrl`.
- **On error:** 400 for a malformed payload or a refused reference.
- **Duplicate references depend on the template (decision 17 Nov 2026, backend PR#620, frontend
  PR#482):**
  - **Legacy (Natural England) template project:** a rename onto a reference another baseline
    habitat in the same layer carries (hedgerows and watercourses count as one layer) is refused
    with 422 `HABITAT_REF_IN_USE`, shown as 400 with the summary "Another habitat already has this
    habitat reference." and the inline message "Enter a habitat reference that no other habitat
    has." Nothing is saved; the input keeps what was typed and the H1 the saved reference.
  - **BNG Service template project:** no uniqueness check (`isTemplateUpload` in backend
    `apply-retained-ref-edit.js`); the row is renamed alone, since it joins its baseline habitat by
    feature ID and parent ID. Reachable only with `SERVICE_TEMPLATE_ENABLED=true`, so no journey
    test covers it here (BMD-1088).
  - Error wording for both rules is in frontend `error-text.yaml`, marked interim for UCD review.

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
is present; N/A baselines keep the short form. Unsupported imported timing shows the
default option and a save sends null (frontend PR#532).
Save uses PUT `/projects/{projectId}/post-intervention/hedgerows/{featureId}` and
returns to the hedgerow list. Incomplete units use the same null persistence as
import/resync. Created reference edits preserve the baseline parent separately.

Coverage: frontend unit tests cover dropdown previews, nulls, validation and the
rollout fallback; backend tests cover calculations and persistence. The two existing
HR3/HG013 journeys must witness the new form with real uploaded data and assert
the fixture lengths (24 m = 0.024km; 175.1389248737094 m geometry = 0.1751389km); a dedicated
project witnesses reference save/reload without mutating shared read-only fixtures.
