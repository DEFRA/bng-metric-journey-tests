# Upload Baseline File User Flow

## Overview

A BNG Completer uploads a GeoPackage (.gpkg) file containing the on-site baseline habitat
data for a project. The file is submitted directly to the CDP Uploader service; the app
then polls for upload status, validates the file via the backend, and routes the user
directly to the habitat list on success, or a structured error dropout page on failure.

## Steps

### Step 1 — View file upload form `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/upload-baseline-file`
- **Template:** `src/server/upload-baseline-file/upload-baseline-file.njk`
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoints:**
  - `GET /projects/{id}` — fetches project name for the caption
  - `POST /upload/initiate` — creates a CDP upload session; returns `uploadId` and `uploadUrl`
- **Description:** Renders a GOV.UK file-upload form whose `action` points directly to the CDP Uploader URL (not the app). The handler reads and immediately clears any `uploadError` flash from the session (set by previous failed/timed-out attempts) and stores the new `uploadId` in the session as `pendingUploadId`. The response sets `Cache-Control: no-store` to ensure the short-lived upload URL is always fresh.
- **Validation:** None (display-only). If `uploadUrl` is absent the template renders a fallback message instead of the form.
- **On success:** Renders the file-upload form
- **On error:** Renders the form with the session flash error message (then cleared)

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
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoints:**
  - `GET /upload/{uploadId}/status` — polls upload status
  - `POST /baseline/validate/{uploadId}` (body: `{ projectId }`) — triggered once status is `ready`; validates and persists the baseline
- **Description:** The template renders a "Checking your file" message with a `<meta http-equiv="refresh" content="5">` tag so the browser re-hits the handler every 5 seconds. On each request the handler checks `pendingUploadId` from the session, polls upload status, and tracks elapsed time in `uploadStartedAt`. Once status is `ready` it calls baseline validation and clears both session keys. Possible outcomes are listed below.
- **Validation / branching:**
  - `pendingUploadId` missing → redirect to `GET /projects/{id}/upload-baseline-file`
  - Status `rejected` → clear session keys, set empty `baselineValidationErrors` and `baselineValidationErrorsProjectId` in session, redirect to `GET /error-file`
  - Status `ready` + validation invalid + error code is `GPKG_INVALID_FILE` or `GPKG_NOT_A_GEOPACKAGE` → set `uploadError` flash "The selected file must be a GeoPackage (.gpkg)" → redirect to upload form
  - Status `ready` + validation invalid + other error codes → store structured `baselineValidationErrors` and `baselineValidationErrorsProjectId` in session → redirect to `GET /error-file`
  - Status `ready` + validation passes → redirect to `GET /projects/{id}/habitat-list`
  - Elapsed > 120 seconds → clear session keys, set `uploadError` flash "The file check timed out. Please try again." → redirect to upload form
  - Any other status (e.g. `pending`, `unknown`) → re-render the polling page
- **On success:** Redirects to `GET /projects/{id}/habitat-list`
- **On error:** Redirects to `GET /error-file` (structured errors) or `GET /projects/{id}/upload-baseline-file` (format / timeout flash errors)

---

### Step 4 — View validation error dropout page `[IMPLEMENTED]`

- **Route:** `GET /error-file`
- **Template:** `src/server/error-file/index.njk`
- **Auth required:** Yes (session required)
- **Backend endpoint:** None
- **Description:** Reads `baselineValidationErrors` (structured array) and `baselineValidationErrorsProjectId` from the session, then clears both immediately so a refresh does not re-display stale data. Errors are grouped into blocks by error code; each block renders a heading, an optional note, and a bulleted list of offending features with a "… and N more" tail when the backend truncated the sample. Suppression rule: when `AREA_PARCELS_OUTSIDE_REDLINE` is present, `SLIVERS_OUTSIDE_REDLINE` errors are hidden. When the errors array is empty (e.g. rejected upload) a generic "We couldn't accept your file" message is shown. Offers "Upload a different file" (back to upload form) and "Back to project" links when `projectId` is known, or "Back to start" otherwise.
- **Validation:**
  - Session error array absent or empty → generic fallback message
  - `projectId` absent → project-specific action links replaced with a "Back to start" root link
- **On success:** Renders the error dropout page
- **On error:** N/A

---

### Step 5 — View habitat list `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/habitat-list`
- **Template:** `src/server/habitat-list/habitat-list.njk`
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** `GET /projects/{id}` — fetches project including baseline habitats
- **Description:** Landing page after a successful upload. Renders a summary table and GOV.UK tabs (Areas, Hedgerows, Watercourses) listing the imported baseline habitats. Habitat rows are sourced from `project.project.baseline.habitats`. Back link navigates to `/add-project-details/{projectId}`. Page includes a "Continue" button (placeholder href `#`) and an "Upload a different file" link back to the upload form.
- **Validation:**
  - `id` must be a valid UUID v4 — returns 400 if invalid
- **On success:** Renders the habitat list page
- **On error:** 400 for invalid UUID path param

---

### Step 6 — Edit baseline habitat detail `[IMPLEMENTED]`

- **Route:** `GET /baseline-habitat-details` (display) · `POST /baseline-habitat-details` (update)
- **Template:** `src/server/baseline-habitat-details/baseline-habitat-details.njk`
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoints (GET):**
  - `GET /projects/{projectId}/habitats/{habitatId}` — fetches the specific habitat record
  - `GET /reference/habitat-types-by-broad` — fetches habitat types grouped by broad habitat (cached in-process after first load)
  - `GET /reference/trading-rules` — fetches trading rules by distinctiveness band (cached in-process after first load)
  - `GET /reference/conditions?habitatType=…` — fetches condition options for the selected habitat type
- **Backend endpoints (POST):**
  - `PUT /projects/{projectId}/habitats/{featureId}` — persists the edited habitat fields
- **Supporting frontend route:** `GET /api/reference/conditions?habitatType=…` — frontend proxy that forwards condition lookups for client-side JS (triggered when the habitat type dropdown changes); requires session + BNG Completer role
- **Description:** Displays read-only and editable fields for a single baseline habitat record. Read-only fields: Reference, Area (ha), Distinctiveness (updated client-side via JS when habitat type changes), Strategic Significance (fixed "Low (1)"), Trading rules (updated client-side via JS), Habitat units. Editable fields: Broad habitat (dropdown), Habitat type (dropdown filtered by broad habitat selection), Condition (dropdown, options loaded from reference endpoint based on habitat type). Back link navigates to `/projects/{projectId}/habitat-list`. Cancel link navigates to `/projects/{projectId}/habitat-list#habitat-{featureId}`.
- **Validation (GET):**
  - `habitatId` query param required and must be a valid UUID v4 — returns 400 if missing or invalid
  - `projectId` query param required and must be a valid UUID v4 — returns 400 if missing or invalid
  - Habitat not found → `Boom.notFound`
- **Validation (POST):**
  - `projectId` body field required and must be a valid UUID v4
  - `featureId` body field required and must be a valid UUID v4
  - `broadHabitat`, `habitatType`, `condition` optional
  - PUT failure → `Boom.badGateway`
- **On success (GET):** Renders the habitat detail edit form
- **On success (POST):** Redirects to `/projects/{projectId}/habitat-list#habitat-{featureId}`
- **On error (GET):** 400 for invalid/missing query params; 404 if habitat not found
- **On error (POST):** 400 for invalid/missing body params; 502 if backend PUT fails
