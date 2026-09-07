# Hedgerows Baseline User Flow

## Overview

The user drills one level below the [hedgerows summary](hedgerows-summary.flow.md) to see every baseline hedgerow in one sortable table, with a totals row, and clicks any row's Ref to open that feature's [habitat details](../habitat-details/habitat-details.flow.md) page. It replaces the hedgerow half of the deprecated Habitat List page.

Added by **BMD-859** (frontend PR#258, 2026-09-02), with the missing summary-page link added by **PR#266** (2026-09-04). Its watercourse twin [`/watercourses-baseline`](watercourses-baseline.flow.md) (BMD-861) shipped in the same two PRs and is the same shape.

Structurally this is the [area habitats baseline](area-baseline.flow.md) with a different feature collection: one shared controller factory (`create-habitat-baseline-controller`), one shared grid builder (`baseline-habitat-grid`), and a linear wrapper (`create-linear-habitat-baseline-controller`) that swaps hectares for kilometres. Each page still passes its **own** habitat key and unit field, so a witness for one is not a witness for the other.

## Steps

### Step 1 — View the hedgerows baseline `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/hedgerows-baseline`
- **Template:** `src/server/common/templates/habitat-baseline-page.njk` (extends `common/templates/unit-type-page.njk`) — shared by all three baseline pages
- **Auth required:** Yes — active session + an **approved (status 3)** `bng completer` role (`requireBngCompleterRole` pre-method)
- **Backend endpoint:** `GET /projects/{id}` (via `fetchProjectOrThrow`)
- **Description:** Renders the full baseline feature table for hedgerows.

  **Left navigation** — as [`area-baseline.flow.md`](area-baseline.flow.md) Step 1, except the current item is the **Baseline** child nested under **Hedgerows**. `withBaselineChild` expands whichever section owns the current href, so Area habitats renders collapsed here while Hedgerows keeps its link to `/projects/{id}/hedgerows-summary` and its child renders as `<strong aria-current="page">Baseline</strong>`. **Watercourses** appears only when `projectHasHabitatData(project, 'watercourses')` — an OR across baseline and post-intervention.

  **Heading** — project name caption, `<h1>Baseline for hedgerows</h1>`, and the "Upload file" button with `returnUrl` pointing back here.

  **Results** — `<h2>Hedgerows results</h2>` followed by an `appUnitTypeSummary` carrying the same five tiles as the project summary's Hedgerows section and the hedgerows summary's Results section. As on every drill-down there is **no section `<h2>`** (no `headingHref`), so the section carries `aria-label="Hedgerows"`.

  The baseline tile has **no action line at all** — `baselineAction: null` in the shared controller, because the link would point at the page the user is already on. This is BMD-859's AC5 as amended on 2026-09-04: not an inert text line, nothing. Note the tile is `aria-label="Hedgerows"` while the details pane below is `aria-label="Hedgerows details"`, so a region locator must match **exactly** or it resolves to both.

  **Details** — `<h2>Hedgerows details</h2>` and a table inside `<div class="moj-scrollable-pane" role="region" aria-label="Hedgerows details" tabindex="0">`, marked `data-module="moj-sortable-table"`. **Seven** columns, in order:

  | #   | Column                 | Contents                                                                                                                       |
  | --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
  | 1   | Ref                    | `feature.ref` trimmed, falling back to `feature.featureId`; **linked** to the habitat details page when `featureId` is present |
  | 2   | Units                  | numeric — `formatHabitatUnits` (2dp, capped at 7 s.f.)                                                                         |
  | 3   | Size                   | numeric — `formatLengthKmDisplay` (metres → km, 7 s.f., `km` suffix, no space)                                                 |
  | 4   | Habitat type           | `feature.type`                                                                                                                 |
  | 5   | Distinctiveness        | `"{label} ({score})"`, or the bare label when the score is non-finite                                                          |
  | 6   | Condition              | `"{label} ({score})"`, same rule                                                                                               |
  | 7   | Strategic significance | **always `Low (1)`** — hardcoded                                                                                               |

  **No "Broad habitat" column.** AC6 lists one, but the field does not apply to hedgerows — confirmed on the ticket (Colin Gray, 2026-09-02). `buildColumns` inserts it only for callers that pass it as an `extraColumn`, which the area page does and the two linear pages do not. The column headings also render in GOV.UK sentence case ("Habitat type", "Strategic significance") rather than the AC's title case.

  **Strategic significance is fixed.** Per BMD-315 AC9 the value is pinned to `Low (1)` for MVS: the engine hardcodes the baseline multiplier to 1, so the category actually uploaded must not be shown against these units.

  **Row source and ordering.** `project.baseline.hedgerows` only — no second collection to merge, unlike the area page's habitats-plus-trees. Sorted server-side by Ref with `localeCompare(…, { numeric: true })`.

  **Sort keys.** Every Ref cell carries `data-sort-value` with each run of digits zero-padded to 10 characters (`refSortValue`); Units and Size cells carry their raw numeric value. These are what MoJ's SortableTable re-orders on, so they — not the rendered text — decide what a column click produces.

  **Totals row.** A `<tfoot>` row, all cells `govuk-!-font-weight-bold`: Ref reads `Total`, Units carries the summed value through `formatHabitatUnits`, and Size the summed metres through `formatBaselineTotalLengthSize` (**10** s.f., against the rows' 7). The remaining four columns are empty. `sumFinite` skips non-finite entries, so a feature with no units still lists but does not count.

- **Validation:** `id` path param must be a valid uuidv4 (Joi); invalid → Hapi 400
- **On success:** Renders `common/templates/habitat-baseline-page` with page title "Baseline for hedgerows - {serviceName}"
- **On error:** As [`area-baseline.flow.md`](area-baseline.flow.md) Step 1 — no-baseline redirect, 404, 502, session-expired

---

### Step 2 — Redirect a project with no baseline to the task list `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/hedgerows-baseline` (the guard branch)
- **Template:** None (302)
- **Auth required:** Yes — as Step 1
- **Backend endpoint:** `GET /projects/{id}`
- **Description:** `hasBaselineData(project)` false → redirect before rendering. As on the hedgerows summary, the guard is on **any** baseline, not on hedgerow data specifically — a project with an area-only baseline renders this page with an empty grid rather than redirecting.
- **Validation:** As Step 1
- **On success:** 302 to `/add-project-details/{id}`
- **On error:** As Step 1

---

### Step 3 — Open a hedgerow's habitat details from the Ref column `[IMPLEMENTED]`

- **Route:** `GET /baseline-habitat-details?featureId={featureId}&projectId={id}`
- **Template:** See [`../habitat-details/habitat-details.flow.md`](../habitat-details/habitat-details.flow.md)
- **Auth required:** Yes — as Step 1
- **Backend endpoint:** `GET /projects/{projectId}/features/{featureId}`, which resolves the feature's type — a hedgerow returns `{ type: 'hedgerow', feature }` and the details page heads itself "Hedgerow {ref}" rather than "Habitat {ref}"
- **Description:** Each Ref cell links via `habitatDetailsHref` (`featureId` and `projectId` as `URLSearchParams`). A feature with **no `featureId`** renders its Ref as plain text — still listed, still counted in the totals.
- **Validation:** See the habitat-details flow
- **On success:** Renders the baseline habitat details page for that hedgerow
- **On error:** See the habitat-details flow

---

## Entry points

| From                                                        | Href                                | When                                                                    |
| ----------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------- |
| Hedgerows summary — nav Baseline child                      | `/projects/{id}/hedgerows-baseline` | always (the child renders whenever Hedgerows is the current section)    |
| Hedgerows summary — "View on-site hedgerows baseline"       | `/projects/{id}/hedgerows-baseline` | always — **added by PR#266**; the tile was inert before it              |
| Project summary — Hedgerows section baseline tile           | `/projects/{id}/hedgerows-baseline` | only when the Hedgerows section renders, i.e. the project has hedgerows |
| Any unit-type page nav — Hedgerows, then its Baseline child | `/projects/{id}/hedgerows-baseline` | two clicks; the child expands only once Hedgerows is current            |

There is **no back link**; the left navigation is the only way up.

---

## Journey coverage

Added 2026-09-07 for the BMD-859 AC sweep — `test/specs/project-management/hedgerows-baseline.spec.js` (10 tests, domain tag `@project-management`), plus the AC1 entry-point assertions in `hedgerows-summary.spec.js`.

`hedgerows-baseline/controller.test.js` covers this page through the shared `registerLinearBaselinePageTests` suite (14 tests), all with `wreck` mocked and two hand-built features. The journey tests cover only what that cannot reach:

| Test                                          | AC       | Why it needs a browser and real data                                                                                                                                                  |
| --------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grid renders real hedgerows, totals agree     | 6, 7     | the totals row is summed **server-side from the rendered features**; the tile above comes from the backend's persisted `hedgerowsTotal`. Two independent paths, compared nowhere else |
| Details pane overflows horizontally           | 6        | the scrollbar requirement is a **layout** fact; the unit test sees the pane in the markup, only a browser sees it overflow                                                            |
| Column sort re-orders the rows                | 8, 9     | the unit test simulates the client sort over the emitted `data-sort-value`s; only a browser proves MoJ's component actually consumes them **on this table**                           |
| Caption, tiles and upload action              | 4, 5, 11 | this page's own `returnUrl`, and that the five tiles render from a real project with no baseline action line                                                                          |
| Left navigation, both halves of the condition | 3, 12    | the only shape where the current item is a nested child under **Hedgerows**; the negative half needs a project with hedgerows but no watercourses                                     |
| Ref clickthrough                              | 10       | `baseline.hedgerows` is a different backend collection from `baseline.habitats` — the area page's identical test resolves a different feature type                                    |
| Entry from the project summary                | 2        | `project-summary.spec.js` follows the area and watercourse baseline links, but on a fixture with no Hedgerows section at all                                                          |
| (hedgerows-summary.spec.js) both triggers     | 1        | the nav child's href was asserted but never followed, and the results-section link did not exist before PR#266                                                                        |

Both projects come from `@utils/summary-projects.js` (`getAllUnitTypesProject`, `getNoWatercoursesProject`) and are already built by other specs in the same module-scope cache, so this file costs **no upload of its own** in CI.

**Deliberately not covered.** The `aria-sort` attribute toggling itself is MoJ's component behaviour — the ACs say "default component behaviour" — and is already witnessed by real clicks in `habitat-list-upload.spec.js:341-381`. What the sort test here asserts instead is the **resulting row order**, which nothing else in any suite checks: the deprecated habitat list emits its own unpadded `data-sort-value`s and never asserts an order, and `baseline-habitat-grid.test.js:27` only simulates the comparison in Node. The zero-padded Ref sort key stays unreachable end-to-end for the reason given in [`area-baseline.flow.md`](area-baseline.flow.md) — every valid fixture uses fixed-width refs.

---

## Deferred elements

| Element                          | Current state                                | Marker      |
| -------------------------------- | -------------------------------------------- | ----------- |
| "View trading rules"             | inert `<span>` in the Trading Rules tile     | `[PLANNED]` |
| "View on-site post intervention" | inert `<span>` once post-intervention exists | `[PLANNED]` |
