# Post-Intervention Habitat List User Flow

## Overview

A BNG Completer views the post-intervention habitat list page after uploading a
post-intervention GeoPackage file. The page shares the same template as the baseline
habitat list (`isPostIntervention: true`), which switches on the wider 7-column summary
table, the "Intervention type" column in each tab table, and the post-intervention summary
view model. The summary table has **four rows** (Site, Area habitats, Hedgerows,
Watercourses); "Trading rules satisfied" is the only column still rendered as an empty
string. The detail tab tables render real post-intervention feature data, with habitat type,
distinctiveness and condition resolved from each feature's `proposed` sub-object.

## Steps

### Step 1 — View post-intervention habitat list `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/post-intervention-habitat-list`
- **Template:** `src/server/habitat-list/habitat-list.njk` (shared with baseline, `isPostIntervention: true`)
- **Auth required:** Yes (session + approved BNG Completer role)
- **Backend endpoint:** `GET /projects/{id}` — fetches the project including
  `postIntervention.habitats`, `postIntervention.trees`, `postIntervention.hedgerows`,
  `postIntervention.watercourses`, `postIntervention.habitatSizes`,
  `postIntervention.units`, and `baseline.units` (for the summary's Baseline units column)
- **Description:** Renders the page header (back link, project name caption, H1 "On-site
  post intervention habitats"), a **"Summary"** section, an **"Habitat details"** section
  heading, a three-panel GOV.UK tabs component, and two buttons. Details below.

#### Summary table

Seven column headings: **Unit type, Size, Baseline units, Post-intervention units, Net unit
change, Net % change, Trading rules satisfied**. Four rows:

| Row               | Size                                          | Baseline units                     | Post-intervention units                    | Net unit change             | Net % change                          | Trading rules |
| ----------------- | --------------------------------------------- | ---------------------------------- | ------------------------------------------ | --------------------------- | ------------------------------------- | ------------- |
| **Site**          | `habitatSizes.site.totalSquareMetres`         | _(empty)_                          | _(empty)_                                  | _(empty)_                   | _(empty)_                             | _(empty)_     |
| **Area habitats** | `habitatSizes.areaHabitats.totalSquareMetres` | `baseline.units` habitats + trees  | `postIntervention.units` habitats + trees  | `habitatsNetUnitChange`     | `habitatsNetUnitChangePercentage`     | _(empty)_     |
| **Hedgerows**     | `habitatSizes.hedgerows.totalMetres`          | `baseline.units.hedgerowsTotal`    | `postIntervention.units.hedgerowsTotal`    | `hedgerowsNetUnitChange`    | `hedgerowsNetUnitChangePercentage`    | _(empty)_     |
| **Watercourses**  | `habitatSizes.watercourses.totalMetres`       | `baseline.units.watercoursesTotal` | `postIntervention.units.watercoursesTotal` | `watercoursesNetUnitChange` | `watercoursesNetUnitChangePercentage` | _(empty)_     |

**BMD-722 / BMD-167 `[IMPLEMENTED]` — summary formatting.** The Summary cells use their own
2-decimal-place formatters, deliberately independent of the tab tables' full-precision
footer Totals. **Do not expect a Summary cell and a tab-footer Total to match** — check the
formatter before treating a mismatch as a defect:

| Cell                    | Formatter                 | Output                                                                      |
| ----------------------- | ------------------------- | --------------------------------------------------------------------------- |
| Summary area Size       | `formatSummaryAreaSize`   | 2 dp + `ha` (e.g. `1.23ha`); empty string when the value is not a number    |
| Summary linear Size     | `formatSummaryLengthSize` | 2 dp + `km`; **`"No data"`** when the total is zero, missing or non-numeric |
| Summary units columns   | `formatHabitatUnits`      | 2 dp, capped at 7 sf; **empty** when the value is absent (never `0.00`)     |
| Summary Net % change    | `formatPercentage`        | `formatHabitatUnits` + `%` suffix; empty string when the value is absent    |
| Tab footer area Total   | `formatTotalAreaSize`     | 10 sf + `ha` — full precision                                               |
| Tab footer linear Total | `formatTotalLengthSize`   | 7 sf + `km`; **`"No data"`** when the total is zero or missing              |

The **Site** row is parcels only (excludes special habitats); **Area habitats** is the total
area size (parcels **plus** individual trees). Area-habitat Baseline units and
Post-intervention units are `habitatsTotal + treesTotal`, and stay **blank** (not `0.00`)
when both are `null`, so an un-calculated total is not misreported as zero.

#### Tabs

A GOV.UK tabs component with three panels, each a `moj-sortable-table` with a `Total` footer
row:

- **Areas tab** (`#area-habitats`): columns **Ref, Intervention type, Habitat type, Area,
  Distinctiveness, Condition, Units, Status**. Ref is a link to
  `/post-intervention-habitat-details?featureId={featureId}&projectId={id}`. Default sort:
  Ref ascending. **Individual trees are listed as their own rows here**, alongside parcels
  — the tab, its footer Total and the Area habitats summary row all span parcels + trees.
  Footer Total shows summed size (`formatTotalAreaSize`) and units. **BNG-528
  `[IMPLEMENTED]`:** the Units column shows the calculated BNG units per individual area
  habitat (e.g. a V.Low sealed-surface parcel calculates to `0.00`). The persisted project
  total `postIntervention.units.habitatsTotal` is **not surfaced in this UI** — it is
  covered by backend integration tests.
- **Hedgerows tab** (`#hedgerows`): columns **Ref, Intervention type, Habitat type, Length,
  Distinctiveness, Condition, Units, Status**. Shows "No hedgerow data uploaded." when there
  are no hedgerow features; the footer Total units cell shows `"No data"` in that case.
  **BNG-529 `[IMPLEMENTED]`:** per-hedgerow calculated units, summed in the footer. (No
  shipped post-intervention fixture contains hedgerows; the journey test uses a synthesised
  `Post-intervention - complete with hedgerows.gpkg` held only in this repo's
  `test/example-files/`.)
- **Watercourses tab** (`#watercourses`): columns **Ref, Intervention type, Habitat type,
  Size, Distinctiveness, Condition, Units, Status**. Shows "No watercourse data uploaded."
  when there are no watercourse features. **BNG-530 `[IMPLEMENTED]`:** per-watercourse
  calculated units, summed in the footer. (Fixture:
  `Post-intervention - complete with watercourses.gpkg`, likewise repo-local.)

Column-level behaviour common to all three tabs:

- **BMD-845 `[IMPLEMENTED]` — Intervention type** (second column, between Ref and Habitat
  type) shows the feature's normalised retention category via
  `interventionDisplay(feature.retentionCategory)` — a leading `"N. "` list prefix is
  stripped ("2. Created" → "Created") — defaulting to **"Retained"** when no category was
  persisted at import. Baseline rows omit this column entirely.
- **BMD-531 `[IMPLEMENTED]` — Status** (last column) shows the per-feature status assigned
  by the backend at import: **"Complete"** when every value required to calculate units was
  present (a Complete row always shows a calculated Units value), or **"Incomplete"** when
  one or more were missing (an Incomplete row shows an empty Units cell). Applies to area
  habitats, hedgerows and watercourses alike. (No shipped fixture passes validation while
  missing unit-calculation values; the journey test uses
  `Post-intervention - mixed complete and incomplete.gpkg`, a copy of the backend
  integration fixture `baseline-complete.gpkg`, held in this repo's `test/example-files/` —
  its Enhanced parcels lack proposed type/condition and its linear features lack retention
  categories, yielding Incomplete alongside a Complete Retained parcel.)
- Display fields (habitat type, distinctiveness, condition) are resolved from the feature's
  `proposed` sub-object via `resolveProposedDisplayFields`; baseline rows read the top-level
  properties instead.

#### Actions

- A **"Continue"** button navigating to `/add-project-details/{id}`.
- An **"Upload a different file"** secondary button navigating to the file-type selection
  page — `/projects/{id}/upload-file?returnUrl=%2Fprojects%2F{id}%2Fpost-intervention-habitat-list`
  (BMD-850, frontend PR#207; built by
  `uploadFileHref(id, '/projects/{id}/' + uploadType.listRoute)`). It pointed straight at
  `/projects/{id}/upload-post-intervention-file` before that change, so the user now picks
  the file type first, and Back/Cancel on the upload form return **here** rather than to the
  task list. Because the task-list row shows "Completed" (linking to this page) once
  post-intervention data exists, this button is the **only** UI route back to a re-upload.
- Back link navigates to `/add-project-details/{id}` (same target as Continue).

- **BMD-898 changed how Ref cells and linear "No data" states are built (frontend PR#233, 2026-08-24).** The rendered page looks much the same; the markup and the empty-state trigger do not.

  | Aspect            | Before                                          | Now                                                                       |
  | ----------------- | ----------------------------------------------- | ------------------------------------------------------------------------- |
  | Ref cell          | pre-built `html` string interpolating the `<a>` | `{ text, href }`, with the `habitatTableCell` macro rendering the link    |
  | Ref value         | `feature.ref` verbatim                          | `feature.ref` trimmed, falling back to **`feature.featureId`** when blank |
  | Linear "No data"  | `features?.length` on the row array             | `hasHabitatData(habitatsData, type)` on the habitat data itself           |
  | Empty linear size | rendered a bare `"km"`                          | renders **`''`**                                                          |

  Consequences for tests: an assertion reading a Ref cell's inner HTML now sees a plain `<a>` built by the macro rather than an interpolated string, and `data-sort-value` carries the same fallback value as the visible text. A feature with a blank or whitespace-only `ref` now shows its `featureId` instead of an empty cell. A linear size with no measurement renders empty rather than a unit-only `"km"` — so an assertion that a cell "contains km" passes on real data and fails on missing data, where before it passed on both.

- **Validation:**
  - `id` path param must be a valid UUID v4 → 400 if invalid
  - Approved BNG Completer role required → redirects to `/auth/forbidden` if missing
  - Unauthenticated → redirects to sign-in
- **On success:** Renders the post-intervention habitat list page
- **On error:** 400 for invalid UUID `id`
