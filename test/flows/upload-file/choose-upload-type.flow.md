# Choose Upload Type User Flow

## Overview

Before uploading a GeoPackage, a BNG Completer chooses **which kind** of file they are
uploading — baseline or post-intervention — on a shared radio-button page. The page is the
single entry point to both upload journeys (BMD-850, frontend PR#207): the project summary and
every unit-type page link here rather than straight to a type-specific upload form. (Until
BMD-1043, frontend PR#352, the project task list and both habitat lists did; all three were
removed.)

There is **no ordering rule** any more. Until **BMD-1056** (frontend PR#377, 2026-10-13) the
page rejected post-intervention for a project with no stored baseline ("Upload a baseline file
before uploading a post intervention file"). A post-intervention GeoPackage now carries the
baseline in its Baseline columns, and the backend derives the baseline from it (backend PR#478),
so either type can be chosen first.

## Entry points

| From                                                                                  | Link                                                                  | Condition                         |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------- |
| Project summary — "Upload file" button                                                | `/projects/{id}/upload-file?returnUrl=/projects/{id}/project-summary` | always                            |
| Project summary — "Upload on-site post intervention file" link in a unit-type section | the same href                                                         | `project.postIntervention` absent |
| A unit-type page (summary, baseline, post intervention, trading) — "Upload file"      | `/projects/{id}/upload-file?returnUrl=/projects/{id}/<that page>`     | always                            |
| Either upload form — Back link and Cancel link                                        | `/projects/{id}/upload-file?returnUrl=<the returnUrl it was given>`   | always                            |

A bare `/projects/{id}/upload-file` (no `returnUrl`) is no longer linked from anywhere since
BMD-1043; it is what a direct URL produces, and its Back and Cancel then default to the project
summary.

## `returnUrl` and the navigation helper

All hrefs are built by `src/server/common/helpers/upload-file-navigation.js`:

- `safeUploadReturnUrl(returnUrl, projectId)` — an **open-redirect guard**. Returns the
  supplied value only when it is a string starting with a single `/` and containing no `\`;
  a non-string, a value starting `//`, a backslash-bearing value, or an absent value all
  fall back to `/projects/{projectId}/project-summary` (BMD-1043; it was the removed task list
  `/add-project-details/{projectId}`).
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
  caption
- **Description:** Renders H1 and page title "What would you like to upload?", the project
  name as caption (falling back to `"Project"` when the payload carries no name), two body
  lines — **"You can either use a baseline file to check the details of your project, or a
  post-intervention file to review its BNG status."** and **"Choose from the following
  options:"** — and a `govukRadios` group (`name="uploadType"`, `idPrefix="uploadType"`,
  visually-hidden legend) with two options:
  - `baseline` — "Baseline"
  - `postIntervention` — "Post-intervention"

  BMD-1056 (frontend PR#377) replaced the earlier body line "Uploading a file will overwrite
  any previous files you have uploaded." and the long option labels ("Baseline Biodiversity
  Net Gain GeoPackage (.gpkg) file" / "Post-intervention Biodiversity Net Gain GeoPackage
  (.gpkg) file"). PR#377's description spells the second option "Post-Intervention"; the
  shipped controller (`FILE_TYPES`) has "Post-intervention".

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
- **Backend endpoint:** `GET /projects/{id}` — re-fetched on submit for the caption on a
  re-render
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
  - Either type can always be selected. The post-intervention-needs-a-baseline check
    ("Upload a baseline file before uploading a post intervention file") was removed by
    BMD-1056 (frontend PR#377).
- **On success:**
  - `baseline` → redirect to `/projects/{id}/upload-baseline-file?returnUrl=<safe>`
  - `postIntervention` → redirect to `/projects/{id}/upload-post-intervention-file?returnUrl=<safe>`
- **On error:** Re-renders the form with the error summary and inline error (see Validation);
  backend failures map as in Step 1 (404 / 502)

---

## Consequence — each upload type replaces data

**A baseline upload discards post-intervention data.** Backend BMD-850 (PR#219) changed
`setProjectBaseline` (`bng-metric-backend/src/db/persist-project.js`) to write the new
baseline and delete the `postIntervention` key in a single JSONB update
(`${withBaseline} - 'postIntervention'`), alongside the geometry cleanup in the same upload
transaction. The visible effect is on the project summary: each unit-type section offers the
"Upload on-site post intervention file" link again, and the post-intervention pages have
nothing to list.

**A post-intervention upload replaces the baseline** (BMD-1056/BMD-1066, backend PR#478,
2026-10-13). The backend derives a baseline from the post-intervention file's Baseline columns
and writes both documents in one transaction (`setProjectBaselineAndPostIntervention`). Any
baseline uploaded earlier is replaced, along with any feature edits made to it. See
[`upload-post-intervention-file.flow.md`](../upload-post-intervention/upload-post-intervention-file.flow.md)
for which rows become the baseline.

The page no longer warns about either. Its old "Uploading a file will overwrite any previous
files you have uploaded." line was removed by frontend PR#377.

---

## Landing — the upload journeys (separate flows)

Both destinations are documented in their own flow docs and are **out of scope** here:

- [`test/flows/upload-baseline/upload-baseline-file.flow.md`](../upload-baseline/upload-baseline-file.flow.md)
- [`test/flows/upload-post-intervention/upload-post-intervention-file.flow.md`](../upload-post-intervention/upload-post-intervention-file.flow.md)
