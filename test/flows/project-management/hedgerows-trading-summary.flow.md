# Hedgerows Trading Summary User Flow

## Overview

The user drills from the [hedgerows summary](hedgerows-summary.flow.md) into the hedgerow trading rules: whether each distinctiveness band satisfies them, and the per-hedgerow-type unit changes the verdict is built from. The page shows figures; it decides nothing. The figures are calculated by the backend at post-intervention upload, and the Met / Not met statuses are derived from them on every read.

Added by **BMD-1028** (frontend PR#365, 2026-10-06). The links into it came from **BMD-1027** (PR#335). The figures are calculated by **BMD-994** (backend PR#403) and the statuses derived by **BMD-1003** (backend PR#453). It mirrors the [area trading summary](area-trading-summary.flow.md) through the shared `createTradingSummaryController`, with two differences: hedgerows trade on distinctiveness band alone (no broad-habitat grouping), and there is a third band, **Very low**.

## Steps

### Step 1 — View the hedgerows trading summary `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/hedgerows-trading-summary`
- **Template:** `src/server/hedgerows-trading-summary/index.njk` (extends `unit-type-page.njk`, renders the shared `trading-summary/macro.njk`)
- **Auth required:** Yes — active session + an approved `bng completer` role (`createProjectGetPlugin`); `id` must be a UUID v4 (Joi), else 400
- **Backend endpoint:** `GET /projects/{id}` (via `fetchProjectOrThrow`)
- **Description:** Renders `project.postIntervention.tradingRules.hedgerows` (the figures) and `project.tradingRuleStatuses.hedgerows` (`medium` / `low` / `veryLow` statuses).

  **Left navigation** — `buildUnitTypeNavigation`. Hedgerows expands to **Baseline → Post intervention → Trading rules**; Trading rules is the current item (no link). The Baseline child is absent when the baseline has no hedgerows (post-intervention-only hedgerows). Area habitats / Watercourses render only when the project has that habitat in baseline or post-intervention.

  **Heading** — project name caption, `<h1>Hedgerows trading summary</h1>`, and an "Upload file" button whose `returnUrl` is this page.

  **Trading summary** — `<section aria-labelledby="trading-summary-heading">`, a table with "Distinctiveness group" / "Status" columns and one row per band whose hedgerow types appear in `figures.habitatTypes` (`Medium`, `Low`, `Very low`), each with a green `Met` or red `Not met` tag. A row is listed when the band is **present in the figures**, but its tag comes from the **statuses** — so a band present only post-intervention (no baseline hedgerow of that band) renders a row with **no tag**, because the backend leaves that band `null`. Seen on the "linear net gain met" pair (Low) and on post-intervention-only hedgerows (every band).

  **Medium distinctiveness** (only when a Medium hedgerow type is present) — `<h2>` plus:

  | Element      | Content                                                                                                                                 |
  | ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
  | Deficit tile | "Medium distinctiveness unit deficit required to meet trading rules": `figures.medium.netUnitChange` as `{n} units` (2 dp) + Medium tag |
  | Grid         | columns "Habitat type" / "Unit change", one row per Medium hedgerow type, totals row "Total unit change"                                |

  **Low distinctiveness** (only when a Low hedgerow type is present) — `<h2>`, three tiles, then a grid ("Habitat type" / "Unit change", totals "Total unit change"):

  | Tile                                                           | Value                                                                 |
  | -------------------------------------------------------------- | --------------------------------------------------------------------- |
  | "Low distinctiveness net change in units"                      | `figures.low.netUnitChange`                                           |
  | "Medium units available to offset low distinctiveness deficit" | `max(0, figures.medium.netUnitChange)` — a deficit never carries down |
  | "Cumulative surplus of units"                                  | `figures.low.cumulativeAvailability` + the Low tag                    |

  **Very low distinctiveness** (only when a Very low hedgerow type is present) — the same shape:

  | Tile                                                                        | Value                                                       |
  | --------------------------------------------------------------------------- | ----------------------------------------------------------- |
  | "Very low distinctiveness net change in units"                              | `figures.veryLow.netUnitChange`                             |
  | "Medium and low units available to offset very low distinctiveness deficit" | `max(0, figures.low.cumulativeAvailability)`                |
  | "Cumulative surplus of units"                                               | `figures.veryLow.cumulativeAvailability` + the Very low tag |

  High and very high distinctiveness hedgerows are outside these trading rules and never appear.

  **Display rounding vs. the verdict.** As on the area page, values render to 2 dp while the statuses are decided on full precision, so a fraction-of-a-unit deficit can read "0.00 units" beside a red "Not met".

- **On success:** Renders with page title "Hedgerows trading summary - {serviceName}"
- **On error:**
  - No baseline → 302 to `/projects/{id}/project-summary`
  - No hedgerows in baseline **or** post-intervention → 302 to `/projects/{id}/project-summary`
  - No post-intervention document → 302 to `/projects/{id}/hedgerows-summary` (nothing to trade against; the page is not linked before then)
  - Post-intervention document without hedgerow figures → inset text "Trading rules have not been calculated for this project. Upload the post-intervention file again to calculate them." and no tables
  - Backend 404 / unreachable → `error/index` (404 / 502), as every unit-type page

---

## Entry points

| From                                                                                | Element                                                                 | When                                                         |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| Hedgerows summary, hedgerows baseline, hedgerows post intervention                  | "Trading rules" child under Hedgerows in the left nav                   | post-intervention uploaded                                   |
| Project summary, hedgerows summary, hedgerows baseline, hedgerows post intervention | "View hedgerows trading rules" link in the hedgerows Trading Rules tile | post-intervention uploaded **and** the project has hedgerows |

Before a post-intervention file exists the tile holds the inert text "View trading rules" instead of the link.

---

## Journey coverage

Added 2026-10-08 by `/validate-ac-automated` against the BMD-1003 ACs — `test/specs/project-management/hedgerows-trading-summary.spec.js` (domain tag `@project-management`). Its page object is `test/pages/hedgerows-trading-summary.page.js`.

The frontend unit suite renders this page against a **mocked** backend (`hedgerows-trading-summary/controller.test.js`); the backend derives the statuses from synthetic figures (`hedgerow-trading-rule-statuses.test.js`). No integration test asserts `tradingRuleStatuses.hedgerows`, so the journey tests are the only end-to-end check from a real upload.

| Test                                                                              | Fixture pair                     | Data family witnessed                                                                        |
| --------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------- |
| a Medium deficit reads "Not met" and the Very low band is not listed              | higher-deficit                   | `tradingRuleStatuses.hedgerows.medium` (Not met), `.low` (Met); band-row presence            |
| Low and Very low running totals below zero read "Not met" under a Met Medium band | created linear features          | `.medium` (Met), `.low` / `.veryLow` (Not met); `figures.low/veryLow.cumulativeAvailability` |
| a Low loss covered by the Medium surplus reads "Met"                              | lower-deficit-covered-from-above | the Medium→Low cascade: Low net change −1.55, cumulative +3.33, Met                          |

The overall status (`tradingRuleStatuses.hedgerows.overall`) shown in the Trading Rules tile is covered on the four pages that display it — see [project-summary](project-summary.flow.md), [hedgerows-summary](hedgerows-summary.flow.md), [hedgerows-baseline](hedgerows-baseline.flow.md) and [hedgerows-post-intervention](hedgerows-post-intervention.flow.md).

**Entry points (BMD-1027)** — added 2026-10-09 by `/validate-ac-automated`. Both click-throughs are followed in `hedgerows-trading-summary.spec.js` (describe "Hedgerows trading summary — entry points"); the nav child arrives on this page with Hedgerows expanded to Baseline → Post intervention → Trading rules, Trading rules current. The links' presence once a post-intervention file exists (AC1, AC3), and their absence before one (AC2, AC4), are asserted on each source page in `project-summary.spec.js`, `hedgerows-summary.spec.js`, `hedgerows-baseline.spec.js` and `hedgerows-post-intervention.spec.js`.

**Not covered yet** (BMD-1028's own ACs were never run through `/validate-ac-automated`):

| Element                                                               | Coverage                                                                                                            |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Page furniture — caption, heading, upload button `returnUrl`          | No journey test                                                                                                     |
| Per-hedgerow-type grids and totals rows                               | No journey test                                                                                                     |
| Redirects (no PI → hedgerows summary; no hedgerows → project summary) | No journey test                                                                                                     |
| "Trading rules have not been calculated" inset                        | `[BLOCKED: needs a post-intervention document saved without hedgerow figures — not producible by a current upload]` |

---

## Fixtures

| Pair                                                                              | Hedgerow shape                                                                                                                                                                     |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trading-higher-deficit-not-covered-from-below-{baseline,post-intervention}.gpkg` | Medium −2.56 (Not met), Low +2.45 (Met), no Very low                                                                                                                               |
| `trading-lower-deficit-covered-from-above-{baseline,post-intervention}.gpkg`      | Medium +4.88 (Met), Low −1.55 covered → cumulative +3.33 (Met); overall Met                                                                                                        |
| `{Baseline,Post-intervention} - created linear features.gpkg`                     | Medium +2.22 (Met), Low −4.20 → cumulative −1.98 (Not met), Very low −1.04 (Not met) — HG005/HG010 changed from Medium to Low strategic significance for BMD-1051 (see note below) |
| `trading-lost-to-development-{baseline,post-intervention}.gpkg` (not shared)      | Medium / Low Met, Very low −0.33 (Not met) — the single-band aggregate case                                                                                                        |
| `trading-all-met-{baseline,post-intervention}.gpkg` (not shared)                  | all three bands Met, Very low covered from above (+1.26)                                                                                                                           |

**`created linear features` differs from its harness copy.** Since backend PR #465 (BMD-1051), the service accepts only Low or High as the Proposed Strategic Significance of a created or enhanced feature. A Medium value (`Location ecologically desirable but not in local strategy`) is nulled and the feature priced at **0 units**. The harness file gives Created hedgerows HG005 and HG010 Medium, which turned the Medium band into a deficit and every band Not met. The journey-tests copy sets both to Low (`Area/compensation not in local strategy/ no local strategy`), which restores the Met / Not met / Not met pattern the band-status test needs. The pair's other rejected features (area H008/H012/H043/H051, tree T018) are left as shipped.
