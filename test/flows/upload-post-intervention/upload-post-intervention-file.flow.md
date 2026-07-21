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
- **Description:** Rendered by the shared `createUploadReceivedController(HABITAT_UPLOAD_TYPES.postIntervention, validatePostIntervention)` factory. The template renders a "Checking your file" message with a `<meta http-equiv="refresh" content="5">` tag so the browser re-hits the handler every 5 seconds. On each request the handler checks `postInterventionPendingUploadId` from the session, polls upload status, and tracks elapsed time in `postInterventionUploadStartedAt`. Once status is `ready` it calls post-intervention validation and clears both session keys. Possible outcomes are listed below.
- **Validation / branching:**
  - `postInterventionPendingUploadId` missing → redirect to `GET /projects/{id}/upload-post-intervention-file`
  - Status `rejected` → clear session keys, set empty `postInterventionValidationErrors`, `postInterventionValidationErrorsProjectId`, and `validationUploadType = 'postIntervention'` in session, redirect to `GET /error-file`
  - Status `ready` + validation invalid + error code is `GPKG_INVALID_FILE` or `GPKG_NOT_A_GEOPACKAGE` → set `postInterventionUploadError` flash "The selected file must be a GeoPackage (.gpkg)" → redirect to upload form
  - Status `ready` + validation invalid + other error codes → store structured `postInterventionValidationErrors`, `postInterventionValidationErrorsProjectId`, and `validationUploadType = 'postIntervention'` in session → redirect to `GET /error-file`
  - Status `ready` + validation passes → redirect to `GET /projects/{id}/post-intervention-habitat-list`
  - Elapsed > 120 seconds → clear session keys, set `postInterventionUploadError` flash "The file check timed out. Please try again." → redirect to upload form
  - Any other status (e.g. `pending`, `unknown`, `error`) → re-render the polling page
- **On success:** Redirects to `GET /projects/{id}/post-intervention-habitat-list`
- **On error:** Redirects to `GET /error-file` (structured errors) or `GET /projects/{id}/upload-post-intervention-file` (format / timeout flash errors)

---

### Step 4 — View validation error dropout page `[IMPLEMENTED]`

- **Route:** `GET /error-file`
- **Template:** `src/server/error-file/index.njk` (shared with the baseline flow)
- **Auth required:** Yes (session required)
- **Backend endpoint:** None
- **Description:** The shared dropout page reads `validationUploadType` from the session; when it is `postIntervention` it reads `postInterventionValidationErrors` (structured array) and `postInterventionValidationErrorsProjectId`, sets `fileLabel = 'post-intervention'`, and builds the "Upload a different file" link to `/projects/{projectId}/upload-post-intervention-file`. It clears all upload-type session keys immediately so a refresh does not re-display stale data. Errors are grouped into blocks by error code, with a "… and N more" tail when the backend truncated the sample. Suppression rule: when `AREA_PARCELS_OUTSIDE_REDLINE` is present, `SLIVERS_OUTSIDE_REDLINE` errors are hidden. Distinctiveness rejections (`HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE`) additionally render an "Allowed distinctiveness: …" note with backend band identifiers mapped to user-facing labels (e.g. `V.High` → "Very high"), appended to both the error block and the error-summary entry. When exactly one validation error remains after suppression (`visibleErrors.length === 1`), the page renders **BMD-405 personalised copy** instead of the generic error-summary/blocks layout: exact GOV.UK wording keyed by the backend's error code (`single-error-copy.js`), e.g. "This parcel P001 contains an error" for `AREA_PARCELS_OUTSIDE_REDLINE`/`PARCEL_OVERLAPS`/etc., or a dedicated "Very high and high distinctiveness habitats are not yet included in this service" variant (with an external metric-tool link) for `HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE`. Five codes (`REDLINE_OUTSIDE_ENGLAND`, `REDLINE_AREA_TOO_LARGE`, `IGGIS_OUTSIDE_REDLINE`, `TREES_OUTSIDE_REDLINE`, `AREA_SUM_MISMATCH`) render a placeholder message pending finalised copy (BMD-592); any other/unrecognised code falls back to a generic "layer/column names" message. This logic is shared and not scoped by upload type — it applies identically to the post-intervention flow. When the errors array is empty (e.g. rejected upload) a generic "We couldn't accept your file" message is shown. Offers "Upload a different file" and "Back to project" links when `projectId` is known, or "Back to start" otherwise.
- **Validation:**
  - Session error array absent or empty → generic fallback message
  - Exactly one visible error → renders the BMD-405 personalised `singleError` copy instead of the multi-error summary/blocks
  - `projectId` absent → project-specific action links replaced with a "Back to start" root link
- **On success:** Renders the error dropout page
- **On error:** N/A

---

### Landing — post-intervention habitat list (separate flow)

On a successful upload the user lands on `GET /projects/{id}/post-intervention-habitat-list`. That page and the post-intervention habitat-detail edit journey are documented separately and are **out of scope** for this flow:

- `test/flows/habitat-list/post-intervention-habitat-list.flow.md` — post-intervention habitat list page
- `GET/POST /projects/{id}/post-intervention-habitat-details` — edit a post-intervention habitat detail (route `post-intervention-habitat-details`)
