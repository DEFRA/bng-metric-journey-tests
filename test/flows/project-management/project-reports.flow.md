# Project Reports — Site Report Download User Flow

## Overview

The user opens the **Reports** page for a project from the left-hand unit-type navigation, reads what the site report contains, and downloads it as a PDF. The report is generated on demand by the backend from the project's stored PostGIS geometry.

Added by **BMD-984** (frontend PR#248, 2026-09-18; backend PR#297). Two routes, deliberately split: `/projects/{id}/reports` is an ordinary HTML page that describes the report, and `/projects/{id}/report.pdf` is the download itself. The page exists so there is room to say what the report contains before the user commits to a download, and so future reports have somewhere to live.

The **only** entry point is the `Reports` item in the unit-type navigation — added unconditionally and always last by `buildUnitTypeNavigation`, so it appears on every page built from that helper. The project summary gained no download button of its own. See [`project-summary.flow.md`](project-summary.flow.md) and [`area-summary.flow.md`](area-summary.flow.md) Step 1 for the nav tables.

## Steps

### Step 1 — View the Reports page `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/reports`
- **Template:** `src/server/project-reports/index.njk`
- **Auth required:** Yes — active session + an **approved (status 3)** `bng completer` role (`requireBngCompleterRole` pre-method; redirects to `/auth/forbidden` otherwise)
- **Backend endpoint:** `GET /projects/{id}` via `fetchProjectOrThrow` (`src/server/common/helpers/fetch-project.js`)
- **Description:** Renders the wide two-column unit-type layout — a one-sixth navigation column (`appProjectNavigation`, label "Reports") and a five-sixths main column. The main column shows the project name as a `govuk-caption-l`, `<h1>Reports</h1>`, then an `<h2>Site report</h2>` with two paragraphs of body copy describing the contents ("the baseline and post-intervention habitats drawn on a map, the key figures, and every habitat parcel listed with its type, condition and area") and its freshness ("generated from your project as it is now, so download it again after making changes"). Below that sits a GOV.UK button, text **"Download site report (PDF)"**, `href` `/projects/{id}/report.pdf`, carrying `download` and `data-testid="site-report-link"` attributes.

  Note the download control is a **`govukButton` rendered as an anchor**, not a `<button>` and not a plain link — a locator built with `getByRole('link')` finds it, one built with `getByRole('button')` does not. The stable hook is `data-testid="site-report-link"`.

  **The navigation landmark is named `"Reports"` on this page, not `"Project summary"`.** `appProjectNavigation` renders `<nav aria-label="{{ params.label }}">`, and `project-reports/index.njk` is the **only** template in the service that passes anything other than `"Project summary"` (the others being `project-summary/index.njk`, `common/templates/unit-type-page.njk` and `unit-summary-placeholder.njk`). So `UnitTypeSummaryPage`'s navigation locator — `getByRole('navigation', { name: 'Project summary' })` — **finds nothing here**, and this page cannot reuse that page object's nav helpers unchanged. Worth raising with the frontend team: it is the same project navigation on every page, so the landmark name changing is likely unintended, and it duplicates the `<h1>`.

  The project name falls back to `DEFAULT_PROJECT_NAME` (`'Project'`) when the fetched document carries no name.

- **Validation:** `id` path param must be a valid **uuidv4** (`Joi.string().guid({ version: 'uuidv4' })`) — note this is stricter than the plain `.uuid()` used by some sibling routes; a well-formed non-v4 UUID is a 400 here
- **On success:** Renders `project-reports/index` with `siteReportHref` and `navigationItems`
- **On error:**
  - **No baseline** (`hasBaselineData(project)` false) → **302 redirect to `/add-project-details/{id}`** — the same guard and the same destination as the project summary page. There is no "nothing to report yet" state; the user is sent to the journey that gets the project a baseline.
  - Project missing or not visible to the user → `Boom.notFound` (404)
  - Backend unreachable or non-2xx → `Boom.badGateway` (502)

---

### Step 2 — Download the site report PDF `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/report.pdf`
- **Template:** None — the response is PDF bytes, not a view
- **Auth required:** Yes — same session + approved `bng completer` rule as Step 1
- **Backend endpoint:** `GET /projects/{projectId}/report.pdf` (backend `src/routes/report.js`), called through `fetchSiteReport` (`src/server/common/services/report.js`)
- **Description:** The frontend does not render the report. It holds the session, the backend holds the geometry, so this route exists to turn one into the other: the session's bearer token goes out, the PDF bytes come back, and the browser is told to save rather than display them.

  **The frontend rewrites the filename.** The backend sends a `content-disposition` naming the file after the site (`{sanitised-site-name}-report.pdf`, non-`[a-zA-Z0-9-_ ]` characters replaced with `-`, capped at 80 chars, falling back to `bng-site` when nothing alphanumeric survives). The frontend **discards that header** and substitutes its own:

  ```
  content-disposition: attachment; filename="bng-site-report-{projectId}.pdf"
  ```

  This is deliberate — forwarding a header built from a user-supplied project name through a second service is the thing being avoided; the project id is inert and always safe to interpolate. **A test asserting the backend's site-derived filename against this route will fail.** Assert `bng-site-report-{projectId}.pdf` here, and the site-derived name only against the backend directly.

  **Backend query params are not forwarded.** The backend accepts `basemap` (`vector` | `raster`, default `vector`) and `layout` (default per `DEFAULT_LAYOUT`). The frontend route builds its URL without either, so every download through the journey is the backend's default. These are not reachable from the UI.

  `fetchSiteReport` passes `json: false` to `backendRequest` — load-bearing, because `wreck-client.js` defaults `json: true`, which would have Wreck try to parse the PDF as JSON and throw on the first byte.

- **Validation:** `id` path param must be a valid **uuidv4**, as Step 1
- **On success:** `200` with `content-type: application/pdf` and the `content-disposition` above; body is the PDF buffer
- **On error:**
  - Backend `404` → `Boom.notFound` ("Project not found"). The backend returns 404 **both** for a project the user cannot see **and** for a project with no baseline to report on — the two are indistinguishable from the frontend. The Reports page only offers this link once a baseline exists, so reaching either case means a hand-typed URL.
  - Backend unreachable, non-2xx, or a 2xx with an empty body → `Boom.badGateway` ("Failed to generate the site report")
  - **Expired, unrefreshable session** → `fetchSiteReport` deliberately **rethrows** rather than returning a status, so the global error handler can redirect to `/auth/session-expired` instead of the user seeing a generic 502. See [`../authentication/session-expired.flow.md`](../authentication/session-expired.flow.md).

---

## Testing notes

**No journey coverage exists for either route yet.** Both are `[IMPLEMENTED]` and reachable; nothing in `test/specs/` visits them.

A few things only a journey test can witness, since the frontend unit suite mocks `wreck` throughout:

| Behaviour                                                | Why a mocked test cannot prove it                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| The `Reports` nav item resolves on a real project        | `unit-type-navigation.test.js` proves the builder as a pure function, never that the href routes |
| The backend actually returns PDF bytes for a real upload | every unit test hands the controller a hand-written buffer                                       |
| `json: false` survives the real Wreck client             | the failure mode is a parse throw against real bytes, which a mock never produces                |
| The no-baseline redirect                                 | needs a project that genuinely has no baseline, i.e. a real create-project run                   |

The download itself needs Playwright's `waitForEvent('download')` rather than a navigation assertion — the response is an attachment, so the page does not navigate.

Note this journey is **read-only against an existing project**, so per [`@utils/summary-projects.js`](../../utils/summary-projects.js) it can share the cached upload the other project-management specs already pay for rather than performing its own.
