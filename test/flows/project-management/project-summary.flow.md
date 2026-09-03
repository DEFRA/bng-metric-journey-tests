# Project Summary User Flow

## Overview

After uploading a baseline file — or by clicking the project name on the dashboard — the user lands on the project summary: a single page showing, for each habitat type the project actually has data for (area habitats, hedgerows, watercourses), the on-site baseline units, the post-intervention units, the net unit change and the net percentage change against target. It is the landing page for **any project that has a baseline**, with or without post-intervention data.

Added by **BMD-870** (frontend PR#219, 2026-08-14), which built the baseline-only variant. **BMD-852** (PR#227, 2026-08-18) added the post-intervention variant and widened the guard so a project carrying both documents renders here instead of being redirected to the task list. BMD-870 states the page **replaces the project task list (`/add-project-details/{id}`, to be deprecated in due course) and the summary section of the baseline habitat list**.

**Three further tickets have since changed this page** — check the [Deferred elements](#deferred-elements) and [Known deviations](#known-deviations-from-the-design) sections before trusting any older assertion about it:

| Ticket          | PR   | Date       | Effect on this page                                                                                                                               |
| --------------- | ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BMD-854**     | #237 | 2026-08-25 | Nav items, section headings and the area baseline tile became links; empty sections now hidden                                                    |
| **BMD-897**     | #238 | 2026-08-25 | Post-intervention-only variant — `Not applicable`, no status tag, no baseline action                                                              |
| **BMD-898**     | #233 | 2026-08-24 | Shared `buildUnitSummary` refactor behind the above; owns the ACs for the suppressed state                                                        |
| **BMD-859/861** | #258 | 2026-09-02 | Hedgerow and watercourse baseline pages: their baseline tiles became links, and every unit type now expands a Baseline nav child on its own pages |

Trading rules and the project-details clickthrough remain separate tickets and are still `[PLANNED]` here.

## Steps

### Step 1 — View project summary `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/project-summary`
- **Template:** `src/server/project-summary/index.njk`
- **Auth required:** Yes — active session + an **approved (status 3)** `bng completer` role (`requireBngCompleterRole` pre-method; redirects to `/auth/forbidden` otherwise)
- **Backend endpoint:** `GET /projects/{id}` (via `fetchProject` in `src/server/common/services/projects.js`)
- **Description:** Renders the summary for a project that has a baseline and no post-intervention data. Layout is a wide container (`app-width-container--wide`) split into a left navigation column and a main column.

  **Left navigation** — `<nav aria-label="Project summary">`, built by `buildUnitTypeNavigation` (`src/server/common/helpers/unit-type-navigation.js`). **Changed by BMD-854**: the items are now real links, and the list is **conditional rather than a fixed four**:

  | Item          | When present                                                                     |
  | ------------- | -------------------------------------------------------------------------------- |
  | Summary       | always — current here, so rendered `<strong aria-current="page">` with no `href` |
  | Area habitats | always — links to `/projects/{id}/area-summary`                                  |
  | Hedgerows     | only when `projectHasHabitatData(project, 'hedgerows')`                          |
  | Watercourses  | only when `projectHasHabitatData(project, 'watercourses')`                       |

  So the nav carries **two to four items**, not four. On this page every unit type renders collapsed — `withBaselineChild` attaches the **Baseline** child only to the section whose own summary or baseline page is current, and none of them is current here.

  **Heading** — project name as a `govuk-caption-l`, `<h1>Summary</h1>`, and a GOV.UK **"Upload file"** button aligned to the right.

  **One to three unit-type sections** (see the visibility rule under [Known deviations](#known-deviations-from-the-design)), each an `appUnitTypeSummary` (`src/server/common/components/unit-type-summary/macro.njk`) rendered as `<section aria-labelledby="{id}-heading">` with an `<h2 id="{id}-heading">`. Ids and labels: `area-habitats` / "Area habitats", `hedgerows` / "Hedgerows", `watercourses` / "Watercourses".

  **BMD-854 made the headings links.** Each `<h2>` now contains an `<a class="govuk-link">` to that unit type's drill-down page. The heading is driven by `headingHref`, and **the macro renders no `<h2>` at all when `headingHref` is absent** — falling back to `aria-label="{label}"` on the section instead of `aria-labelledby`. The project summary always supplies one; the drill-down pages never do. A locator that finds a unit-type section by its `<h2>` works here and finds nothing on `area-summary`, `area-baseline` or `hedgerows-summary`.

  Each section contains five tiles:

  Three tiles are the same in both variants:

  | Tile                                        | Value                                                                                                  |
  | ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
  | Trading Rules                               | text "View trading rules" — no link, see [Deferred elements](#deferred-elements)                       |
  | On-site baseline — **area habitats**        | `{units} units` + **link** "View on-site **area** baseline" → `/projects/{id}/area-baseline` (BMD-857) |
  | On-site baseline — hedgerows / watercourses | `{units} units` + **link** "View on-site **hedgerows/watercourses** baseline" (BMD-859/861)            |

  Every baseline tile here is a link since **BMD-859/861** (frontend PR#258, 2026-09-02), each naming its own unit type: "View on-site **area** baseline", "View on-site **hedgerows** baseline", "View on-site **watercourses** baseline". `buildUnitSummary` takes a `baselineAction`; the project summary now passes one per unit type, pointing at `/projects/{id}/{area|hedgerows|watercourses}-baseline`. The drill-down pages still pass none, so their own tiles stay inert.

  The other three depend on whether `project.postIntervention` exists (**BMD-852**):

  | Tile                                | Baseline only                                                                                       | Baseline **and** post-intervention                                                                                                  |
  | ----------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
  | Total on-site net percentage change | `-100.00%` when baseline units > 0, otherwise `N/A`                                                 | backend `*NetUnitChangePercentage`, 2dp + `%`; `N/A` when non-finite                                                                |
  | (status tag)                        | red `Not met` when baseline units > 0; **no tag at all** when 0                                     | green `Met` when the percentage ≥ **10**, else red `Not met`; **no tag** when `N/A`                                                 |
  | On-site post intervention           | heading `On-site post intervention`; `0.00 units`; **link** "Upload on-site post intervention file" | heading `On-site post-intervention` (**hyphenated**); backend units or `N/A`; inert text "View on-site post intervention" — no link |
  | Total on-site net unit change       | `{-baseline units} units`                                                                           | backend `*NetUnitChange` formatted as `{n} units`, or `N/A` when non-finite                                                         |

  The green `Met` state and the 10% target (`NET_GAIN_TARGET_PERCENTAGE`) are new in BMD-852 — before it, red `Not met` was the only reachable tag.

  **Threshold detail.** The comparison is made against the _rounded_ 2dp string, not the raw value, so a percentage of 9.999 formats to `10.00%` and renders `Met` even though it is below 10 (frontend `percentageSummary`). Worth confirming with the PO: the AC wording says "≥ 10%".

  **Fixtures that reach each state** (in `test/example-files/`, copied from `bng-metric-harness` `example-files/permutations/`; the harness generator prices each pair through the real `bng-metric-engine` and fails if it lands on the wrong side of the target):

  | State                                  | Fixture pair                          | Observed                                           |
  | -------------------------------------- | ------------------------------------- | -------------------------------------------------- |
  | Green `Met` — areas                    | `… - net gain met`                    | area habitats ~292%                                |
  | Green `Met` — hedgerows + watercourses | `… - linear net gain met`             | hedgerows ~64%, watercourses ~21%                  |
  | Red `Not met` from a **gain**          | `… - watercourse gain below target`   | watercourses ~+3.8% — pins the target at 10, not 0 |
  | Red `Not met` from a loss              | `… - all unit and intervention types` | all three types negative                           |

- **Post-intervention-only habitats (BMD-897, PR#238, 2026-08-25) `[IMPLEMENTED]`:** a unit type can appear in the post-intervention document with nothing in the baseline — a hedgerow created by the intervention, say. `hasPostInterventionOnlyHabitat(project, type)` detects it (empty/absent in `baseline`, non-empty in `postIntervention`), and that section renders a **fourth variant**, distinct from both the baseline-only and the both-documents cases above:

  | Element                   | Standard section                             | Post-intervention-only                           |
  | ------------------------- | -------------------------------------------- | ------------------------------------------------ |
  | Net percentage change     | formatted percentage                         | **`Not applicable`** — the literal string        |
  | Status tag                | green `Met` / red `Not met`                  | **no tag rendered at all**                       |
  | Baseline tile action      | link or inert text                           | **`null` — the action `<p>` is not rendered**    |
  | Post-intervention heading | "On-site post-**intervention**" (hyphenated) | "On-site post intervention" (**unhyphenated**)   |
  | Post-intervention action  | inert "View on-site post intervention"       | **link** "Upload on-site post intervention file" |

  There is no baseline to divide by, so a percentage would be meaningless — hence `Not applicable` rather than `N/A` or `-100.00%`. Both the missing tag and the missing baseline action are absences: assert them with a count or a non-visibility check, not by looking for different text.

  This variant applies to hedgerows and watercourses; area habitats always has a baseline when the page renders at all, since the no-baseline case redirects at Step 2. `buildProjectSummary` calls `hasPostInterventionOnlyHabitat` **once per unit type**, each with its own habitat-type string, so a witness for one linear type does not cover the other's call site.

  **Fixtures that reach this variant** — each pairs a baseline empty for one linear type with a post-intervention file that populates it. Pairing either baseline with `Post-intervention - complete.gpkg` instead drives the visibility OR the other way and suppresses the section entirely (BMD-898), so the PI file is what decides which ticket's behaviour is under test.

  | Unit type    | Baseline fixture                  | Post-intervention fixture                             |
  | ------------ | --------------------------------- | ----------------------------------------------------- |
  | Hedgerows    | `Baseline - no hedgerows.gpkg`    | `Post-intervention - complete with hedgerows.gpkg`    |
  | Watercourses | `Baseline - no watercourses.gpkg` | `Post-intervention - complete with watercourses.gpkg` |

  **BMD-897** (2026-08-25) is the ticket that states this variant as acceptance criteria — one AC per linear unit type, each enumerating all five tiles. Validated against the shipped page on 2026-09-02: both pass. Two questions the ACs raise are flagged "CONFIRM WITH UCD" and remain open — whether "View trading rules" should appear at all when no trading is possible, and whether the trading-rules status should read something rather than nothing.

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

**Dashboard (`GET /manage-projects`).** `projectsListController` maps each row to an `href` and the template renders `{{ item.href }}` instead of a hardcoded task-list path.

**Changed by BMD-933** (frontend PR#230, backend PR#262/#286, 2026-08-19/26). The test is now `project.has_baseline ?? hasBaselineData(project.project)` — a **flag on the list row**, with the old JSONB check kept only as a fallback for the window where the frontend deploys ahead of the backend that sets it. The backend list endpoint **no longer returns the whole project document**; it loads only the fields the list page needs. The earlier claim here — that the JSONB needed for the test is present on the list response — is **no longer true**, and a test or fixture relying on `project.project.baseline` coming back from `GET /users/{userId}/projects` is relying on data the endpoint has stopped sending. See [`project-dashboard.flow.md`](project-dashboard.flow.md) Step 1.

**Baseline upload.** `HABITAT_UPLOAD_TYPES.baseline` gained `successRoute: 'project-summary'`, and `habitat-upload-received-controller.js` redirects to `successRoute ?? listRoute` on a `ready` upload that passes validation. The post-intervention upload type has **no** `successRoute`, so it still falls back to its `listRoute`. See [`../upload-baseline/upload-baseline-file.flow.md`](../upload-baseline/upload-baseline-file.flow.md) Step 5.

---

## Deferred elements

Out of scope for BMD-870 per the ticket. Four of the seven have since shipped — **BMD-854** (PR#237, 2026-08-25) built the drill-down pages and wired the navigation, **BMD-857** (PR#244) the area baseline page, **BMD-855/919** (PR#249) the hedgerows page, and **BMD-859/861** (PR#258, 2026-09-02) the hedgerow and watercourse baseline pages. What remains is inert text rather than links.

| Element                                            | Current state                                                                               | Marker          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------- |
| "Area Habitats" / "Hedgerows" / "Watercourses" nav | **real links** — and conditional; see Step 1                                                | `[IMPLEMENTED]` |
| Unit-type section headings                         | **real links** to each drill-down page                                                      | `[IMPLEMENTED]` |
| "View on-site baseline" — **area habitats only**   | **link** to `/projects/{id}/area-baseline`, text changed to "View on-site area baseline"    | `[IMPLEMENTED]` |
| "View on-site baseline" — hedgerows / watercourses | **links** to `/projects/{id}/hedgerows-baseline` and `/watercourses-baseline` (BMD-859/861) | `[IMPLEMENTED]` |
| "View trading rules"                               | `<span>` inside the Trading Rules tile                                                      | `[PLANNED]`     |
| Trading rules status                               | not rendered                                                                                | `[PLANNED]`     |
| "View on-site post intervention"                   | `<span>` in the PI tile once PI exists                                                      | `[PLANNED]`     |
| "View project details" clickthrough                | heading + body text only, no link                                                           | `[PLANNED]`     |
| Submitting the metric                              | not rendered                                                                                | `[PLANNED]`     |

The drill-down pages are documented in [`area-summary.flow.md`](area-summary.flow.md), [`area-baseline.flow.md`](area-baseline.flow.md), [`hedgerows-summary.flow.md`](hedgerows-summary.flow.md) and [`watercourses-summary.flow.md`](watercourses-summary.flow.md).

The `appProjectNavigation` and `action()` macros both branch on `item.href` / `params.*.href`, so each of these becomes a link the moment its controller supplies an href — no template change needed.

---

## Known deviations from the design

- ~~**Empty sections are not hidden.**~~ **Resolved by BMD-854 (PR#237, 2026-08-25.)** `buildProjectSummary` now filters `unitTypes` on a `visible` flag before rendering: area habitats is always visible, hedgerows and watercourses only when `projectHasHabitatData(project, type)` finds a non-empty array on **either** the baseline or the post-intervention document. A baseline with no hedgerows renders **two** sections, not three. **Any test asserting a fixed three sections now fails**, and the empty-section values it used to assert (`N/A` / `0.00 units` / no tag) are no longer reachable this way.

  **The condition is an OR across the two documents, and the same flag drives the nav** (`buildUnitTypeNavigation`, `unit-type-navigation.js:64,71`) — so a unit type disappears from the left navigation and the main page together, and only when **both** documents are empty for it. **BMD-898** (2026-09-02) is the ticket that states that as acceptance criteria, one AC per combination:

  | Scenario                    | Baseline fixture                  | Post-intervention fixture           | Sections rendered           |
  | --------------------------- | --------------------------------- | ----------------------------------- | --------------------------- |
  | Baseline only, no hedgerows | `Baseline - no hedgerows.gpkg`    | —                                   | Area habitats, Watercourses |
  | Baseline + PI, no hedgerows | `Baseline - no hedgerows.gpkg`    | `Post-intervention - complete.gpkg` | Area habitats, Watercourses |
  | Baseline only, no rivers    | `Baseline - no watercourses.gpkg` | —                                   | Area habitats, Hedgerows    |
  | Baseline + PI, no rivers    | `Baseline - no watercourses.gpkg` | `Post-intervention - complete.gpkg` | Area habitats, Hedgerows    |

  `Post-intervention - complete.gpkg` is the only shipped PI fixture with **no** Hedgerows and **no** Rivers layer, which is what makes the both-empty branch reachable at all. Note the contrast with the pairings above it in this doc: `Post-intervention - complete with hedgerows.gpkg` over the same no-hedgerows baseline drives the OR the **other** way and renders the section as BMD-897's post-intervention-only variant. Picking the wrong PI file therefore silently tests the opposite behaviour.

- ~~**The three section headings are styled as links but are not links.**~~ **Resolved by BMD-854.** They are now real `<a class="govuk-link">` elements inside the `<h2>`, pointing at each unit type's drill-down page.
- **The post-intervention link is not post-intervention-specific.** Its text says "Upload on-site post intervention file" but its href is the generic file-type selection page (Step 3), where the user could equally pick baseline.
- **The post-intervention tile heading is spelled two ways.** Without post-intervention data it reads "On-site post intervention"; with it, "On-site post-**intervention**" (hyphenated) — `buildUnitSummary` picks the heading per variant (`project-summary/controller.js`). Nothing else on the page hyphenates it, and the baseline tile's counterpart wording does not change. A test that looks a tile up by its heading must use the right spelling for the variant under test, or it fails as a missing element rather than a wrong value. Raised from the BMD-852 source analysis (2026-08-18).
