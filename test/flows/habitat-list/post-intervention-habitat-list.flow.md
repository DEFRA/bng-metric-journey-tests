# Post-Intervention Habitat List User Flow

## Overview

A BNG Completer views the post-intervention habitat list page after uploading a
post-intervention GeoPackage file. This is currently a skeleton page: the
summary table and tabs render, but unit/area data and the Continue button are
not yet wired up.

## Steps

### Step 1 — View post-intervention habitat list `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/post-intervention-habitat-list`
- **Template:** `src/server/habitat-list/habitat-list.njk` (shared with baseline, `isPostIntervention: true`)
- **Auth required:** Yes (session + BNG Completer role)
- **Description:** Renders the page header (back link, project name caption, H1 title), a "Summary" section with column headings and row labels (Area habitats, Hedgerows, Watercourses), a GOV.UK tabs component with three panels (Areas, Hedgerows, Watercourses) with working tab-switching, a "Continue" button (`href="#"`, stub, no functionality), and an "Upload a different file" secondary button linking to `/projects/{id}/upload-post-intervention-file`.
- **Validation:**
  - `id` path param must be a valid UUID v4 → 400 if invalid
  - BNG Completer role required → redirects to `/auth/forbidden` if missing
  - Unauthenticated → redirects to sign-in
- **On success:** Renders the skeleton page
- **On error:** 400 for invalid UUID `id`
