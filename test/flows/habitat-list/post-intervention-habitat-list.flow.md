# Post-Intervention Habitat List User Flow

## Overview

A BNG Completer views the post-intervention habitat list page after uploading a
post-intervention GeoPackage file. The page shares the same template as the baseline
habitat list (`isPostIntervention: true`). The summary table has 7 columns but values
are not yet populated (empty strings). The detail tab tables render real post-intervention
feature data, with habitat type, distinctiveness, and condition resolved from each
feature's `proposed` sub-object.

## Steps

### Step 1 — View post-intervention habitat list `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/post-intervention-habitat-list`
- **Template:** `src/server/habitat-list/habitat-list.njk` (shared with baseline, `isPostIntervention: true`)
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** `GET /projects/{id}` — fetches project including `postIntervention.habitats`, `postIntervention.hedgerows`, `postIntervention.watercourses`, `postIntervention.habitatSizes`, `postIntervention.units`
- **Description:** Renders the page header (back link, project name caption, H1 "On-site post intervention habitats"), a "Summary" section with 7 column headings (Unit type, Size, Baseline units, Post-intervention units, Net unit change, Net % change, Trading rules satisfied) and row labels (Area habitats, Hedgerows, Watercourses) — all value columns are currently empty strings. Below the summary, a GOV.UK tabs component with three panels:
  - **Areas tab** (`#area-habitats`): sortable table — Ref (link to `/post-intervention-habitat-details?featureId={featureId}&projectId={id}`), Habitat type, Area, Distinctiveness, Condition, Units, Status. Display fields resolved via `proposed` sub-object. Default sort: Ref ascending. Footer row shows Total with summed size and units. **BNG-528 `[IMPLEMENTED]`:** the Units column shows the calculated BNG units per individual area habitat (e.g. a V.Low sealed-surface parcel calculates to 0.00) and the footer Total sums them. The persisted project total `postIntervention.units.habitatsTotal` is **not surfaced in this UI** — it is covered by back-end integration tests.
  - **Hedgerows tab** (`#hedgerows`): sortable table — Ref, Habitat type, Length, Distinctiveness, Condition, Units, Status. Same proposed-field resolution. Footer row shows Total. Shows "No hedgerow data uploaded." when no hedgerow features. **BNG-529 `[IMPLEMENTED]`:** the Units column shows the calculated BNG units per individual hedgerow and the footer Total sums them. The persisted project total `postIntervention.units.hedgerowsTotal` is **not surfaced in this UI** — it is covered by back-end integration tests. (No shipped post-intervention fixture contains hedgerows; the journey test uses a synthesised `Post-intervention - complete with hedgerows.gpkg` held only in this repo's `test/example-files/`.)
  - **Watercourses tab** (`#watercourses`): sortable table — Ref, Habitat type, Size, Distinctiveness, Condition, Units, Status. Same proposed-field resolution. Footer row shows Total. Shows "No watercourse data uploaded." when no watercourse features. **BNG-530 `[IMPLEMENTED]`:** the Units column shows the calculated BNG units per individual watercourse and the footer Total sums them. The persisted project total `postIntervention.units.watercoursesTotal` is **not surfaced in this UI** — it is covered by back-end integration tests. (No shipped post-intervention fixture contains watercourses; the journey test uses a synthesised `Post-intervention - complete with watercourses.gpkg` held only in this repo's `test/example-files/`.)
  - **BMD-531 `[IMPLEMENTED]`:** the Status column (last column of all three tab tables) shows the per-feature status assigned by the backend at import: "Complete" when every value required to calculate units was present (a Complete row always shows a calculated Units value), or "Incomplete" when one or more values are missing (an Incomplete row shows an empty Units cell). Applies to area habitats, hedgerows and watercourses alike. (No shipped fixture passes validation while missing unit-calculation values; the journey test uses `Post-intervention - mixed complete and incomplete.gpkg`, a copy of the backend integration fixture `baseline-complete.gpkg`, held in this repo's `test/example-files/` — its Enhanced parcels lack proposed type/condition and its linear features lack retention categories, yielding Incomplete alongside a Complete Retained parcel.)
  - A "Continue" button navigating to `/add-project-details/{id}` and an "Upload a different file" secondary button navigating to `/projects/{id}/upload-post-intervention-file`.
  - Back link navigates to `/add-project-details/{id}`.
- **Validation:**
  - `id` path param must be a valid UUID v4 → 400 if invalid
  - BNG Completer role required → redirects to `/auth/forbidden` if missing
  - Unauthenticated → redirects to sign-in
- **On success:** Renders the post-intervention habitat list page
- **On error:** 400 for invalid UUID `id`
