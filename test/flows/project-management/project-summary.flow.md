# Project Summary User Flow

## Overview

After uploading a baseline file — or by clicking the project name on the dashboard — the user lands on the project summary: a single page showing, for each of the three habitat types (area habitats, hedgerows, watercourses), the on-site baseline units, the post-intervention units, the net unit change and the net percentage change against target. It is the landing page for **any project that has a baseline**, with or without post-intervention data.

Added by **BMD-870** (frontend PR#219, 2026-08-14), which built the baseline-only variant. **BMD-852** (frontend PR#227, 2026-08-18) added the post-intervention variant and widened the guard so a project carrying both documents renders here instead of being redirected to the task list. BMD-870 states the page **replaces the project task list (`/add-project-details/{id}`, to be deprecated in due course) and the summary section of the baseline habitat list**. The area / hedgerow / watercourse drill-down pages, trading rules and the project-details clickthrough remain separate tickets and are `[PLANNED]` here.

## Steps

### Step 1 — View project summary `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/project-summary`
- **Template:** `src/server/project-summary/index.njk`
- **Auth required:** Yes — active session + an **approved (status 3)** `bng completer` role (`requireBngCompleterRole` pre-method; redirects to `/auth/forbidden` otherwise)
- **Backend endpoint:** `GET /projects/{id}` (via `fetchProject` in `src/server/common/services/projects.js`)
- **Description:** Renders the summary for a project that has a baseline and no post-intervention data. Layout is a wide container (`app-width-container--wide`) split into a left navigation column and a main column.

  **Left navigation** — `<nav aria-label="Project summary">` with four items: **Summary** (current — rendered as `<strong aria-current="page">`, not a link), **Area Habitats**, **Hedgerows**, **Watercourses**. The latter three carry no `href` and render as plain text — see [Deferred elements](#deferred-elements).

  **Heading** — project name as a `govuk-caption-l`, `<h1>Summary</h1>`, and a GOV.UK **"Upload file"** button aligned to the right.

  **Three unit-type sections**, each an `appUnitTypeSummary` (`src/server/common/components/unit-type-summary/macro.njk`) rendered as `<section aria-labelledby="{id}-heading">` with an `<h2 id="{id}-heading">`. Ids and labels: `area-habitats` / "Area habitats", `hedgerows` / "Hedgerows", `watercourses` / "Watercourses". Each section contains five tiles:

  Three tiles are the same in both variants:

  | Tile             | Value                                                                            |
  | ---------------- | -------------------------------------------------------------------------------- |
  | Trading Rules    | text "View trading rules" — no link, see [Deferred elements](#deferred-elements) |
  | On-site baseline | `{units} units` + text "View on-site baseline" — no link                         |

  The other three depend on whether `project.postIntervention` exists (**BMD-852**):

  | Tile                                | Baseline only                                                                                       | Baseline **and** post-intervention                                                                                                  |
  | ----------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
  | Total on-site net percentage change | `-100.00%` when baseline units > 0, otherwise `N/A`                                                 | backend `*NetUnitChangePercentage`, 2dp + `%`; `N/A` when non-finite                                                                |
  | (status tag)                        | red `Not met` when baseline units > 0; **no tag at all** when 0                                     | green `Met` when the percentage ≥ **10**, else red `Not met`; **no tag** when `N/A`                                                 |
  | On-site post intervention           | heading `On-site post intervention`; `0.00 units`; **link** "Upload on-site post intervention file" | heading `On-site post-intervention` (**hyphenated**); backend units or `N/A`; inert text "View on-site post intervention" — no link |
  | Total on-site net unit change       | `{-baseline units} units`                                                                           | backend `*NetUnitChange` formatted as `{n} units`, or `N/A` when non-finite                                                         |

  The green `Met` state and the 10% target (`NET_GAIN_TARGET_PERCENTAGE`) are new in BMD-852 — before it, red `Not met` was the only reachable tag.

  **"View project details"** — a closing `<section aria-labelledby="project-details-heading">` with `<h2>View project details</h2>` and the body text "View and amend your project details, including project name and target percentage". No link.

  There is **no back link** on this page.

- **Unit sourcing and formatting:** baseline figures come from `project.baseline.units` (backend `src/utilities/features/feature-set-units.js`). Area habitats = `habitatsTotal + treesTotal`; hedgerows = `hedgerowsTotal`; watercourses = `watercoursesTotal`. A missing or non-finite value normalises to `0`. Formatting is `Number(value.toPrecision(15)).toFixed(2)` — always two decimal places, with a guard that renders `0.00` rather than `-0.00` (BMD-852 moved that guard to a string comparison, so it now also catches values like `-0.001`).

  **Baseline only:** post-intervention is fixed at `0.00`, so the net unit change is the negated baseline and the percentage is the hardcoded `-100.00%`.

  **With post-intervention (BMD-852):** the units, net unit change and net percentage all come from `project.postIntervention.units` — `habitatsNetUnitChange` / `habitatsNetUnitChangePercentage`, `hedgerowsNetUnitChange` / `hedgerowsNetUnitChangePercentage`, `watercoursesNetUnitChange` / `watercoursesNetUnitChangePercentage`, defined in backend `src/validation/project-shared-schemas.js:102-121`. The frontend computes none of them. Post-intervention area units are `habitatsTotal + treesTotal` as before, but render `N/A` rather than `0.00 units` when **both** are absent (`areaUnits(units, null)` + `formatOptionalUnits`).

- **Validation:** `id` path param must be a valid uuidv4 (Joi); invalid → Hapi 400
- **On success:** Renders `project-summary/index` with page title "Summary - {serviceName}"
- **On error:**
  - Project has **no baseline** → 302 to `/add-project-details/{id}` (Step 2)
  - Backend 404 → `Boom.notFound` → the global `error/index` page with heading `404` / "Page not found" and a 404 status. **Note this differs from the task list**, which catches the 404 and re-renders its own template with `error: true`
  - Backend unreachable (`fetchProject` resolves `null`) or any non-2xx / non-404 status → `Boom.badGateway` ("Failed to fetch project") → `error/index` with a 502
  - Dead, unrefreshable session → redirect to `/auth/session-expired` (handled in `catchAll`)

---

### Step 2 — Redirect a project with no baseline to the task list `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/project-summary` (same route — this is the guard branch)
- **Template:** None (302)
- **Auth required:** Yes — as Step 1
- **Backend endpoint:** `GET /projects/{id}`
- **Description:** The page needs a baseline to render anything. `hasBaselineData(project)` (`src/server/common/helpers/project-state.js`) is `Boolean(project?.baseline)`. When it is false the handler redirects to the task list before rendering.

  **Changed by BMD-852.** The helper was `isBaselineOnlyProject` — `Boolean(project?.baseline) && !project?.postIntervention` — so a project carrying **both** documents was also redirected away. It now renders the post-intervention variant of Step 1 instead. A journey test asserting the old both-documents redirect is asserting deleted behaviour.

- **Validation:** As Step 1
- **On success:** 302 to `/add-project-details/{id}` — reached only when the project has **no baseline** yet (never uploaded)
- **On error:** As Step 1

> **Reachability note.** Since BMD-852 this branch fires only for a project with no baseline at all, which in practice means one reached by direct URL before any upload — every successful baseline upload lands on the rendered page. (Backend BMD-850, commit `a2f2985`, additionally deletes `postIntervention` from the project JSONB whenever a baseline is replaced, so a replacement returns the project to the baseline-only variant of Step 1.)

---

### Step 3 — Start an upload from the summary `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/upload-file?returnUrl=%2Fprojects%2F{id}%2Fproject-summary`
- **Template:** `src/server/upload-file/index.njk`
- **Auth required:** Yes — as Step 1
- **Backend endpoint:** None (selection page)
- **Description:** Both live links on the summary — the header **"Upload file"** button and the **"Upload on-site post intervention file"** link inside every unit-type section — resolve to the _same_ href, built by `uploadFileHref(projectId, '/projects/{id}/project-summary')`. It is the shared file-type selection page from BMD-850, so the user picks baseline or post-intervention there; the summary does not link straight to a type-specific upload form despite the post-intervention wording on the in-section link. The `returnUrl` means Back/Cancel on the selection page and the upload form return **here**, not to the task list.
- **Validation:** See [`../upload-file/choose-upload-type.flow.md`](../upload-file/choose-upload-type.flow.md)
- **On success:** Selection page behaviour is documented in [`../upload-file/choose-upload-type.flow.md`](../upload-file/choose-upload-type.flow.md)
- **On error:** As above

---

## Entry points

| From                       | Href                             | When                                                                           |
| -------------------------- | -------------------------------- | ------------------------------------------------------------------------------ |
| Project dashboard row link | `/projects/{id}/project-summary` | project has a baseline; otherwise the row links to `/add-project-details/{id}` |
| Successful baseline upload | `/projects/{id}/project-summary` | always — `successRoute` on the baseline upload type                            |

**Dashboard (`GET /manage-projects`).** `projectsListController` maps each row to an `href` via `hasBaselineData(project.project)` (BMD-852; it was `isBaselineOnlyProject` under BMD-870, so a project with post-intervention data used to link to the task list) and the template renders `{{ item.href }}` instead of a hardcoded task-list path. The backend list endpoint returns whole project rows, so the JSONB needed for the test is present on the list response. See [`project-dashboard.flow.md`](project-dashboard.flow.md) Step 1.

**Baseline upload.** `HABITAT_UPLOAD_TYPES.baseline` gained `successRoute: 'project-summary'`, and `habitat-upload-received-controller.js` redirects to `successRoute ?? listRoute` on a `ready` upload that passes validation. The post-intervention upload type has **no** `successRoute`, so it still falls back to its `listRoute`. See [`../upload-baseline/upload-baseline-file.flow.md`](../upload-baseline/upload-baseline-file.flow.md) Step 5.

---

## Deferred elements

Out of scope for BMD-870 per the ticket, and present in the markup as inert text rather than links. Each becomes a step here when its own ticket lands.

| Element                                            | Current state                             | Marker      |
| -------------------------------------------------- | ----------------------------------------- | ----------- |
| "Area Habitats" / "Hedgerows" / "Watercourses" nav | plain `<li>` text, no `href`              | `[PLANNED]` |
| "View trading rules"                               | `<span>` inside the Trading Rules tile    | `[PLANNED]` |
| Trading rules status                               | not rendered                              | `[PLANNED]` |
| "View on-site baseline"                            | `<span>` inside the On-site baseline tile | `[PLANNED]` |
| "View on-site post intervention"                   | `<span>` in the PI tile once PI exists    | `[PLANNED]` |
| "View project details" clickthrough                | heading + body text only, no link         | `[PLANNED]` |
| Submitting the metric                              | not rendered                              | `[PLANNED]` |

The `appProjectNavigation` and `action()` macros both branch on `item.href` / `params.*.href`, so each of these becomes a link the moment its controller supplies an href — no template change needed.

---

## Known deviations from the design

- **Empty sections are not hidden.** BMD-870 notes "designs assume hedgerow and watercourse data is present in baseline and/or post-intervention — these sections are hidden if no data is present in practice." `buildProjectSummary` builds all three `unitSummaries` unconditionally, so a baseline with no hedgerows still renders a full Hedgerows section reading `N/A` / `0.00 units` / no status tag. Treat a test asserting three sections as documenting current behaviour, not confirming the design.
- **The three section headings are styled as links but are not links.** `.app-unit-type-summary__heading` (`src/client/stylesheets/components/_unit-type-summary.scss`) sets `color: $govuk-link-colour` and an underline, so "Area habitats" / "Hedgerows" / "Watercourses" render blue and underlined while carrying no `href` — presumably anticipating the drill-down tickets. The ticket's "text only for this first implementation (not a link)" is met in markup; only the styling deviates. Raised from the BMD-870 manual AC validation (2026-08-17).
- **The post-intervention link is not post-intervention-specific.** Its text says "Upload on-site post intervention file" but its href is the generic file-type selection page (Step 3), where the user could equally pick baseline.
- **The post-intervention tile heading is spelled two ways.** Without post-intervention data it reads "On-site post intervention"; with it, "On-site post-**intervention**" (hyphenated) — `buildUnitSummary` picks the heading per variant (`project-summary/controller.js`). Nothing else on the page hyphenates it, and the baseline tile's counterpart wording does not change. A test that looks a tile up by its heading must use the right spelling for the variant under test, or it fails as a missing element rather than a wrong value. Raised from the BMD-852 source analysis (2026-08-18).
