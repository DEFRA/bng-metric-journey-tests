# Upload Post-intervention File User Flow

## Overview

A BNG Completer uploads a GeoPackage (.gpkg) file containing the on-site post-intervention
habitat data for a project. The file is submitted directly to the CDP Uploader service; the
app then polls for upload status, validates the file via the backend, and routes the user to
the post-intervention habitat list on success, or a structured error dropout page on failure.

This flow shares its controllers and templates with the baseline upload flow via the
`HABITAT_UPLOAD_TYPES.postIntervention` configuration; only the routes, session keys, backend
path, and page copy differ. The baseline variant is documented in
`test/flows/upload-baseline/upload-baseline-file.flow.md`.

An acceptance-criteria coverage matrix for this flow — mirrored from the baseline ACs by
workshop title and reconciled against the live implementation — lives alongside this doc in
[`upload-post-intervention-file.ac.md`](upload-post-intervention-file.ac.md).

## Entry point

The flow is entered from the project task list (`GET /add-project-details/{id}`,
`projects/task-list.njk`). The "On-site post intervention habitats" row links to
`GET /projects/{id}/upload-post-intervention-file` with a blue "Not yet started" tag while
`project.postIntervention` is absent, and flips to `GET /projects/{id}/post-intervention-habitat-list`
with "Completed" once it exists — so **the task list stops offering a re-upload after the first
successful upload**. The row is not gated on the baseline being uploaded first.

## Steps

### Step 1 — View file upload form `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/upload-post-intervention-file`
- **Template:** `src/server/habitat-upload-file/habitat-upload-file.njk` (shared; controller is `createUploadFileController(HABITAT_UPLOAD_TYPES.postIntervention)`)
- **Auth required:** Yes (session + approved BNG Completer role — Defra ID enrolment status 3, scoped to `currentRelationshipId` when present)
- **Backend endpoints:**
  - `GET /projects/{id}` — fetches project name for the caption
  - `POST /upload/initiate` — creates a CDP upload session; returns `uploadId` and `uploadUrl`
- **Description:** Renders the shared GOV.UK file-upload form whose `action` points directly to the CDP Uploader URL (not the app). The handler reads and immediately clears any `postInterventionUploadError` flash from the session and stores the new `uploadId` as `postInterventionPendingUploadId`. The response sets `Cache-Control: no-store`. Page title is "Upload Post-intervention File"; the instruction text references post-intervention habitat parcels. Upload metadata sent to the CDP Uploader includes `uploadType: 'postIntervention'`. Backend calls forward the user's Defra ID bearer via `backendRequest`. Back link and Cancel link both navigate to `/add-project-details/{projectId}`.
- **Validation:** None (display-only). If `uploadUrl` is absent the template renders a fallback message ("Unable to start file upload") instead of the form.
- **Route parameters:** `{id}` is **not** validated (no Joi `params` schema on this route, unlike `/projects/{id}/post-intervention-habitat-list` which requires a uuidv4). A non-UUID id does not 400 — `GET /projects/{id}` fails, the caption falls back to "Project", and the form still renders. The same applies to `post-intervention-upload-received`.
- **On success:** Renders the file-upload form
- **On error:** Renders the form with the session flash error message in a GOV.UK error summary (then cleared)

---

### Step 2 — Submit file to CDP Uploader `[IMPLEMENTED]`

- **Route:** `POST <uploadUrl>` (external — CDP Uploader service, not this app)
- **Template:** N/A
- **Auth required:** N/A (handled by the CDP Uploader)
- **Backend endpoint:** N/A
- **Description:** The browser submits the multipart form directly to the CDP Uploader. The uploader processes the file and redirects the browser to the `redirect` URL registered at session initiation: `GET /projects/{id}/post-intervention-upload-received`.
- **Validation:** CDP Uploader rejects files that fail MIME-type or size checks; the outcome is reflected as `rejected` status on the status endpoint (resolved in Step 3).
- **On success:** Browser is redirected to `GET /projects/{id}/post-intervention-upload-received`
- **On error:** Upload status becomes `rejected`; handled in Step 3

---

### Step 3 — Poll upload and validation status `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/post-intervention-upload-received`
- **Template:** `src/server/upload-received/upload-received.njk` (shared)
- **Auth required:** Yes (session + approved BNG Completer role — Defra ID enrolment status 3, scoped to `currentRelationshipId` when present)
- **Backend endpoints:**
  - `GET /upload/{uploadId}/status` — polls upload status (treats `numberOfRejectedFiles > 0` as `rejected`)
  - `POST /post-intervention/validate/{uploadId}` (body: `{ projectId }`) — triggered once status is `ready`; validates and persists the post-intervention data; forwards the user's Defra ID bearer via `backendRequest`
- **Backend content validation (post-intervention specifics):** the validate route runs the same pipeline as baseline but with `projectDocumentKey: 'postIntervention'`, which changes:
  - **Distinctiveness scope** — `checkHabitatDistinctiveness` reads the **Proposed\*** columns (not Baseline\*); High / V.High area habitats, hedgerows or watercourses reject with `HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE`. `DUPLICATE_HABITAT_REF` and `ADVANCE_AND_DELAY_BOTH_SET` apply unchanged.
  - **Retention Category (BMD-534)** — values are normalised (a leading "N. " list prefix is stripped). Area habitats with `Lost` are mapped to `Created`; hedgerows, watercourses and trees with `Lost` are **excluded** from the saved document and from sizing. Any other value derives to `null`, which fails `postInterventionDataSchema` (`retentionCategory` required, one of Retained / Created / Enhanced) → `INVALID_FILE_METADATA` with `valid: false` → structured-error branch → `/error-file`, where it hits the catch-all "layer names and column names" copy.
  - **Enrichment against the stored baseline** — post-intervention units are enriched using the project's stored `baseline` (watercourse/hedgerow lengths by ref, and baseline unit totals for net change). Uploading post-intervention **before** a baseline is not blocked; features that cannot be calculated are marked `Incomplete`.
- **Backend failure statuses:** 4xx from the backend (404 unknown project, 409 concurrent persist for the same project, 413 file > 100 MB, 422 upload rejected) are surfaced as structured errors — the backend's `errors` array when present, otherwise a single `VALIDATION_FAILED` carrying the backend message — and land on `/error-file`. 5xx / 504 / network errors instead throw `Boom.badGateway`, so the user gets the shared 502 error page ("Something went wrong"), **not** a redirect. File metadata that fails `habitatDataSchema` (over-long filename or size) returns `INVALID_FILE_METADATA` the same way as a content failure.
- **Description:** Rendered by the shared `createUploadReceivedController(HABITAT_UPLOAD_TYPES.postIntervention, validatePostIntervention)` factory. The template renders a "Checking your file" message with a `<meta http-equiv="refresh" content="5">` tag so the browser re-hits the handler every 5 seconds. On each request the handler checks `postInterventionPendingUploadId` from the session, polls upload status, and tracks elapsed time in `postInterventionUploadStartedAt`. Once status is `ready` it calls post-intervention validation and clears both session keys. Possible outcomes are listed below.
- **Validation / branching:**
  - `postInterventionPendingUploadId` missing → redirect to `GET /projects/{id}/upload-post-intervention-file`
  - Status `rejected` → clear session keys, set empty `postInterventionValidationErrors`, `postInterventionValidationErrorsProjectId`, and `validationUploadType = 'postIntervention'` in session, redirect to `GET /error-file`
  - Status `ready` + validation invalid + error code is `GPKG_INVALID_FILE` or `GPKG_NOT_A_GEOPACKAGE` → set `postInterventionUploadError` flash "The selected file must be a GeoPackage (.gpkg)" → redirect to upload form
  - Status `ready` + validation invalid + other error codes → store structured `postInterventionValidationErrors`, `postInterventionValidationErrorsProjectId`, and `validationUploadType = 'postIntervention'` in session → redirect to `GET /error-file`
  - Status `ready` + validation passes → redirect to `GET /projects/{id}/post-intervention-habitat-list`
  - Elapsed > 120 seconds → clear session keys, set `postInterventionUploadError` flash "The file check timed out. Please try again." → redirect to upload form
  - Any other status (e.g. `pending`, `unknown`, `error`) → re-render the polling page
- **Page furniture:** the "Checking your file" page renders a Back link to `GET /projects/{id}/upload-post-intervention-file`.
- **On success:** Redirects to `GET /projects/{id}/post-intervention-habitat-list`
- **On error:** Redirects to `GET /error-file` (structured errors) or `GET /projects/{id}/upload-post-intervention-file` (format / timeout flash errors)

---

### Step 4 — View validation error dropout page `[IMPLEMENTED]`

- **Route:** `GET /error-file`
- **Template:** `src/server/error-file/index.njk` (shared with the baseline flow)
- **Auth required:** Yes (session required)
- **Backend endpoint:** None
- **Description:** The shared dropout page reads `validationUploadType` from the session; when it is `postIntervention` it reads `postInterventionValidationErrors` (structured array) and `postInterventionValidationErrorsProjectId`, sets `fileLabel = 'post-intervention'`, and builds the "Upload a different file" link to `/projects/{projectId}/upload-post-intervention-file`. It clears all upload-type session keys immediately so a refresh does not re-display stale data. Errors are grouped into blocks by error code, with a "… and N more" tail when the backend truncated the sample. Suppression rule: when `AREA_PARCELS_OUTSIDE_REDLINE` is present, `SLIVERS_OUTSIDE_REDLINE` errors are hidden. Distinctiveness rejections (`HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE`) additionally render an "Allowed distinctiveness: …" note with backend band identifiers mapped to user-facing labels (e.g. `V.High` → "Very high"), appended to both the error block and the error-summary entry. When exactly one validation error remains after suppression (`visibleErrors.length === 1`), the page renders **BMD-405 personalised copy** instead of the generic error-summary/blocks layout — see the table below. When the errors array is empty (e.g. rejected upload) a generic "We couldn't accept your file" message is shown. Offers "Upload a different file" and "Back to project" links when `projectId` is known, or "Back to start" otherwise — **except on the single-error layout**, where the button/link are not shown at all (frontend PR#175, `{% if not singleError %}` around the button group). This logic is shared and not scoped by upload type — it applies identically to the post-intervention flow.

#### Single-error copy (BMD-405, `error-file/single-error-copy.js`)

Resolved by the backend's error code. Three variants:

| Variant           | Rendered as                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `standard`        | H1 + one sentence, with an inline "upload a new file" link to the post-intervention upload route                               |
| `distinctiveness` | H1 "Very high and high distinctiveness habitats are not yet included in this service" + an external metric-tool link (new tab) |
| `placeholder`     | H1 "PLACEHOLDER (AWAITING UCD)" + "PLACEHOLDER - <backend message>", pending finalised copy (BMD-592)                          |

| Error code(s)                                                                                                              | H1                                                                         | Message                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `NO_REDLINE`, `GPKG_RLB_NO_POLYGON`                                                                                        | "Your Geopackage (.gpkg) file contains an error"                           | redline boundary is missing                                                                     |
| `GPKG_RLB_TOO_MANY_POLYGONS`                                                                                               | as above                                                                   | multiple red line boundaries                                                                    |
| `NO_HABITAT_AREAS`                                                                                                         | as above                                                                   | file doesn't contain any parcels                                                                |
| `REDLINE_INVALID_GEOMETRY`                                                                                                 | as above                                                                   | redline boundary is overlapping itself                                                          |
| `AREA_PARCELS_INVALID_GEOMETRY`                                                                                            | "This parcel {ref} contains an error" (ref-titled)                         | parcel is overlapping itself                                                                    |
| `PARCEL_OVERLAPS`                                                                                                          | "These parcels {refA}, {refB} contain an error" when both refs are present | these parcels are overlapping (falls back to a non-ref-titled sentence otherwise)               |
| **`AREA_PARCELS_TOO_SMALL`**                                                                                               | "This parcel {ref} contains an error"                                      | **"This parcel is smaller than 1 square metre."** — area only; shape is not measured            |
| **`SLIVERS_OUTSIDE_REDLINE`**                                                                                              | "Your Geopackage (.gpkg) file contains an error" (no ref)                  | **"This parcel is a sliver (a thin strip of land)."**                                           |
| **`ADVANCE_AND_DELAY_BOTH_SET`**                                                                                           | "Your Geopackage (.gpkg) file contains an error"                           | **both advance and delayed creation set; pick one, or add a separate row per stage**            |
| `AREA_PARCELS_OUTSIDE_REDLINE`                                                                                             | "This parcel {ref} contains an error"                                      | parcel is outside the red line boundary                                                         |
| `HEDGEROWS_OUTSIDE_REDLINE`                                                                                                | "This hedgerow {ref} contains an error"                                    | hedgerow is outside the red line boundary                                                       |
| `WATERCOURSES_OUTSIDE_REDLINE`                                                                                             | "This watercourse {ref} contains an error"                                 | watercourse is outside the red line boundary                                                    |
| `HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE`                                                                                     | distinctiveness variant (see above)                                        | links to the statutory metric spreadsheet                                                       |
| `REDLINE_OUTSIDE_ENGLAND`, `REDLINE_AREA_TOO_LARGE`, `IGGIS_OUTSIDE_REDLINE`, `TREES_OUTSIDE_REDLINE`, `AREA_SUM_MISMATCH` | placeholder variant                                                        | pending BMD-592                                                                                 |
| any other / unrecognised code (e.g. `DUPLICATE_HABITAT_REF`, GeoPackage schema errors)                                     | "Your Geopackage (.gpkg) file contains an error"                           | catch-all: "The layer names and column names do not match what is required by Natural England…" |

Two behaviours worth testing explicitly:

- **`AREA_PARCELS_TOO_SMALL` and `SLIVERS_OUTSIDE_REDLINE` are now separate problems with
  separate wording** (backend BMD-882, PR#185). The backend's old derived "slivers inside
  the redline" check was replaced by a per-parcel `AREA_PARCELS_TOO_SMALL` area test
  (< 1 m², reported with the parcel ref and its area); `SLIVERS_OUTSIDE_REDLINE` survives
  and still reports the leftover geometry where parcels overhang the boundary, which is why
  it has no ref to title with.
- When `uploadHref` is null (no `projectId` in session), a `standard` variant trims its
  trailing `" and "` into a full stop and drops the inline link entirely.

- **Validation:**
  - Session error array absent or empty → generic fallback message
  - Exactly one visible error → renders the BMD-405 personalised `singleError` copy instead of the multi-error summary/blocks; no "Upload a different file"/"Back to project" action shown on this layout
  - `projectId` absent → project-specific action links replaced with a "Back to start" root link, and any inline single-error upload link is dropped
- **On success:** Renders the error dropout page
- **On error:** N/A

---

### Landing — post-intervention habitat list (separate flow)

On a successful upload the user lands on `GET /projects/{id}/post-intervention-habitat-list`. That page and the post-intervention habitat-detail edit journey are documented separately and are **out of scope** for this flow:

- [`test/flows/habitat-list/post-intervention-habitat-list.flow.md`](../habitat-list/post-intervention-habitat-list.flow.md) — post-intervention habitat list page
- [`test/flows/habitat-details/post-intervention-habitat-details.flow.md`](../habitat-details/post-intervention-habitat-details.flow.md) — the read-only per-feature details pages reached from the list (`GET /post-intervention-habitat-details?featureId=…&projectId=…`; the `POST` returns 501)
