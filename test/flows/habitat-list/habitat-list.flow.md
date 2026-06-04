# Habitat List User Flow

## Overview

A BNG Completer views the on-site baseline habitats imported from a GeoPackage file.
The page summarises total sizes and units, lists area habitats in a sortable table
(with status), and provides navigation to edit individual habitats or re-upload.

## Steps

### Step 1 — View habitat list `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/baseline-habitat-list`
- **Template:** `src/server/baseline-habitat-list/baseline-habitat-list.njk`
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** `GET /projects/{id}` — fetches project including `baseline.habitats`, `baseline.habitatSizes`, `baseline.units`
- **Description:** Renders a summary table (area habitats, hedgerows, watercourses — size and units) and a GOV.UK tabs component. The Areas tab displays a sortable table of area habitats with columns: Ref (link to `/baseline-habitat-details?habitatId={featureId}&projectId={id}`), Habitat type, Area (ha), Distinctiveness, Condition, Units, Status (Complete / Incomplete). The Hedgerows and Watercourses tabs are currently UI placeholders (`<div></div>`). Back link navigates to `/add-project-details/{id}`. An "Upload a different file" button navigates to `/projects/{id}/upload-baseline-file`.
- **Validation:**
  - `id` path param must be a valid UUID v4 → 400 if invalid
  - BNG Completer role required → redirects to `/auth/forbidden` if missing
  - Unauthenticated → redirects to sign-in
- **On success:** Renders the habitat list page
- **On error:** 400 for invalid UUID `id`
