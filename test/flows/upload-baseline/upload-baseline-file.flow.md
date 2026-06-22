# Upload Baseline File User Flow

## Overview

A BNG Completer uploads a GeoPackage (.gpkg) file containing the on-site baseline habitat
data for a project. The file is submitted directly to the CDP Uploader service; the app
then polls for upload status, validates the file via the backend, and routes the user
to the baseline habitat list on success, or a structured error dropout page on failure.

The baseline and post-intervention upload journeys now share parameterised controllers and
templates (keyed by `HABITAT_UPLOAD_TYPES`); the post-intervention variant is documented in
its own flow doc.

## Steps

### Step 1 — View file upload form `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/upload-baseline-file`
- **Template:** `src/server/habitat-upload-file/habitat-upload-file.njk` (shared; controller is `createUploadFileController(HABITAT_UPLOAD_TYPES.baseline)`)
- **Auth required:** Yes (session + approved BNG Completer role — Defra ID enrolment status 3, scoped to `currentRelationshipId` when present)
- **Backend endpoints:**
  - `GET /projects/{id}` — fetches project name for the caption
  - `POST /upload/initiate` — creates a CDP upload session; returns `uploadId` and `uploadUrl`
- **Description:** Renders a GOV.UK file-upload form whose `action` points directly to the CDP Uploader URL (not the app). The handler reads and immediately clears any `uploadError` flash from the session (set by previous failed/timed-out attempts) and stores the new `uploadId` in the session as `pendingUploadId`. The response sets `Cache-Control: no-store` to ensure the short-lived upload URL is always fresh. Back link and Cancel link both navigate to `/add-project-details/{projectId}`. The controller delegates to the shared upload-file factory; upload metadata sent to the CDP Uploader includes `uploadType: 'baseline'`, and backend calls forward the user's Defra ID bearer via `backendRequest` (BMD-511).
- **Validation:** None (display-only). If `uploadUrl` is absent the template renders a fallback message ("Unable to start file upload") instead of the form.
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
  - `POST /baseline/validate/{uploadId}` (body: `{ projectId }`) — triggered once status is `ready`; validates and persists the baseline; forwards the user's Defra ID bearer via `backendRequest`
- **Description:** Rendered by the shared `createUploadReceivedController(HABITAT_UPLOAD_TYPES.baseline, validateBaseline)` factory. The template renders a "Checking your file" message with a `<meta http-equiv="refresh" content="5">` tag so the browser re-hits the handler every 5 seconds. On each request the handler checks `pendingUploadId` from the session, polls upload status, and tracks elapsed time in `uploadStartedAt`. Once status is `ready` it calls baseline validation and clears both session keys. The rejected and structured-error branches also set `validationUploadType = 'baseline'` in session (consumed by the shared error-file page). Possible outcomes are listed below.
- **Validation / branching:**
  - `pendingUploadId` missing → redirect to `GET /projects/{id}/upload-baseline-file`
  - Status `rejected` → clear session keys, set empty `baselineValidationErrors` and `baselineValidationErrorsProjectId` in session, redirect to `GET /error-file`
  - Status `ready` + validation invalid + error code is `GPKG_INVALID_FILE` or `GPKG_NOT_A_GEOPACKAGE` → set `uploadError` flash "The selected file must be a GeoPackage (.gpkg)" → redirect to upload form
  - Status `ready` + validation invalid + other error codes → store structured `baselineValidationErrors` and `baselineValidationErrorsProjectId` in session → redirect to `GET /error-file`
  - Status `ready` + validation passes → redirect to `GET /projects/{id}/baseline-habitat-list`
  - Elapsed > 120 seconds → clear session keys, set `uploadError` flash "The file check timed out. Please try again." → redirect to upload form
  - Any other status (e.g. `pending`, `unknown`, `error`) → re-render the polling page
- **On success:** Redirects to `GET /projects/{id}/baseline-habitat-list`
- **On error:** Redirects to `GET /error-file` (structured errors) or `GET /projects/{id}/upload-baseline-file` (format / timeout flash errors)

---

### Step 4 — View validation error dropout page `[IMPLEMENTED]`

- **Route:** `GET /error-file`
- **Template:** `src/server/error-file/index.njk`
- **Auth required:** Yes (session required)
- **Backend endpoint:** None
- **Description:** The page is now shared by the baseline and post-intervention flows. It reads `validationUploadType` from the session to select the upload type (defaulting to baseline), then reads that type's structured-error array and projectId — for baseline these remain `baselineValidationErrors` and `baselineValidationErrorsProjectId`. It clears all upload-type session keys immediately so a refresh does not re-display stale data, and passes `fileLabel` and `uploadHref` to the view. Errors are grouped into blocks by error code; each block renders a heading, an optional note, and a bulleted list of offending features with a "… and N more" tail when the backend truncated the sample. Suppression rule: when `AREA_PARCELS_OUTSIDE_REDLINE` is present, `SLIVERS_OUTSIDE_REDLINE` errors are hidden. When the errors array is empty (e.g. rejected upload) a generic "We couldn't accept your file" message is shown. Offers "Upload a different file" (back to upload form) and "Back to project" links when `projectId` is known, or "Back to start" otherwise.
- **Validation:**
  - Session error array absent or empty → generic fallback message
  - `projectId` absent → project-specific action links replaced with a "Back to start" root link
- **On success:** Renders the error dropout page
- **On error:** N/A

---

### Landing — baseline habitat list (separate flow)

On a successful upload the user lands on `GET /projects/{id}/baseline-habitat-list`. That page and the habitat-detail edit journey are documented in their own flow docs and are **out of scope** for this flow:

- `test/flows/habitat-list/habitat-list.flow.md` — baseline habitat list page
- `test/flows/habitat-details/habitat-details.flow.md` — edit a baseline habitat detail
