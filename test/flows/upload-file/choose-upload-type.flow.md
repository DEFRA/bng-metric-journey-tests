# Choose Upload Type User Flow

## Overview

Before uploading a GeoPackage, a BNG Completer chooses **which kind** of file they are
uploading — baseline or post-intervention — on a shared radio-button page. The page is the
single entry point to both upload journeys (BMD-850, frontend PR#207): the project task list
and both habitat lists now link here rather than straight to a type-specific upload form.

It is also the first place the **baseline-before-post-intervention** ordering is enforced.
Selecting post-intervention for a project with no stored baseline is rejected inline; the
post-intervention upload route itself is still ungated, so a direct URL bypasses the check.

## Entry points

| From                                                             | Link                                                                                 | Condition                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------- |
| Task list "On-site baseline habitats" (`projects/task-list.njk`) | `/projects/{id}/upload-file` (no `returnUrl`)                                        | `isBaselineUploaded` is false         |
| Task list "On-site post intervention habitats"                   | `/projects/{id}/upload-file` (no `returnUrl`)                                        | `isPostInterventionUploaded` is false |
| Baseline habitat list — "Upload a different file"                | `/projects/{id}/upload-file?returnUrl=/projects/{id}/baseline-habitat-list`          | always                                |
| Post-intervention habitat list — "Upload a different file"       | `/projects/{id}/upload-file?returnUrl=/projects/{id}/post-intervention-habitat-list` | always                                |
| Either upload form — Back link and Cancel link                   | `/projects/{id}/upload-file?returnUrl=<the returnUrl it was given>`                  | always                                |

Because the task-list rows only link here while the corresponding upload is **absent**, the
habitat-list "Upload a different file" button is the only route back to this page once both
uploads exist.

## `returnUrl` and the navigation helper

All hrefs are built by `src/server/common/helpers/upload-file-navigation.js`:

- `safeUploadReturnUrl(returnUrl, projectId)` — an **open-redirect guard**. Returns the
  supplied value only when it is a string starting with a single `/` and containing no `\`;
  a non-string, a value starting `//`, a backslash-bearing value, or an absent value all
  fall back to `/add-project-details/{projectId}`.
- `uploadFileHref(projectId, returnUrl)` → `/projects/{projectId}/upload-file?returnUrl=<safe>`
- `selectedUploadHref(projectId, uploadRoute, returnUrl)` → `/projects/{projectId}/{uploadRoute}?returnUrl=<safe>`

The sanitised `returnUrl` is what drives Back, Cancel, and the hidden form field, so it
survives the round-trip through the POST and on into the chosen upload form.

## Steps

### Step 1 — View upload type selection `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/upload-file`
- **Template:** `src/server/upload-file/index.njk`
- **Auth required:** Yes (session + approved BNG Completer role — `requireBngCompleterRole`;
  redirects to `/auth/forbidden` when the role is missing, to sign-in when unauthenticated)
- **Backend endpoint:** `GET /projects/{id}` via `fetchProject` — supplies the project name
  caption and the `baseline` presence used by Step 2's validation
- **Description:** Renders H1 and page title "What would you like to upload?", the project
  name as caption (falling back to `"Project"` when the payload carries no name), the body
  line **"Uploading a file will overwrite any previous files you have uploaded."**, and a
  `govukRadios` group (`name="uploadType"`, `idPrefix="uploadType"`, visually-hidden legend)
  with two options:
  - `baseline` — "Baseline Biodiversity Net Gain GeoPackage (.gpkg) file"
  - `postIntervention` — "Post-intervention Biodiversity Net Gain GeoPackage (.gpkg) file"

  Neither radio is pre-selected on GET. Below the radios: a "Continue" button and a "Cancel"
  link. A hidden `returnUrl` input carries the sanitised return target through the POST. The
  Back link and the Cancel link both point at the sanitised `returnUrl`.

- **Validation:**
  - `id` path param must be a **uuidv4** → **400** if not. (Note this route _does_ validate
    the id, unlike `/projects/{id}/upload-baseline-file` and
    `/projects/{id}/upload-post-intervention-file`, which have no `params` schema.)
  - `returnUrl` query param is **not** Joi-validated — the route declares no `query` schema.
    It is sanitised at render time by `safeUploadReturnUrl` instead.
- **On success:** Renders the selection page
- **On error:**
  - Backend 404 → `Boom.notFound` (**404**)
  - Backend unreachable (`fetchProject` returns `null`) or any status outside 200–299 →
    `Boom.badGateway` (**502**, the shared "Something went wrong" page)

  This is stricter than the upload forms, which swallow a failed project fetch and caption
  the page "Project".

---

### Step 2 — Submit upload type selection `[IMPLEMENTED]`

- **Route:** `POST /projects/{id}/upload-file`
- **Template:** `src/server/upload-file/index.njk` (re-rendered on validation failure)
- **Auth required:** Yes — same guards as Step 1
- **Backend endpoint:** `GET /projects/{id}` — re-fetched on submit, both for the caption on
  a re-render and to test `project.baseline` for the ordering rule below
- **Description:** The user picks a file type and submits. On success they are redirected to
  the matching upload form with the `returnUrl` preserved.
- **Validation:**
  - `id` path param must be a **uuidv4** → 400
  - **Joi payload schema** — `uploadType` optional, and when present must be `''`,
    `'baseline'` or `'postIntervention'`; `returnUrl` optional string, empty allowed. Any
    other `uploadType` value → Hapi's default `failAction` → **400** (the route declares no
    custom `failAction`). The `crumb` CSRF field injected by the `appForm` macro is stripped
    by `@hapi/crumb` before validation, so it is not in the schema.
  - **Nothing selected** (missing or empty `uploadType`) → re-render with GOV.UK error
    summary and inline radio error: **"Select the type of file you want to upload"**
    (summary entry links to `#uploadType`). Page title becomes
    "Error: What would you like to upload?".
  - **Post-intervention selected while `project.baseline` is absent** → re-render the same
    way with: **"Upload a baseline file before uploading a post intervention file"**. The
    submitted radio stays checked on the re-rendered page.
  - Baseline has no equivalent precondition — it can always be selected.
- **On success:**
  - `baseline` → redirect to `/projects/{id}/upload-baseline-file?returnUrl=<safe>`
  - `postIntervention` → redirect to `/projects/{id}/upload-post-intervention-file?returnUrl=<safe>`
- **On error:** Re-renders the form with the error summary and inline error (see Validation);
  backend failures map as in Step 1 (404 / 502)

---

## Consequence — replacing a baseline discards post-intervention data

Backend BMD-850 (PR#219) changed `setProjectBaseline`
(`bng-metric-backend/src/db/persist-project.js`) to write the new baseline and delete the
`postIntervention` key in a single JSONB update (`${withBaseline} - 'postIntervention'`),
alongside the geometry cleanup in the same upload transaction.

So choosing **baseline** here and completing that upload **silently discards any existing
post-intervention data** for the project. The visible effect is on the task list: the
"On-site post intervention habitats" row reverts from "Completed" to "Not yet started", and
`/projects/{id}/post-intervention-habitat-list` renders with empty tabs. This is what the
page's "Uploading a file will overwrite any previous files you have uploaded." line warns
about, and it is the reason the post-intervention ordering rule exists in Step 2.

---

## Landing — the upload journeys (separate flows)

Both destinations are documented in their own flow docs and are **out of scope** here:

- [`test/flows/upload-baseline/upload-baseline-file.flow.md`](../upload-baseline/upload-baseline-file.flow.md)
- [`test/flows/upload-post-intervention/upload-post-intervention-file.flow.md`](../upload-post-intervention/upload-post-intervention-file.flow.md)
