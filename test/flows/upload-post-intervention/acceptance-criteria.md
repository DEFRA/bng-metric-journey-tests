# Upload Post-Intervention — Acceptance Criteria

Mirror of the `upload-baseline` acceptance criteria, adapted to the post-intervention
flow (routes, session keys, backend path, page copy). Each section corresponds to one
workshop title and is combined from the linked baseline Jira ticket(s), then reconciled
against the **live implementation** (this is a regression suite for shipped behaviour).

**Conventions**

- `PI-<TITLE>-<n>` — acceptance criterion ref.
- Coverage markers: ✅ covered · 🟡 partial · ❌ gap — snapshot at authoring time;
  the authoritative gap analysis is produced per title by `/validate-ac-automated`.
- Flow reference: [upload-post-intervention-file.flow.md](upload-post-intervention-file.flow.md).

---

## 1. Trigger

**Source (baseline):** BMD-247 — "2.20 Project Task List [Skeleton Page Layout]"
(superseded by BMD-410 content change; title change BMD-455).

**Entry point:** the "On-site post intervention habitats" task on the project task list
page, `GET /add-project-details/{id}` — shared with baseline. Clicking the task launches
the post-intervention upload journey.

**Precondition:** signed-in, approved BNG Completer, with ≥1 project, viewing that
project's task list.

| Ref       | Acceptance criterion                                                                                                                                              | Coverage                                                                                                                          |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| PI-TRIG-1 | The task list shows a task titled "On-site post intervention habitats".                                                                                           | ✅                                                                                                                                |
| PI-TRIG-2 | Before upload, the task links to `/projects/{id}/upload-post-intervention-file`.                                                                                  | ✅ href asserted                                                                                                                  |
| PI-TRIG-3 | Clicking the task navigates to the post-intervention upload form (starts the journey).                                                                            | ✅ [project-task-list.spec.js](../../specs/project-management/project-task-list.spec.js) — "task item navigation"                 |
| PI-TRIG-4 | Before upload, the task status is "Not yet started" (blue tag).                                                                                                   | ✅ row-scoped assertion in the "page content" test                                                                                |
| PI-TRIG-5 | After a successful upload, the task shows "Completed" and links to `/projects/{id}/post-intervention-habitat-list`.                                               | ❌ gap — verified end-to-end via the **Happy Path** title; not a standalone Trigger test                                          |
| PI-TRIG-6 | Shared page guards apply: unauthenticated → sign-in; no BNG Completer role → `/auth/forbidden`; non-UUID id → 400; unknown project UUID hides the task-list body. | ✅ covered at page level ([project-task-list.spec.js](../../specs/project-management/project-task-list.spec.js)); not re-mirrored |

**Implemented for this title:** PI-TRIG-3 — a click-navigation test on the post-intervention
task row (mirrors the baseline row test) — plus a row-scoped "Not yet started" assertion for
PI-TRIG-4, both in
[project-task-list.spec.js](../../specs/project-management/project-task-list.spec.js).
PI-TRIG-5 is realised by the Happy Path upload and is asserted there, not duplicated here.

**Footnote (provenance):** BMD-247 AC3/AC6 specified a grey "Cannot start yet" state for
the post-intervention task until baseline completion. Post-intervention development has since
progressed and the live app does not gate the task — it is always an active "Not yet started"
link. The gating is treated as superseded and is intentionally **not** an AC.

---

## 2. File selection

**Source (baseline):** BMD-278 (3.01 upload skeleton page), BMD-343 (3.02 choose file),
BMD-280 (3.03 filesize & extension), BMD-341 (3.04 Continue to upload).

**Page:** the post-intervention upload form, `GET /projects/{id}/upload-post-intervention-file`
(shared `habitat-upload-file.njk`; posts directly to the CDP Uploader).

**Precondition:** signed-in, approved BNG Completer, on the post-intervention upload form.

| Ref     | Acceptance criterion                                                                                                                                                                                                                               | Coverage                                                                                                                                                     |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PI-FS-1 | Form displays: Back link, caption = project name, heading "Upload a GeoPackage (.gpkg) file", post-intervention instruction text, file widget ("Upload a file" / "No file chosen" / "Choose file" / "or drop file"), Continue button, Cancel link. | ✅ [upload-post-intervention-file.spec.js](../../specs/upload-post-intervention/upload-post-intervention-file.spec.js) form-display (caption + Cancel added) |
| PI-FS-2 | Clicking Back navigates to the project task list (`/add-project-details/{id}`).                                                                                                                                                                    | ✅ form navigation                                                                                                                                           |
| PI-FS-3 | Clicking Cancel navigates to the project task list.                                                                                                                                                                                                | ✅ form navigation                                                                                                                                           |
| PI-FS-4 | Clicking Continue with no file selected shows the client-side error "Select a GeoPackage (.gpkg) file" and does not submit.                                                                                                                        | ✅ client-side validation                                                                                                                                    |
| PI-FS-5 | Selecting a non-`.gpkg` file shows the client-side error "The selected file must be a GeoPackage (.gpkg)".                                                                                                                                         | ✅ client-side validation (`not-a-geopackage.txt`)                                                                                                           |

**Deferred (with reason):** oversized (> 100 MB) "must be smaller than 100 MB" and the
filename-display behaviour are covered by **frontend unit tests**
(`file-validation-rules.test.js`, `file-upload-validation.test.js`); opening the OS file
explorer and drag-and-drop (BMD-343 AC1–4) are native and not Playwright-testable.

---

## 3. Upload & Validation

**Source (baseline):** BMD-356 (3.06 virus scan), BMD-361 (3.11 GIS format), BMD-339 (3.12 NE
columns & layers), BMD-300 (3.15 geospatial data-quality — 13 rules), BMD-352 (3.16
distinctiveness eligibility).

**Mechanism:** Continue posts the file to the CDP Uploader; the app polls
`.../post-intervention-upload-received` and, once `ready`, calls
`POST /post-intervention/validate/{uploadId}`. Validation logic is **shared with baseline**.

**Precondition:** a file has been chosen on the post-intervention upload form and Continue clicked.

| Ref      | Acceptance criterion                                                                                                           | Fixture                                                           | Coverage                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ----------------------------------------- |
| PI-UV-1  | A valid file uploads and shows the "Checking your file" polling page while validation runs.                                    | `Post-intervention - complete.gpkg`                               | ✅ happy path                             |
| PI-UV-2  | A non-GeoPackage file is rejected with a format flash error on the upload form.                                                | `Not a valid geopackage.gpkg`                                     | ✅ existing                               |
| PI-UV-3  | A file with missing/incomplete data is rejected on the post-intervention error-file dropout page.                              | `Post-intervention (missing data) - fails validation.gpkg`        | ✅ existing                               |
| PI-UV-5a | RLB layer with no geometry column → dropout "Missing required feature layer in GeoPackage".                                    | `Post-intervention - no geometry column in RLB layer.gpkg`        | ✅ content validation errors              |
| PI-UV-5b | RLB layer with multiple geometry columns → dropout "expected exactly one geometry column … found 2".                           | `Post-intervention - multiple geometry columns in RLB layer.gpkg` | ✅ content validation errors              |
| PI-UV-5c | RLB layer with the wrong geometry type → dropout "expected geometry type POLYGON … found POINT" / "Zero red line boundaries…". | `Post-intervention - wrong geometry in RLB layer.gpkg`            | ✅ content validation errors              |
| PI-UV-6  | A file containing slivers → dropout slivers error.                                                                             | `Post-intervention - complete with slivers.gpkg`                  | ✅ content validation errors              |
| PI-UV-7  | A valid file passing all validation lands on the post-intervention habitat list.                                               | `Post-intervention - complete.gpkg`                               | ✅ happy path (full assert in Happy Path) |

**Dropped after discovery:** PI-UV-4 (`Post-intervention - incorrect geom column name.gpkg`)
is **accepted** by post-intervention validation — it passes and reaches the habitat list, so
it is not a rejection scenario (redundant with the happy path).

**Finding (backend copy):** the slivers dropout message reads _"Baseline file contains
slivers…"_ on a **post-intervention** upload — the shared backend message is not
parameterised by upload type. App behaviour is correct (rejects); wording is baseline-specific.
Flagged for the team; the test asserts the text as-is.

**Deferred to the Postgres File Processing / integration title** (shared backend logic, no
post-intervention browser fixtures): virus scan (BMD-356), exhaustive geospatial rules
(redline-in-England, area ≤ 100 km², overlaps, self-intersect, within-redline for
parcels/hedgerows/watercourses/IGGIs/trees, area-match — BMD-300), and distinctiveness
eligibility (BMD-352).

**Boundary with Unhappy Path (title 5):** here we assert that validation **rejects** specific
invalid files (one per available fixture). The error-file dropout **page presentation**
(rejected upload, timeout, structured-error grouping / "… and N more", SLIVERS suppression,
"Upload a different file" / "Back to project" links) is the Unhappy Path title.

---

## 4. Postgres File Processing

**Source (baseline):** BMD-448 (unpack GeoPackage → habitat data in JSON), BMD-449 (save
geometries to Postgres as a geometry type, linked by reference), BMD-451 (save
`filename`/`fileSize` metadata to the project JSON), BMD-452 (calculate geometry sizes —
individual + total).

**Scope decision: no journey-suite tests.** This title is **backend persistence** — what is
written to Postgres and the project JSONB. It lives in `bng-metric-backend` (a separate repo
and PR) and is the remit of backend integration/unit tests, not this browser suite. In the
journey suite it is only observable **indirectly**: the happy-path upload (PI-UV-1/7) lands on
the post-intervention habitat list, which renders the persisted habitat data, sizes, and units.
The validation logic and persistence are **shared with baseline**.

| Ticket  | Mirrored concern                                                           | Existing backend coverage                                                                                                                |
| ------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| BMD-448 | Habitat data (refs, type, distinctiveness, condition) → `postIntervention` | ✅ integration: `post-intervention-persistence.test.js` (habitats/hedgerows/watercourses persisted; feature read/edit)                   |
| BMD-449 | Geometries → Postgres geometry table, linked by `featureId`                | ✅ integration: `post_intervention_red_line` / `post_intervention_habitats` rows (SRID, `is_valid`, `MULTIPOLYGON`)                      |
| BMD-451 | `filename` / `fileSize` in the JSONB document                              | 🟡 **unit only**: `extract-post-intervention.test.js` (threads filename/fileSize) — **not asserted in the integration persistence test** |
| BMD-452 | Geometry sizes (individual + total, hectares)                              | ✅ integration: `postIntervention.habitatSizes` (areaHabitats / hedgerows / watercourses)                                                |

**Optional backend follow-up (out of this PR):** the one integration-level gap is that
`post-intervention-persistence.test.js` does not assert `postIntervention.filename` /
`fileSize` end-to-end (BMD-451). Closing it belongs in `bng-metric-backend` via
`/verify-integration-coverage` (a separate backend PR), not the journey suite.

---

## 5. Unhappy Path

**Source (baseline):** BMD-366 (3.05 File Upload — Error State), BMD-367 (3.30 Dropout Page —
Skeleton; superseded by the real `/error-file` page).

**Scope:** the **error-state presentation** on the upload form when a validation flash error
occurs. Most of the unhappy-path surface is already covered (below); this title adds the two
presentation details from BMD-366.

**Precondition:** a validation flash error is shown on the post-intervention upload form (e.g.
after uploading `Not a valid geopackage.gpkg`).

| Ref     | Acceptance criterion                                                                                                                             | Coverage                                                                          |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| PI-UP-1 | The upload form shows an error summary titled "There is a problem" with the error rendered as a link (and an inline error below the file input). | ✅ `upload-post-intervention.spec.js` format-error test (heading + link asserted) |
| PI-UP-2 | Clicking the error-summary link moves focus to the file-selection button (the GOV.UK enhanced "Choose file" button, `id="file"`). (BMD-366 AC2)  | ✅ `upload-post-intervention.spec.js` format-error describe                       |

**Already covered (no new tests):**

- Dropout page `/error-file` for a post-intervention rejection — "We couldn't accept your
  post-intervention file" + "Upload a different file"/"Back to project" links: ✅
  `upload-post-intervention.spec.js` (structural + content-validation errors).
- Generic fallback (no session) + unauthenticated `/error-file`: ✅ shared baseline
  `error-file.spec.js` (the page is shared and upload-type-agnostic here).
- **Rejected upload** (uploader `numberOfRejectedFiles > 0`): ✅ unit — frontend
  `post-intervention-upload-received/controller.test.js` ("redirects to dropout page when
  post-intervention upload is rejected") + backend `upload.test.js`. Redirects to `/error-file`
  with empty errors → the generic dropout, covered above. Not browser-triggerable (client JS
  blocks a non-`.gpkg` submit), so no journey test.

**Deferred / not mirrorable:**

- **120s timeout** flash ("The file check timed out") — impractical to exercise in a browser
  test; handled at the controller/unit level.
- **`SLIVERS_OUTSIDE_REDLINE` suppression** + "… and N more" truncation — no post-intervention
  fixture triggers the suppression branch (only `Baseline - parcel outside redline.gpkg` has
  `AREA_PARCELS_OUTSIDE_REDLINE`; the sole PI slivers fixture has no parcels-outside), and a
  geospatial-error `.gpkg` can't be generated by copy/rename. The suppression/grouping logic
  is on the **shared** `/error-file` page and is baseline-tested.
- **BMD-367 skeleton** (pathname `invalid-file`, "Dropout Page (Skeleton)" placeholder) —
  superseded; the real `/error-file` page is covered.
