# Watercourses Baseline User Flow

## Overview

The user drills one level below the [watercourses summary](watercourses-summary.flow.md) to see every baseline watercourse in one sortable table, with a totals row, and clicks any row's Ref to open that feature's [habitat details](../habitat-details/habitat-details.flow.md) page. It replaces the watercourse half of the deprecated Habitat List page.

Added by **BMD-861** (frontend PR#258, 2026-09-02), with the missing summary-page link added by **PR#266** (2026-09-04). Its hedgerow twin `/hedgerows-baseline` ([BMD-859](hedgerows-baseline.flow.md)) shipped in the same two PRs and is the same shape — both are built by `createLinearHabitatBaselineController`, which differs from the [area habitats baseline](area-baseline.flow.md) only in swapping hectares for kilometres.

Each page still passes its **own** habitat key (`watercourses`) and unit field (`watercoursesTotal`), so a witness for the hedgerow page is not a witness for this one.

## Steps

### Step 1 — View the watercourses baseline `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/watercourses-baseline`
- **Template:** `src/server/common/templates/habitat-baseline-page.njk` (extends `common/templates/unit-type-page.njk`) — shared by all three baseline pages
- **Auth required:** Yes — active session + an **approved (status 3)** `bng completer` role (`requireBngCompleterRole` pre-method)
- **Backend endpoint:** `GET /projects/{id}` (via `fetchProjectOrThrow`)
- **Description:** Renders the full baseline feature table for watercourses.

  **Left navigation** — as [`hedgerows-baseline.flow.md`](hedgerows-baseline.flow.md) Step 1, except the current item is the **Baseline** child nested under **Watercourses**. `withBaselineChild` expands whichever section owns the current href, so Area habitats and Hedgerows render collapsed here while Watercourses keeps its link to `/projects/{id}/watercourses-summary` and its child renders as `<strong aria-current="page">Baseline</strong>`.

  **Both linear nav items are conditional**, on `projectHasHabitatData(project, '<key>')` — an OR across baseline and post-intervention. BMD-861's AC3 lists **Hedgerows** unconditionally, but the implementation gates it exactly as it gates Watercourses (BMD-898's rule): on a project with no hedgerows in either document, this page renders with a three-item nav. The conditional on **Watercourses** cannot be witnessed negatively here — a project with no watercourses has no meaningful watercourses baseline to open.

  **Heading** — project name caption, `<h1>Baseline for watercourses</h1>`, and the "Upload file" button with `returnUrl` pointing back here. Note this page keeps the unit-type label in its H1, where the watercourses **summary** page diverged to "Watercourse habitats" in PR#271.

  **Results** — `<h2>Watercourses results</h2>` followed by an `appUnitTypeSummary` carrying the same five tiles as the project summary's Watercourses section and the watercourses summary's Results section. As on every drill-down there is **no section `<h2>`** (no `headingHref`), so the section carries `aria-label="Watercourses"`.

  The baseline tile has **no action line at all** — `baselineAction: null` in the shared controller, because the link would point at the page the user is already on. This is BMD-861's AC5 as amended on 2026-09-04. Note the tile is `aria-label="Watercourses"` while the details pane below is `aria-label="Watercourses details"`, so a region locator must match **exactly** or it resolves to both.

  **Details** — `<h2>Watercourses details</h2>` and a table inside `<div class="moj-scrollable-pane" role="region" aria-label="Watercourses details" tabindex="0">`, marked `data-module="moj-sortable-table"`. **Seven** columns, in order:

  | #   | Column                 | Contents                                                                                                                       |
  | --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
  | 1   | Ref                    | `feature.ref` trimmed, falling back to `feature.featureId`; **linked** to the habitat details page when `featureId` is present |
  | 2   | Units                  | numeric — `formatHabitatUnits` (2dp, capped at 7 s.f.)                                                                         |
  | 3   | Size                   | numeric — `formatLengthKmDisplay` (metres → km, 7 s.f., `km` suffix, no space)                                                 |
  | 4   | Habitat type           | `feature.type` — the watercourse type, e.g. Canals, Ditches, Culvert                                                           |
  | 5   | Distinctiveness        | `"{label} ({score})"`, or the bare label when the score is non-finite                                                          |
  | 6   | Condition              | `"{label} ({score})"`, same rule                                                                                               |
  | 7   | Strategic significance | **always `Low (1)`** — hardcoded                                                                                               |

  **No "Broad habitat" column.** AC6 lists one, but the field does not apply to watercourses — confirmed on the ticket (Colin Gray, 2026-09-02). `buildColumns` inserts it only for callers that pass it as an `extraColumn`, which the area page does and the two linear pages do not. The column headings also render in GOV.UK sentence case ("Habitat type", "Strategic significance") rather than the AC's title case.

  **Strategic significance is fixed.** Per BMD-315 AC9 the value is pinned to `Low (1)` for MVS: the engine hardcodes the baseline multiplier to 1, so the category actually uploaded must not be shown against these units.

  **Row source and ordering.** `project.baseline.watercourses` only. Sorted server-side by Ref with `localeCompare(…, { numeric: true })`.

  **Sort keys.** Every Ref cell carries `data-sort-value` with each run of digits zero-padded to 10 characters (`refSortValue`); Units and Size cells carry their raw numeric value. These are what MoJ's SortableTable re-orders on, so they — not the rendered text — decide what a column click produces.

  **Totals row.** A `<tfoot>` row, all cells `govuk-!-font-weight-bold`: Ref reads `Total`, Units carries the summed value through `formatHabitatUnits`, and Size the summed metres through `formatBaselineTotalLengthSize` (**10** s.f., against the rows' 7). The remaining four columns are empty. `sumFinite` skips non-finite entries, so a feature with no units still lists but does not count — see "Rows with no calculable units" below, which is not a hypothetical for watercourses.

- **Validation:** `id` path param must be a valid uuidv4 (Joi); invalid → Hapi 400
- **On success:** Renders `common/templates/habitat-baseline-page` with page title "Baseline for watercourses - {serviceName}"
- **On error:** As [`area-baseline.flow.md`](area-baseline.flow.md) Step 1 — no-baseline redirect, 404, 502, session-expired

#### Rows with no calculable units

The engine cannot score every combination the import accepts. `bng-metric-engine/src/reference/watercourse-condition-scores.json` marks **every Culvert condition except Poor** as `"Not Possible"`, so a Culvert recorded as Good, Fairly Good, Moderate or Fairly Poor persists with no `units`, no `distinctivenessScore` and no `conditionScore`. On this page such a row renders with:

- an **empty Units cell** and an **empty Distinctiveness cell**, and
- a **Condition label with no multiplier** — "Good", not "Good (3)"

and is skipped by `sumFinite`, so the totals row and the tile above still agree with each other. `Baseline - all unit and intervention types.gpkg` carries two of these (R001 and R008, both Culvert/Good), which is why the grid assertions in the journey spec run against `Baseline - no hedgerows.gpkg` instead — BMD-861's ACs are all written under a precondition that units were calculated for every watercourse. Whether the import should reject the combination is an open question for the service team, raised from the BMD-861 evidence run on 2026-09-07.

---

### Step 2 — Redirect a project with no baseline to the task list `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/watercourses-baseline` (the guard branch)
- **Template:** None (302)
- **Auth required:** Yes — as Step 1
- **Backend endpoint:** `GET /projects/{id}`
- **Description:** `hasBaselineData(project)` false → redirect before rendering. As on the watercourses summary, the guard is on **any** baseline, not on watercourse data specifically — a project with an area-only baseline renders this page with an empty grid rather than redirecting.
- **Validation:** As Step 1
- **On success:** 302 to `/add-project-details/{id}`
- **On error:** As Step 1

---

### Step 3 — Open a watercourse's habitat details from the Ref column `[IMPLEMENTED]`

- **Route:** `GET /baseline-habitat-details?featureId={featureId}&projectId={id}`
- **Template:** See [`../habitat-details/habitat-details.flow.md`](../habitat-details/habitat-details.flow.md)
- **Auth required:** Yes — as Step 1
- **Backend endpoint:** `GET /projects/{projectId}/features/{featureId}`, which resolves the feature's type — a watercourse returns `{ type: 'watercourse', feature }` and the details page heads itself "Watercourse {ref}" (`baseline-habitat-details/strategies/watercourse.js`, `headingPrefix`) rather than "Habitat {ref}"
- **Description:** Each Ref cell links via `habitatDetailsHref` (`featureId` and `projectId` as `URLSearchParams`). A feature with **no `featureId`** renders its Ref as plain text — still listed, still counted in the totals.
- **Validation:** See the habitat-details flow
- **On success:** Renders the baseline habitat details page for that watercourse
- **On error:** See the habitat-details flow

---

## Entry points

| From                                                           | Href                                   | When                                                                          |
| -------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------- |
| Watercourses summary — nav Baseline child                      | `/projects/{id}/watercourses-baseline` | always (the child renders whenever Watercourses is the current section)       |
| Watercourses summary — "View on-site watercourses baseline"    | `/projects/{id}/watercourses-baseline` | always — **added by PR#266**; the tile was inert before it                    |
| Project summary — Watercourses section baseline tile           | `/projects/{id}/watercourses-baseline` | only when the Watercourses section renders, i.e. the project has watercourses |
| Any unit-type page nav — Watercourses, then its Baseline child | `/projects/{id}/watercourses-baseline` | two clicks; the child expands only once Watercourses is current               |

There is **no back link**; the left navigation is the only way up.

---

## Journey coverage

Added 2026-09-07 for the BMD-861 AC sweep — `test/specs/project-management/watercourses-baseline.spec.js` (7 tests, domain tag `@project-management`).

`watercourses-baseline/controller.test.js` covers this page through the shared `registerLinearBaselinePageTests` suite (13 tests), all with `wreck` mocked and two hand-built features. The journey tests cover only what that cannot reach:

| Test                                      | AC       | Why it needs a browser and real data                                                                                                                                                     |
| ----------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grid renders real watercourses            | 6, 7     | nothing else asserts that a really-imported watercourse carries `ref`, `sizeMetres`, `distinctiveness` and `condition` — the backend checks only that `units` is a number                |
| Totals row agrees with the unit aggregate | 6        | the totals row is summed **server-side from the rendered features**; the tile above comes from the backend's persisted `watercoursesTotal`. Two independent paths, compared nowhere else |
| Caption, tiles and upload action          | 4, 5, 11 | this page's own `returnUrl`, and that the five tiles render from a real project with no baseline action line                                                                             |
| Left navigation                           | 3, 12    | the only shape where the current item is a nested child under **Watercourses**                                                                                                           |
| Ref clickthrough                          | 10       | `baseline.watercourses` is a third backend collection, resolved by its own branch of the features endpoint and its own details-page strategy                                             |
| Entry from the watercourses summary       | 1        | both hrefs were asserted but neither was ever followed; the results-section link did not exist before PR#266                                                                             |
| Entry from the project summary            | 2        | `project-summary.spec.js:986` asserts the href and stops there                                                                                                                           |

Both projects come from `@utils/summary-projects.js` (`getAllUnitTypesProject`, `getBaselineOnlyProject`) and are already built by other specs in the same module-scope cache, so this file costs **no upload of its own** in CI.

**Deliberately not covered.** Three things, each with a named witness elsewhere:

- **`aria-sort` toggling and the resulting row order (AC8, AC9).** MoJ component behaviour — the ACs themselves say "default component behaviour" — witnessed by real clicks in `habitat-list-upload.spec.js:341-381`, and the row order this grid's sort keys produce is asserted in `hedgerows-baseline.spec.js:217`. That test drives the **same** builder, the same seven columns and the same unparameterised sort cells; only the rows differ.
- **The details pane overflowing horizontally (AC6's last bullet).** `hedgerows-baseline.spec.js:195` measures it on the same pane with the same column widths.
- **Following the four left-nav links (AC12).** `area-summary.spec.js:260` follows the same four destinations through the same shared macro; what this page needs to prove is that it **emits** them, which a fixture without hedgerows could not.

---

## Deferred elements

| Element                          | Current state                                | Marker      |
| -------------------------------- | -------------------------------------------- | ----------- |
| "View trading rules"             | inert `<span>` in the Trading Rules tile     | `[PLANNED]` |
| "View on-site post intervention" | inert `<span>` once post-intervention exists | `[PLANNED]` |
