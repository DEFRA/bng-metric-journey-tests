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
- **Last reconciled against source:** 2026-08-06 (frontend `main` @ `0eefccc`, backend `main`
  @ `ee38918`) — see §3 for the BMD-882 sliver-check split, PI-UV-8/PI-UV-9 for the two
  branches newly mirrored, and §5 for the codes still unexercised by this suite.

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
| PI-TRIG-5 | After a successful upload, the task shows "Completed" and links to `/projects/{id}/post-intervention-habitat-list`.                                               | ✅ asserted by the **Happy Path** title (§6), not a standalone Trigger test                                                       |
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

| Ref      | Acceptance criterion                                                                                                                                                         | Fixture                                                           | Coverage                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| PI-UV-1  | A valid file uploads and shows the "Checking your file" polling page while validation runs.                                                                                  | `Post-intervention - complete.gpkg`                               | 🟡 upload covered by the happy path; the polling page itself is **not** asserted (see note below) |
| PI-UV-2  | A non-GeoPackage file is rejected with a format flash error on the upload form.                                                                                              | `Not a valid geopackage.gpkg`                                     | ✅ format error                                                                                   |
| PI-UV-3  | A file with a schema error is rejected on the error-file dropout page (single-error catch-all copy).                                                                         | `Post-intervention - no geometry column in RLB layer.gpkg`        | ✅ content validation errors                                                                      |
| PI-UV-5a | RLB layer with no geometry column → **single-error** dropout, Natural England layer/column catch-all copy.                                                                   | `Post-intervention - no geometry column in RLB layer.gpkg`        | ✅ content validation errors                                                                      |
| PI-UV-5b | RLB layer with multiple geometry columns → **single-error** dropout, same catch-all copy.                                                                                    | `Post-intervention - multiple geometry columns in RLB layer.gpkg` | ✅ content validation errors                                                                      |
| PI-UV-5c | RLB layer with the wrong geometry type → **multi-error** dropout, "Zero red line boundaries in GeoPackage (expecting one)".                                                  | `Post-intervention - wrong geometry in RLB layer.gpkg`            | ✅ content validation errors                                                                      |
| PI-UV-8  | A habitat setting **both** advance and delayed creation → **single-error** dropout, "A habitat has both advance and delayed creation set…" (BMD-883).                        | `Post-intervention - advance and delay both set.gpkg`             | ✅ content validation errors                                                                      |
| PI-UV-9  | A habitat whose **proposed** type is High/Very High distinctiveness → **single-error** distinctiveness dropout with the statutory metric-tool link (BMD-352/BMD-405 AC6a–b). | `Post-intervention - habitat distinctiveness out of scope.gpkg`   | ✅ high distinctiveness habitat                                                                   |
| PI-UV-6  | A file containing internal slivers. **Removed (BMD-882)** — the derived check is gone and the fixture is now accepted.                                                       | `Post-intervention - complete with slivers.gpkg`                  | ➖ removed (BMD-882)                                                                              |
| PI-UV-7  | A valid file passing all validation lands on the post-intervention habitat list.                                                                                             | `Post-intervention - complete.gpkg`                               | ✅ happy path (full assert in Happy Path)                                                         |

**Dropped after discovery:** PI-UV-4 (`Post-intervention - incorrect geom column name.gpkg`)
is **accepted** by post-intervention validation — it passes and reaches the habitat list, so
it is not a rejection scenario (redundant with the happy path). The fixture is no longer
present in `test/example-files/`.

**Layout per fixture is asserted, not assumed.** The content-validation test is data-driven
over a `layout: 'single' | 'multi'` flag. A fixture that surfaces exactly one visible backend
error renders the BMD-405 single-error page (no error summary, inline "upload a new file"
link pointing at the post-intervention route, **no** "Upload a different file" button and
**no** "Back to project" link — frontend PR#175); a fixture with several errors keeps the
grouped multi-error layout ("We couldn't accept your post-intervention file" + error
summary + per-code blocks). Only `PI-UV-5c` currently exercises the multi-error layout.

**Removed (BMD-882).** The derived `SLIVERS_INSIDE_REDLINE` check was dropped as redundant:
internal gaps are now covered by `AREA_SUM_MISMATCH` (≥ 0.5 m²), and a new per-parcel
`AREA_PARCELS_TOO_SMALL` check rejects parcels under 1 m². `Post-intervention - complete with
slivers.gpkg` no longer trips a rejection and is **accepted**, so PI-UV-6 and its
content-validation test case were removed rather than rewritten. The surviving
`SLIVERS_OUTSIDE_REDLINE` check — parcel parts outside the boundary — is untouched, and no
post-intervention fixture currently reaches it.

**Now mirrored (PI-UV-8/PI-UV-9).** Two branches previously recorded here as unexercised are
covered:

- `ADVANCE_AND_DELAY_BOTH_SET` (backend BMD-883 / frontend PR#185) — the harness catalogued
  `attribute-problems/Post-intervention - advance and delay both set.gpkg` (BMD-883, 2026-07-29)
  after this doc was last reconciled; it is copied into `test/example-files/` and drives
  PI-UV-8. The check reads the **Proposed** advance/delay columns, so it applies to a
  post-intervention file exactly as to a baseline one.
- `HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE` on the **Proposed** columns — no harness fixture
  exists, so `Post-intervention - habitat distinctiveness out of scope.gpkg` is generated by
  `test/example-files/fixture-mutations.py` from the complete fixture (one parcel's proposed
  pair retargeted at "Grassland - Lowland meadows", V.High). This is the one place the
  post-intervention **variant selection** is observable end-to-end: wire the check to the
  Baseline columns by mistake and every baseline test still passes.

**Polling page (PI-UV-1).** The "Checking your file" page is rendered by the shared
`upload-received.njk` between the uploader redirect and the validation result. Against the
local/github stack the uploader returns `ready` almost immediately, so asserting the interim
render is a race; the happy path waits for the final habitat-list URL instead. The page is
covered by the frontend controller unit tests. Unblocking would need a stub uploader that can
be pinned `pending` — the same hook the 120s-timeout placeholder needs.

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

**Optional backend follow-up (still open, re-verified 2026-08-03):** the one
integration-level gap is that `post-intervention-persistence.test.js` does not assert
`postIntervention.filename` / `fileSize` end-to-end (BMD-451) — the file still contains no
reference to either field. Closing it belongs in `bng-metric-backend` via
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

| Ref     | Acceptance criterion                                                                                                                            | Coverage                                                                                                                                                        |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PI-UP-1 | The upload form shows an error summary titled "There is a problem" with the error rendered as a link.                                           | ✅ [upload-post-intervention.spec.js](../../specs/upload-post-intervention/upload-post-intervention.spec.js) — format error (summary + heading + link asserted) |
| PI-UP-2 | Clicking the error-summary link moves focus to the file-selection button (the GOV.UK enhanced "Choose file" button, `id="file"`). (BMD-366 AC2) | ✅ same test — the flash error is one-shot, so both assertions must share one page session                                                                      |
| PI-UP-3 | Visiting the received route with no pending upload in session bounces back to the upload form.                                                  | ✅ same spec — "no pending upload" describe                                                                                                                     |

**Already covered (no new tests):**

- **Multi-error** dropout page for a post-intervention rejection — "We couldn't accept your
  post-intervention file" + error summary + "Upload a different file"/"Back to project"
  links: ✅ `upload-post-intervention.spec.js`, PI-UV-5c (the only fixture that reaches the
  multi-error layout). The **single-error** layout deliberately asserts the _absence_ of
  those two actions.
- Generic fallback (no session) + unauthenticated `/error-file`: ✅ shared baseline
  [error-file.spec.js](../../specs/upload-baseline/error-file.spec.js) (the page is shared and upload-type-agnostic here).
- **Cross-user access (IDOR)**: uploading a valid post-intervention file against another
  user's project id — the form GET renders (200, ownership isn't checked there) but validation
  can't resolve the project for that user, so it drops out on the catch-all error page and
  nothing is persisted: ✅ `upload-post-intervention.spec.js` — "cross-user access" (stub-only:
  needs a second profile).
- **Role enforcement and unauthenticated access** for both
  `/projects/{id}/upload-post-intervention-file` and
  `/projects/{id}/post-intervention-upload-received`: ✅ [upload-post-intervention-file.spec.js](../../specs/upload-post-intervention/upload-post-intervention-file.spec.js) via the shared
  `describeRoleEnforcement` / `describeUnauthenticatedAccess` helpers.
- **Rejected upload** (uploader `numberOfRejectedFiles > 0`): ✅ unit — frontend
  `post-intervention-upload-received/controller.test.js` ("redirects to dropout page when
  post-intervention upload is rejected") + backend `upload.test.js`. Redirects to `/error-file`
  with empty errors → the generic dropout, covered above. Not browser-triggerable (client JS
  blocks a non-`.gpkg` submit), so no journey test — tracked as a documented `test.skip`
  placeholder ("Upload post-intervention — CDP Uploader rejection") carrying its unblock steps.

**Deferred / not mirrorable:**

- **120s timeout** flash ("The file check timed out") — impractical to exercise in a browser
  test; handled at the controller/unit level. Tracked as a documented `test.skip` placeholder
  ("Upload post-intervention — upload check timeout") carrying its unblock steps.
- **`SLIVERS_OUTSIDE_REDLINE` suppression** + "… and N more" truncation — no post-intervention
  fixture triggers the suppression branch (only `Baseline - parcel outside redline.gpkg` has
  `AREA_PARCELS_OUTSIDE_REDLINE`), and a geospatial-error `.gpkg` can't be generated by
  copy/rename. The suppression/grouping logic is on the **shared** `/error-file` page and is
  baseline-tested.
- **`AREA_PARCELS_TOO_SMALL` single-error copy** (BMD-882) — no post-intervention fixture
  trips the code (it needs a geometry mutation, not an attribute one). Frontend-unit tested
  (`single-error-copy.test.js`) and backend-integration tested.
  (`ADVANCE_AND_DELAY_BOTH_SET` is no longer in this list — see PI-UV-8 in §3.)
- **BMD-367 skeleton** (pathname `invalid-file`, "Dropout Page (Skeleton)" placeholder) —
  superseded; the real `/error-file` page is covered.

---

## 6. Happy Path

**Source:** no dedicated Jira ticket — this is the end-to-end journey. Mirrors the baseline
happy-path test.

**Journey:** create project → upload a valid post-intervention file → land on the
post-intervention habitat list → the project task list flips the post-intervention task to
"Completed".

**Precondition:** signed-in, approved BNG Completer, with a project.

| Ref     | Acceptance criterion                                                                                                                                              | Fixture                             | Coverage                                                        |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------- |
| PI-HP-1 | Uploading a valid `.gpkg` reaches the post-intervention habitat list (heading + Summary).                                                                         | `Post-intervention - complete.gpkg` | ✅ `upload-post-intervention.spec.js` happy path                |
| PI-HP-2 | After the upload, the task list shows the "On-site post intervention habitats" task as **Completed**, linking to the habitat list (counts 2/2). (= **PI-TRIG-5**) | `Post-intervention - complete.gpkg` | ✅ happy-path test now reopens the task list (added this title) |

**Already covered (no new tests):** the deeper habitat-list data — per-habitat sizes, units
and individual trees across the Areas/Hedgerows/Watercourses tabs — is covered by the
unit-calculation journey tests (BNG-528/529/530/587), so the happy path asserts only the
landing + the task-list Completed state.
