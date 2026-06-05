# Habitat List User Flow

## Overview

A BNG Completer views the on-site baseline habitats imported from a GeoPackage file.
The page summarises total sizes and units across three tabs (Areas, Hedgerows, Watercourses).
Each tab shows a sortable table of features linking to the habitat-details edit page;
the Watercourses tab shows "No watercourse data uploaded." when none are present.

## Steps

### Step 1 — View habitat list `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/baseline-habitat-list`
- **Template:** `src/server/baseline-habitat-list/baseline-habitat-list.njk`
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** `GET /projects/{id}` — fetches project including `baseline.habitats`, `baseline.hedgerows`, `baseline.watercourses`, `baseline.habitatSizes`, `baseline.units`
- **Description:** Renders a summary table (area habitats, hedgerows, watercourses — size and units) and a GOV.UK tabs component with three panels:
  - **Areas tab** (`#area-habitats`): sortable table with columns Ref (link to `/baseline-habitat-details?featureId={featureId}&projectId={id}`), Habitat type, Area (ha), Distinctiveness, Condition, Units, Status.
  - **Hedgerows tab** (`#hedgerows`): sortable table with the same columns except "Length (km)" instead of "Area (ha)"; Ref links to `/baseline-habitat-details?featureId={featureId}&projectId={id}`.
  - **Watercourses tab** (`#watercourses`): sortable table with a "Size" column; shows "No watercourse data uploaded." when no watercourse rows are present.
  - A "Continue" button (`href="#"`, currently a stub) and an "Upload a different file" button navigating to `/projects/{id}/upload-baseline-file`.
  - Back link navigates to `/add-project-details/{id}`.
- **Validation:**
  - `id` path param must be a valid UUID v4 → 400 if invalid
  - BNG Completer role required → redirects to `/auth/forbidden` if missing
  - Unauthenticated → redirects to sign-in
- **On success:** Renders the habitat list page
- **On error:** 400 for invalid UUID `id`
