# Habitat List User Flow

## Overview

A BNG Completer views the on-site baseline habitats imported from a GeoPackage file.
The page summarises total sizes and units across three tabs (Areas, Hedgerows, Watercourses).
Each tab shows a sortable table of features linking to the habitat-details edit page; the
Hedgerows and Watercourses tabs each show a "No [type] data uploaded." message when no
features of that type are present.

## Steps

### Step 1 — View habitat list `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/baseline-habitat-list`
- **Template:** `src/server/habitat-list/habitat-list.njk` (shared with post-intervention, `isPostIntervention: false`)
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** `GET /projects/{id}` — fetches project including `baseline.habitats`, `baseline.hedgerows`, `baseline.watercourses`, `baseline.habitatSizes`, `baseline.units`
- **Description:** Renders a summary table (area habitats, hedgerows, watercourses — size and units) and a GOV.UK tabs component with three panels:
  - **Areas tab** (`#area-habitats`): sortable table — Ref (link to `/baseline-habitat-details?featureId={featureId}&projectId={id}`), Habitat type, Area, Distinctiveness, Condition, Units, Status. Default sort: Ref ascending. Footer row shows Total with summed size and units.
  - **Hedgerows tab** (`#hedgerows`): sortable table — Ref (link to `/baseline-habitat-details?featureId={featureId}&projectId={id}`), Habitat type, Length, Distinctiveness, Condition, Units, Status. Default sort: Ref ascending. Footer row shows Total with summed size and units. Shows "No hedgerow data uploaded." when `hedgerowRows` is null (i.e. `baseline.hedgerows` is absent or empty — the controller uses `hedgerows?.length ? ... : null`, not an empty-array pass-through).
  - **Watercourses tab** (`#watercourses`): sortable table — Ref, Habitat type, Size, Distinctiveness, Condition, Units, Status. Default sort: Ref ascending. Footer row shows Total with summed size and units. Shows "No watercourse data uploaded." when `watercourseRows` is null (same null-guard pattern).

  - The size column header carries no unit; the unit is appended to each row value instead — Area values render as `{n}ha`, Length/Size values as `{n}km`. The Units column is a bare 2-decimal-place number.
  - A "Continue" button navigating to `/add-project-details/{id}` and an **"Upload a different file"** button navigating to the file-type selection page — `/projects/{id}/upload-file?returnUrl=%2Fprojects%2F{id}%2Fbaseline-habitat-list` (BMD-850, frontend PR#207; built by `uploadFileHref(id, '/projects/{id}/' + uploadType.listRoute)`). It pointed straight at `/projects/{id}/upload-baseline-file` before that change, so the user now picks the file type first and Back/Cancel on the upload form return **here**, not to the task list.
  - Back link navigates to `/add-project-details/{id}`.
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
  - BNG Completer role required → redirects to `/auth/forbidden` if missing
  - Unauthenticated → redirects to sign-in
- **On success:** Renders the habitat list page
- **On error:** 400 for invalid UUID `id`
