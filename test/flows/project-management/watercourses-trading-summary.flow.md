# Watercourses Trading Summary User Flow

## Overview

From the [watercourses summary](watercourses-summary.flow.md), the user opens the watercourse trading rules. The page shows whether each distinctiveness band meets them, and the per-type unit changes behind each verdict. The page only displays figures. Every number and every Met / Not met is calculated by the backend at Post intervention upload, and read straight off the project.

Added by **BMD-1029** (frontend PR#347, 2026-10-01). The links into it came from **BMD-1026/BMD-1031** (PR#340, 2026-09-30). PR#351 (2026-10-01) changed the nav wording to "Post intervention" and "Trading rules". The Low tag on the cumulative tile came with PR#387 (2026-10-14). The page is built from the same shared helper as the [area](area-trading-summary.flow.md) and [hedgerows](hedgerows-trading-summary.flow.md) trading summaries (`common/helpers/trading-summary.js`, `trading-summary/macro.njk`). Only its labels, columns and totals rows differ.

## Steps

### Step 1 — View the watercourses trading summary `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/watercourses-trading-summary`
- **Template:** `src/server/watercourses-trading-summary/index.njk` (extends `common/templates/unit-type-page.njk`; body is the shared `tradingSummary` macro)
- **Auth required:** Yes. Like every unit-type page, it needs an active session and an approved `bng completer` role
- **Backend endpoint:** `GET /projects/{id}` (via `fetchProjectOrThrow`)
- **Description:** Renders `project.postIntervention.tradingRules.watercourses` (the figures, with `habitats` as the per-type list) and `project.tradingRuleStatuses.watercourses` (`medium` / `low` statuses).

  **Left navigation**: built by `buildUnitTypeNavigation`. Watercourses expands to **Baseline → Post intervention → Trading rules**. Trading rules is the current item (`<strong aria-current="page">`, no link). Area habitats / Hedgerows collapse. Hedgerows renders only when the project has hedgerow data. Reports is always last.

  **Heading**: project name caption, `<h1>Watercourses trading summary</h1>`, and an "Upload file" button whose `returnUrl` is this page.

  **Trading summary**: `<section aria-labelledby="trading-summary-heading">`, a table with "Distinctiveness group" / "Status" columns and one row per band **present** (`Medium`, `Low`), each with a green `Met` or red `Not met` tag. A band with no watercourse of that distinctiveness is left out rather than shown as a pass.

  **Medium distinctiveness**: only when a Medium watercourse is present.

  | Element      | Content                                                                                                                            |
  | ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
  | Deficit tile | "Remaining losses; like for like not satisfied": `figures.medium.deficit` as `{n} units` (2 dp), with the Medium status tag        |
  | One grid     | No `<h3>`, no broad-habitat grouping. Columns "Habitat type" / "Unit change", a row per Medium watercourse type, **no totals row** |

  **Low distinctiveness**: only when a Low watercourse is present. It has an `<h2>` and three tiles:

  | Tile                                                           | Figure                                                 |
  | -------------------------------------------------------------- | ------------------------------------------------------ |
  | "Low distinctiveness net change in units"                      | `figures.low.netUnitChange`                            |
  | "Medium units available to offset low distinctiveness deficit" | `figures.medium.surplus`                               |
  | "Cumulative surplus of units"                                  | `figures.low.cumulativeAvailability`, with the Low tag |

  Then comes one grid, "Habitat type" / "Unit change", with **no totals row** (`showLowTotals: false`). The area page has a "Total on-site unit change" row here; this page does not.

  There is no Very low band on this page (unlike hedgerows). High and Very high are outside the trading rules.

  **Display rounding vs. the verdict.** As on the area page, values render to 2 dp, but the backend decides the statuses at full precision. A fractional deficit can read "0.00 units" next to a red "Not met".

- **Validation:** None (display-only). Guards below
- **On success:** Renders with page title "Watercourses trading summary - {serviceName}"
- **On error:**
  - No baseline → 302 to `/projects/{id}/project-summary`
  - No Post intervention document → 302 to `/projects/{id}/watercourses-summary` (there's nothing to trade against, and the page isn't linked before then)
  - The controller passes no `habitatKey`, so a project with **no watercourses** but a Post intervention file is not redirected. It renders the page: an empty status table if the backend saved watercourse figures with no habitats, or the "not calculated" inset below if it saved none
  - Post intervention document without figures (uploaded before the figures were calculated, or the calculation failed) → inset text "Trading rules have not been calculated for this project. Upload the post-intervention file again to calculate them." and no tables
  - Backend 404 / unreachable → `error/index` (404 / 502), as on every unit-type page

---

## Entry points

| From                                                                                         | Element                                                                       | When                       |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------- |
| Watercourses summary, watercourses baseline, watercourses Post intervention                  | "Trading rules" child under Watercourses in the left nav                      | Post intervention uploaded |
| Project summary, watercourses summary, watercourses baseline, watercourses Post intervention | "View watercourses trading rules" link in the watercourses Trading Rules tile | Post intervention uploaded |

Before a Post intervention upload, the tile keeps the inert "View trading rules" text and the nav child does not render.

---

## Journey coverage

`test/specs/project-management/watercourses-trading-summary.spec.js` (domain tag `@project-management`). The entry-point tests came with BMD-1031. The band-section tests were added on 2026-10-15 by `/discover-journey-tests`. Every project comes from `@utils/summary-projects.js`, so in a full run they cost no extra upload.

| Test                                                                                                                                   | Project                                  | Witnesses                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a Medium band with no deficit reads "Met" and no Low band is listed                                                                    | `getTargetMetProject`                    | status table `[Medium]`, Medium Met; deficit tile "0.00 units" + Met tag; grid Canals 0.47; Low section absent                                                                                                                            |
| a Medium deficit and a Low running total below zero both read "Not met"                                                                | `getAllUnitTypesPostInterventionProject` | **sole** real-data witness for the Low band: both bands Not met; Medium −4.52 (Canals −4.52, Ditches 0.00); Low tiles −0.32 / 0.00 / −0.32 with the #387 tag on the cumulative tile only; Culvert −0.32; **no totals row** in either grid |
| watercourses that exist only post intervention get no verdict and no tag                                                               | `getWatercourseGainProject`              | **sole** real-data witness for the null verdict: Medium row and deficit tile carry no tag                                                                                                                                                 |
| a project with no post-intervention file is sent to the watercourses summary                                                           | `getBaselineOnlyProject`                 | this page's own `summaryPath` redirect                                                                                                                                                                                                    |
| the Watercourses "Trading rules" nav child opens this page with Trading rules current, the caption and an upload action returning here | `getTargetMetProject`                    | the nav click resolves; Watercourses children; current item unlinked; caption; upload `returnUrl` is this page                                                                                                                            |
| the project summary "View watercourses trading rules" link opens this page                                                             | `getTargetMetProject`                    | the tile link resolves; the heading renders                                                                                                                                                                                               |

The figures were probed against the stack on 2026-10-15. Since BMD-1056 the baseline comes from the Post intervention file's Baseline columns, so if a figure moves after a fixture regeneration, check that file first. **No shared pair gives a watercourse Low "Met"**, but that's a variant of the tile already witnessed.

**Deliberately not covered:**

- The no-baseline redirect. It's the shared guard, not configured per page, and no trading page witnesses it yet. It's better as one test for all three trading pages.
- Signed-out, no-role and IDOR access. These come from the shared `createProjectGetPlugin` gate and have the same gap on every unit-type page.
- The "not calculated" inset is `[BLOCKED: no real upload produces a Post intervention document without figures]`. A `test.skip` placeholder in the spec carries the unblock steps.
