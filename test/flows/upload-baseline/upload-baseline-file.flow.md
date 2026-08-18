# Upload Baseline File User Flow

## Overview

A BNG Completer uploads a GeoPackage (.gpkg) file containing the on-site baseline habitat
data for a project. The file is submitted directly to the CDP Uploader service; the app
then polls for upload status, validates the file via the backend, and routes the user
to the project summary on success (BMD-870 — it was the baseline habitat list before),
or a structured error dropout page on failure.

The baseline and post-intervention upload journeys now share parameterised controllers and
templates (keyed by `HABITAT_UPLOAD_TYPES`); the post-intervention variant is documented in
its own flow doc.

## Entry point

**BMD-850 (frontend PR#207) put a file-type selection page in front of this flow.** The
project task list's "On-site baseline habitats" row (while `project.baseline` is absent) and
the baseline habitat list's "Upload a different file" button both now link to
`GET /projects/{id}/upload-file` — **not** straight to the upload form. The user picks
"Baseline Biodiversity Net Gain GeoPackage (.gpkg) file" there and is redirected into Step 1
below with a `returnUrl` query param. See
[`test/flows/upload-file/choose-upload-type.flow.md`](../upload-file/choose-upload-type.flow.md).

The upload form remains directly reachable by URL, so Step 1 is still testable on its own —
but a test that navigates the **UI** now passes through the selection page first.

## Steps

### Step 1 — View file upload form `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/upload-baseline-file?returnUrl={returnUrl}` (`returnUrl` optional)
- **Template:** `src/server/habitat-upload-file/habitat-upload-file.njk` (shared; controller is `createUploadFileController(HABITAT_UPLOAD_TYPES.baseline)`)
- **Auth required:** Yes (session + approved BNG Completer role — Defra ID enrolment status 3, scoped to `currentRelationshipId` when present)
- **Backend endpoints:**
  - `GET /projects/{id}` — fetches project name for the caption
  - `POST /upload/initiate` — creates a CDP upload session; returns `uploadId` and `uploadUrl`
- **Description:** Renders a GOV.UK file-upload form whose `action` points directly to the CDP Uploader URL (not the app). The handler reads and immediately clears any `uploadError` flash from the session (set by previous failed/timed-out attempts) and stores the new `uploadId` in the session as `pendingUploadId`. The response sets `Cache-Control: no-store` to ensure the short-lived upload URL is always fresh. **Back link and Cancel link both navigate to the file-type selection page** — `uploadFileHref(projectId, safeUploadReturnUrl(request.query.returnUrl, projectId))`, i.e. `/projects/{projectId}/upload-file?returnUrl=<safe>` (BMD-850, frontend PR#207). They pointed at `/add-project-details/{projectId}` before that change; that path is now only what the sanitised `returnUrl` **defaults** to when none is supplied. The controller delegates to the shared upload-file factory; upload metadata sent to the CDP Uploader includes `uploadType: 'baseline'`, and backend calls forward the user's Defra ID bearer via `backendRequest` (BMD-511).
- **Validation:** None (display-only). If `uploadUrl` is absent the template renders a fallback message ("Unable to start file upload") instead of the form.
- **Route parameters:** `{id}` is **not** validated (no Joi `params` schema on this route). A non-UUID id does not 400 — `GET /projects/{id}` fails, the caption falls back to "Project", and the form still renders. The same applies to `upload-received`. (Contrast `/projects/{id}/upload-file`, which **does** require a uuidv4.)
- **Query parameters:** `returnUrl` is read from `request.query` but is **not** Joi-validated; it is sanitised by `safeUploadReturnUrl` (must start with a single `/`, no `\`), falling back to `/add-project-details/{projectId}`.
- **On success:** Renders the file-upload form
- **On error:** Renders the form with the session flash error message in a GOV.UK error summary (then cleared)

---

### Step 2 — Submit file to CDP Uploader `[IMPLEMENTED]`

- **Route:** `POST <uploadUrl>` (external — CDP Uploader service, not this app)
- **Template:** N/A
- **Auth required:** N/A (handled by the CDP Uploader)
- **Backend endpoint:** N/A
- **Description:** The browser submits the multipart form directly to the CDP Uploader. The uploader processes the file and redirects the browser to the `redirect` URL registered at session initiation: `GET /projects/{id}/upload-received`.
- **Validation:** CDP Uploader rejects files that fail MIME-type or size checks; the outcome is reflected as `rejected` status on the status endpoint (resolved in Step 3).
- **On success:** Browser is redirected to `GET /projects/{id}/upload-received`
- **On error:** Upload status becomes `rejected`; handled in Step 3

---

### Step 3 — Poll upload and validation status `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/upload-received`
- **Template:** `src/server/upload-received/upload-received.njk`
- **Auth required:** Yes (session + approved BNG Completer role — Defra ID enrolment status 3, scoped to `currentRelationshipId` when present)
- **Backend endpoints:**
  - `GET /upload/{uploadId}/status` — polls upload status (treats `numberOfRejectedFiles > 0` as `rejected`)
  - `POST /baseline/validate/{uploadId}` (body: `{ projectId }`) — triggered once status is `ready`; validates the file contents and persists the baseline; forwards the user's Defra ID bearer via `backendRequest`. Content validation includes a distinctiveness-scope check (BMD-352): any habitat — area habitats, hedgerows, or watercourses — whose distinctiveness is **High** or **Very high** is rejected with error code `HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE` (the error names the offending feature ref; allowed bands are Medium, Low, Very low). This drives the structured-error branch below. Content validation also rejects (BMD-883) any habitat that sets **both** "Habitat created in advance/years" and "Delay in starting habitat creation/years" — error code `ADVANCE_AND_DELAY_BOTH_SET` — naming the offending feature refs; use one or the other, not both.
- **Description:** Rendered by the shared `createUploadReceivedController(HABITAT_UPLOAD_TYPES.baseline, validateBaseline)` factory. The template renders a "Checking your file" message with a `<meta http-equiv="refresh" content="5">` tag so the browser re-hits the handler every 5 seconds. On each request the handler checks `pendingUploadId` from the session, polls upload status, and tracks elapsed time in `uploadStartedAt`. Once status is `ready` it calls baseline validation and clears both session keys. The rejected and structured-error branches also set `validationUploadType = 'baseline'` in session (consumed by the shared error-file page). Possible outcomes are listed below.
- **Validation / branching:**
  - `pendingUploadId` missing → redirect to `GET /projects/{id}/upload-baseline-file`
  - Status `rejected` → clear session keys, set empty `baselineValidationErrors` and `baselineValidationErrorsProjectId` in session, redirect to `GET /error-file`
  - Status `ready` + validation invalid + error code is `GPKG_INVALID_FILE` or `GPKG_NOT_A_GEOPACKAGE` → set `uploadError` flash "The selected file must be a GeoPackage (.gpkg)" → redirect to upload form
  - Status `ready` + validation invalid + other error codes (e.g. `HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE`, `PARCEL_OVERLAPS`, `AREA_PARCELS_OUTSIDE_REDLINE`) → store structured `baselineValidationErrors` and `baselineValidationErrorsProjectId` in session → redirect to `GET /error-file`
  - Status `ready` + validation passes → redirect to `GET /projects/{id}/project-summary` (**changed by BMD-870** — see below)
  - Elapsed > 120 seconds → clear session keys, set `uploadError` flash "The file check timed out. Please try again." → redirect to upload form
  - Any other status (e.g. `pending`, `unknown`, `error`) → re-render the polling page
- **On success:** Redirects to `GET /projects/{id}/project-summary`

  **BMD-870 (frontend PR#219, 2026-08-14).** This was `GET /projects/{id}/baseline-habitat-list` until BMD-870. `HABITAT_UPLOAD_TYPES.baseline` gained `successRoute: 'project-summary'`, and the shared received-controller now redirects to `` `/projects/${projectId}/${uploadType.successRoute ?? uploadType.listRoute}` ``. The post-intervention upload type has **no** `successRoute`, so it is unaffected and still lands on its habitat list.

  The summary renders for any project with a baseline (BMD-852 widened its guard from baseline-only), so this redirect always lands on a rendered page. Backend BMD-850 (`a2f2985`) additionally deletes `postIntervention` from the project JSONB on baseline replacement, so a replacement returns the project to the summary's baseline-only variant. See [`../project-management/project-summary.flow.md`](../project-management/project-summary.flow.md).

- **On error:** Redirects to `GET /error-file` (structured errors) or `GET /projects/{id}/upload-baseline-file` (format / timeout flash errors)

---

### Step 4 — View validation error dropout page `[IMPLEMENTED]`

- **Route:** `GET /error-file`
- **Template:** `src/server/error-file/index.njk`
- **Auth required:** Yes (session required)
- **Backend endpoint:** None
- **Description:** The page is shared by the baseline and post-intervention flows. It reads
  `validationUploadType` from the session to select the upload type (defaulting to baseline),
  then reads that type's structured-error array and projectId — for baseline these remain
  `baselineValidationErrors` and `baselineValidationErrorsProjectId`. It clears all upload-type
  session keys immediately so a refresh does not re-display stale data. The page then renders
  one of three layouts depending on the error array:
  1. **Exactly one error (BMD-405):** a dedicated single-error page whose H1 and body copy are
     resolved per error code (`error-file/single-error-copy.js`, copy verbatim from the BMD-405
     ACs). Three variants:
     - `standard` — H1 (personalised with the offending feature ref(s) for
       `AREA_PARCELS_INVALID_GEOMETRY`, `PARCEL_OVERLAPS`, `AREA_PARCELS_TOO_SMALL`,
       `AREA_PARCELS_OUTSIDE_REDLINE`, `HEDGEROWS_OUTSIDE_REDLINE`,
       `WATERCOURSES_OUTSIDE_REDLINE`; otherwise
       "Your Geopackage (.gpkg) file contains an error") plus an instruction sentence ending in
       an inline "upload a new file" link back to the upload form. When projectId is unknown the
       link is dropped and the sentence is closed with a full stop.
     - `PARCEL_OVERLAPS` specifically falls back to different body copy ("Some parcels in this
       file are overlapping. Draw the affected parcels again and…") — not the generic catch-all
       — when the sample doesn't carry both `feature_ref_a`/`feature_ref_b` (or `_a`/`_b` `fid`)
       values, keeping the generic H1 in that case too.
     - `distinctiveness` — `HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE` renders H1 "Very high and high
       distinctiveness habitats are not yet included in this service" and a link to the statutory
       biodiversity metric tool on GOV.UK (opens in a new tab).
     - `placeholder` — `REDLINE_OUTSIDE_ENGLAND`, `REDLINE_AREA_TOO_LARGE`,
       `IGGIS_OUTSIDE_REDLINE`, `TREES_OUTSIDE_REDLINE`, `AREA_SUM_MISMATCH` render
       "PLACEHOLDER (AWAITING UCD)" + the raw backend message, pending BMD-592.
     - Any unmapped code falls back to the AC1 catch-all copy ("The layer names and column names
       do not match what is required by Natural England…").
     - The page title is set to the single-error H1. The exactly-one check runs on the
       de-duplicated `visibleErrors` list (fixed in frontend PR#160) — i.e. it is judged
       **after** the sliver-suppression rule below, since `AREA_PARCELS_OUTSIDE_REDLINE`
       always co-fires with a correlated `SLIVERS_OUTSIDE_REDLINE` for the same escaping
       geometry, and checking the raw array left AC10's personalised copy unreachable.
     - **Where this is tested.** `resolveSingleErrorCopy` is a pure function, unit-tested
       exhaustively over all 20 error codes in
       `../bng-metric-frontend/src/server/error-file/single-error-copy.test.js` — including
       codes no GeoPackage fixture can reach alone (`SLIVERS_OUTSIDE_REDLINE`,
       `IGGIS_OUTSIDE_REDLINE`, `TREES_OUTSIDE_REDLINE`, `REDLINE_AREA_TOO_LARGE`,
       `AREA_PARCELS_TOO_SMALL`) and the `PARCEL_OVERLAPS` missing-ref fallback above.
       The journey suite therefore carries **one upload per rendered variant**
       (standard, catch-all, personalised, placeholder) to prove the resolver is wired
       into the page, not one per code. Do not add a fixture-backed journey test for a
       code purely to assert its copy — extend the unit test instead.
  2. **Multiple errors:** GOV.UK error summary plus error blocks grouped by error code; each block
     renders a heading, an optional note (e.g. allowed distinctiveness bands, display-mapped
     "V.High" → "Very high"), and a bulleted list of offending features with an "… and N more"
     tail when the backend truncated the sample. `AREA_PARCELS_TOO_SMALL` lists each offending
     parcel with its measured area (e.g. "Feature Ref H002 — ~0.81 sq m"). Suppression rule: when
     `AREA_PARCELS_OUTSIDE_REDLINE` is present, `SLIVERS_OUTSIDE_REDLINE` errors are hidden.
     **Where this is tested.** The block headings are the backend's own `error.message`, split
     on `': '` and rendered verbatim — they are built and unit-tested in
     `../bng-metric-backend/src/validation/geopackage/postgis/error-builders.js` /
     `error-builders.test.js`, and each underlying rule is detected against a real PostGIS in
     `../bng-metric-backend/integration-tests/postgis-validate-baseline-layers.test.js`. The
     "… and N more" truncation is unit-tested in
     `../bng-metric-frontend/src/server/error-file/controller.test.js`. The journey suite carries
     a parcel-level and a redline-level upload for this layout, plus the `AREA_PARCELS_TOO_SMALL`
     per-parcel detail rendering and the sliver-suppression rule — not one upload per gate.
  3. **Empty array (e.g. rejected upload):** generic "We couldn't accept your file" message.
     All layouts offer "Upload a different file" (back to the upload form) and "Back to project"
     links when `projectId` is known, or "Back to start" otherwise.
- **Validation:**
  - Session error array absent or empty → generic fallback message
  - Exactly one visible error (post-suppression) → single-error layout (per-code copy); two or
    more → grouped blocks layout
  - `projectId` absent → project-specific action links replaced with a "Back to start" root link,
    and the single-error inline upload link is trimmed to a plain sentence
- **On success:** Renders the error dropout page
- **On error:** N/A

---

### Replacing a baseline discards post-intervention data — BMD-850 `[IMPLEMENTED]`

Backend BMD-850 (PR#219) changed `setProjectBaseline`
(`bng-metric-backend/src/db/persist-project.js`) to write the new baseline **and delete the
`postIntervention` key** in a single JSONB update (`${withBaseline} - 'postIntervention'`),
alongside the geometry cleanup in the same upload transaction. Previously the stored
post-intervention document was re-enriched against the new baseline
(`re-enrich-stored-post-intervention.js`, now deleted).

So a **second successful baseline upload wipes any post-intervention data already imported**
for that project. Visible effects:

- Task list "On-site post intervention habitats" reverts from "Completed" to "Not yet
  started", and its link flips back to `/projects/{id}/upload-file`.
- `/projects/{id}/post-intervention-habitat-list` renders with empty tabs and no summary
  figures.
- The post-intervention selection on `/projects/{id}/upload-file` becomes available again
  (its baseline precondition is satisfied by the new baseline).

This is what the selection page's "Uploading a file will overwrite any previous files you
have uploaded." line warns about. A test that uploads a baseline into a project that already
has post-intervention data must expect the post-intervention side to be **gone**, not
recalculated.

The replacement is wholesale on the baseline side too: the stored document is overwritten by
the new file's habitats (featureIds are carried forward by `ref`, but the habitat set itself
comes from the new upload). Re-uploading the _same_ fixture therefore proves nothing about
which file won — a replacement test must upload a **different** valid file and assert the new
file's data renders.

---

### A failed re-upload leaves the stored baseline intact — BMD-850 AC10 `[IMPLEMENTED]`

Validation runs **before** any write: `POST /baseline/validate/{uploadId}` only reaches
`setProjectBaseline` once the GeoPackage passes, so a file that drops out to `/error-file`
never touches the project. For a project that already holds a baseline this means the
previous data survives the failed attempt untouched — same habitats, same units, task list
still "Completed" — and the post-intervention document (if any) survives with it, because the
`- 'postIntervention'` deletion is part of the same skipped write.

Worth pinning in a browser test rather than trusting by inspection: the destructive write and
the validation gate live in the same transaction, so a re-ordering there would silently wipe
a user's data on a bad upload.

---

### Sliver and area checks — what BMD-882 changed `[IMPLEMENTED]`

Backend BMD-882 (PR#185, frontend PR#190) removed one of three related rules. The
distinction matters when choosing a fixture, because two of them fire on the same
geometry from opposite directions:

| Rule                      | Status                   | What it means                                                                                                                             |
| ------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `SLIVERS_INSIDE_REDLINE`  | **removed** (BMD-882)    | Was a _derived_ check: tiny gaps inside the boundary no parcel covered, flagged at `0 < area < 1 m²`. Redundant — see `AREA_SUM_MISMATCH` |
| `SLIVERS_OUTSIDE_REDLINE` | kept, unchanged          | Scraps of parcel geometry poking **outside** the boundary, `> 0.5 m²`. Reported by WKT location, not by parcel                            |
| `AREA_SUM_MISMATCH`       | kept, unchanged          | `abs(sum(parcel areas) − redline area) > 0.5 m²`. This is what now catches unmapped regions, so removing the derived check loses nothing  |
| `AREA_PARCELS_TOO_SMALL`  | kept (the real "sliver") | A parcel **supplied in the file** whose own footprint is `< 1 m²`. Area only — shape is not measured, so a long thin parcel passes        |

Two consequences for tests:

- **A gap below the 0.5 m² tolerance is now accepted.** Both sides of this change are
  pinned in the backend rather than the browser — see _"accepts a small gap left between
  the parcels and the redline"_ and _"detects area sum mismatch"_ in
  `../bng-metric-backend/integration-tests/postgis-validate-baseline-layers.test.js`.
  The journey-level pair (fixtures `Baseline - tiny gap between parcels.gpkg` and
  `Baseline - area sum mismatch.gpkg`) was retired in the integration-overlap workshop;
  both fixtures were removed with it.
- **`AREA_PARCELS_TOO_SMALL` cannot currently reach the single-error layout.** The only
  fixture, `Baseline - parcel too small.gpkg`, leaves the shortfall uncompensated, so
  `AREA_SUM_MISMATCH` co-fires and the grouped multi-error layout renders instead. That
  grouped rendering — including the per-parcel `Feature Ref X — ~0.7 sq m` detail list —
  is covered at journey level; the rule itself is covered in the backend.

---

### Landing — project summary (separate flow)

On a successful upload the user lands on `GET /projects/{id}/project-summary` (BMD-870; it was `GET /projects/{id}/baseline-habitat-list` before). That page, the habitat list and the habitat-detail edit journey are documented in their own flow docs and are **out of scope** for this flow:

- `test/flows/project-management/project-summary.flow.md` — the landing page for any project with a baseline
- `test/flows/habitat-list/habitat-list.flow.md` — baseline habitat list page, now reached from the task list rather than straight off an upload
- `test/flows/habitat-details/habitat-details.flow.md` — edit a baseline habitat detail
