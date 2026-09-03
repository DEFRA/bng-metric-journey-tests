# Area Habitats Baseline User Flow

## Overview

The user drills one level below the [area habitats summary](area-summary.flow.md) to see every baseline area feature — habitat parcels and individual trees together — in one sortable table, with a totals row, and clicks any row's Ref to open that feature's [habitat details](../habitat-details/habitat-details.flow.md) page.

Added by **BMD-857** (frontend PR#244, 2026-08-27). It is the deepest page in the unit-type navigation and the only one with a `children` entry in the nav.

## Steps

### Step 1 — View the area habitats baseline `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/area-baseline`
- **Template:** `src/server/area-baseline/index.njk` (extends `common/templates/unit-type-page.njk`)
- **Auth required:** Yes — active session + an **approved (status 3)** `bng completer` role (`requireBngCompleterRole` pre-method)
- **Backend endpoint:** `GET /projects/{id}` (via `fetchProjectOrThrow`)
- **Description:** Renders the full baseline feature table for area habitats.

  **Left navigation** — as [`area-summary.flow.md`](area-summary.flow.md) Step 1, except the current item is the **Baseline** child nested under Area habitats. Because the current href is `area-baseline`, `buildUnitTypeItem` expands Area habitats — the parent keeps its link to `/projects/{id}/area-summary` while the child renders as `<strong aria-current="page">Baseline</strong>`.

  **Heading** — project name caption, `<h1>Baseline for area habitats</h1>`, and the "Upload file" button with `returnUrl` pointing back here.

  **Results** — `<h2>Area habitats results</h2>` followed by an `appUnitTypeSummary`. As on the area summary there is **no section `<h2>`** (no `headingHref`), so the section carries `aria-label="Area habitats"`. Its baseline tile action is `areaBaselineAction()` called with **no href** — the text "View on-site area baseline" renders as an inert `<span>`, because the user is already on that page.

  **Details** — `<h2>Area habitat details</h2>` and a table inside `<div class="moj-scrollable-pane" role="region" aria-label="Area habitat details" tabindex="0">`, marked `data-module="moj-sortable-table"`. Eight columns, in order:

  | #   | Column                 | Contents                                                                                                                       |
  | --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
  | 1   | Ref                    | `feature.ref` trimmed, falling back to `feature.featureId`; **linked** to the habitat details page when `featureId` is present |
  | 2   | Units                  | numeric — `formatHabitatUnits` (2dp, capped at 7 s.f.)                                                                         |
  | 3   | Size                   | numeric — `formatAreaHectares` (hectares, 10 s.f., `ha` suffix)                                                                |
  | 4   | Broad habitat          | `feature.broadType`                                                                                                            |
  | 5   | Habitat type           | `feature.type`                                                                                                                 |
  | 6   | Distinctiveness        | `"{label} ({score})"`, or the bare label when the score is non-finite                                                          |
  | 7   | Condition              | `"{label} ({score})"`, same rule                                                                                               |
  | 8   | Strategic significance | **always `Low (1)`** — hardcoded                                                                                               |

  **Strategic significance is fixed.** Per BMD-315 AC9 the value is pinned to `Low (1)` for MVS, matching the baseline and post-intervention details pages: the engine hardcodes the baseline multiplier to 1, so the category actually uploaded must not be shown against these units. A test asserting this column reflects the GeoPackage is asserting behaviour the service deliberately does not have.

  **Row source and ordering.** `collectAreaFeatures` concatenates `project.baseline.habitats` and `project.baseline.trees` into one list — trees are **not** a separate table — then sorts by Ref with `localeCompare(…, { numeric: true })`.

  **Sort keys.** Every Ref cell carries `data-sort-value` with each run of digits zero-padded to 10 characters (`refSortValue`). MoJ's SortableTable compares non-numeric sort values with a plain `localeCompare`, which would otherwise order `P-10` before `P-2`; the padding keeps a Ref-column click in the order the server rendered. Units and Size cells carry their raw numeric value as `data-sort-value` instead.

  **Totals row.** A `<tfoot>` row, all cells `govuk-!-font-weight-bold`: the Ref column reads `Total`, Units and Size carry the summed values (`sumFinite` skips non-finite entries), and the remaining five columns are empty. The totals are computed over the same combined habitats-plus-trees list.

- **Validation:** `id` path param must be a valid uuidv4 (Joi); invalid → Hapi 400
- **On success:** Renders `area-baseline/index` with page title "Baseline for area habitats - {serviceName}"
- **On error:** As [`area-summary.flow.md`](area-summary.flow.md) Step 1 — no-baseline redirect, 404, 502, session-expired

---

### Step 2 — Redirect a project with no baseline to the task list `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/area-baseline` (the guard branch)
- **Template:** None (302)
- **Auth required:** Yes — as Step 1
- **Backend endpoint:** `GET /projects/{id}`
- **Description:** `hasBaselineData(project)` false → redirect before rendering, identical to every other unit-type page.
- **Validation:** As Step 1
- **On success:** 302 to `/add-project-details/{id}`
- **On error:** As Step 1

---

### Step 3 — Open a feature's habitat details from the Ref column `[IMPLEMENTED]`

- **Route:** `GET /baseline-habitat-details?featureId={featureId}&projectId={id}`
- **Template:** `src/server/habitat-details/…` — see [`../habitat-details/habitat-details.flow.md`](../habitat-details/habitat-details.flow.md)
- **Auth required:** Yes — as Step 1
- **Backend endpoint:** See the habitat-details flow
- **Description:** Each Ref cell links to the baseline habitat details page for that feature, built by `habitatDetailsHref` from `HABITAT_UPLOAD_TYPES.baseline.detailsRoute` with `featureId` and `projectId` as query params (URL-encoded via `URLSearchParams`). A feature with **no `featureId`** renders its Ref as plain text with no link — the row is still listed and still counts toward the totals.
- **Validation:** See the habitat-details flow
- **On success:** Renders the habitat details page for that feature
- **On error:** See the habitat-details flow

---

## Entry points

| From                                                 | Href                           | When                                                                     |
| ---------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------ |
| Area habitats summary — nav Baseline child           | `/projects/{id}/area-baseline` | always (the child renders whenever Area habitats is the current section) |
| Area habitats summary — "View on-site area baseline" | `/projects/{id}/area-baseline` | always                                                                   |
| Project summary — area habitats baseline tile        | `/projects/{id}/area-baseline` | always — the only linked baseline tile on that page                      |

There is **no back link**; the left navigation is the only way up.

---

## Journey coverage

Added 2026-09-01, extended 2026-09-03 for the BMD-857 AC sweep — `test/specs/project-management/area-baseline.spec.js` (7 tests, domain tag `@project-management`), plus one entry-point test in `project-summary.spec.js`.

`area-baseline/controller.test.js` covers this page in 16 tests, all with `wreck` mocked and hand-built features. The journey tests cover only what that cannot reach:

| Test                                      | AC       | Why it needs a browser and real data                                                                                                                                 |
| ----------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parcels and trees in one table            | 6        | proves `baseline.habitats` **and** `baseline.trees` both arrive and render as one table — trees are a separate collection in the payload but area habitats for units |
| Totals row agrees with the unit aggregate | 6        | the totals are summed server-side from the rendered features; the tile comes from the backend's persisted aggregate. Two independent paths, compared nowhere else    |
| Row formatting + fixed `Low (1)`          | 6        | that real uploaded data does not leak its own strategic-significance category, and that every row — not just the first — formats                                     |
| Details pane overflows horizontally       | 6        | the scrollbar requirement is a **layout** fact. `controller.test.js:434` sees the pane in the markup; only a browser can see it overflow                             |
| Heading, results tiles and upload action  | 4, 5, 11 | that the caption, the five tiles and this page's own `returnUrl` render from a real project                                                                          |
| Left navigation                           | 3, 12    | the only page where the current item is a nested child **and** its parent stays a link. Needs the all-unit-types fixture: the shared baseline has no hedgerows       |
| Ref clickthrough                          | 10       | unit tests assert the href is in the markup, not that following it resolves to that feature                                                                          |
| (project-summary.spec.js) baseline tile   | 2        | the project summary asserted the href but had never followed it                                                                                                      |

**Deliberately not covered, with reasons.** The zero-padded Ref sort key (`refSortValue`) is **unreachable by journey test**: every valid fixture in this repo and the harness uses fixed-width refs (`H001`, `T001`), where naive string sorting gives the identical order. The only variable-width fixture is `Baseline - duplicate habitat ref.gpkg` (`DUP-1`, `H003`), which fails validation and never reaches this page. Covering it end-to-end would need a new fixture built for the purpose; `controller.test.js:188` covers the attribute value meanwhile.

`aria-sort` toggling (**AC8/AC9**) is the MoJ component's own behaviour — the ACs say so themselves — and is already witnessed by real clicks against our `data-sort-value` attributes in `habitat-list-upload.spec.js:342-380`. The attributes this page emits are asserted in `baseline-habitat-grid.test.js:27,55`. A second real-click witness here would test MoJ's library rather than our wiring. Manual evidence for both directions on this page was captured under BMD-857's `/validate-ac-manual` run.

---

## Deferred elements

| Element                               | Current state                                | Marker      |
| ------------------------------------- | -------------------------------------------- | ----------- |
| "View trading rules"                  | inert `<span>` in the Trading Rules tile     | `[PLANNED]` |
| "View on-site post intervention"      | inert `<span>` once post-intervention exists | `[PLANNED]` |
| Hedgerow / watercourse baseline pages | do not exist — only area habitats has one    | `[PLANNED]` |
