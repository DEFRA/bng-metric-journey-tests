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
  - A "Continue" button navigating to `/add-project-details/{id}` and an "Upload a different file" button navigating to `/projects/{id}/upload-baseline-file`.
  - Back link navigates to `/add-project-details/{id}`.
- **Validation:**
  - `id` path param must be a valid UUID v4 → 400 if invalid
  - BNG Completer role required → redirects to `/auth/forbidden` if missing
  - Unauthenticated → redirects to sign-in
- **On success:** Renders the habitat list page
- **On error:** 400 for invalid UUID `id`
