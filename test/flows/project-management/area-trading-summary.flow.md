# Area Habitats Trading Summary User Flow

## Overview

The user drills from the [area habitats summary](area-summary.flow.md) into the area trading rules: whether each distinctiveness band satisfies them, and the per-habitat unit changes the verdict is built from. The page shows figures; it decides nothing. Every number and every Met / Not met is calculated by the backend at post-intervention upload and read straight off the project.

Added by **BMD-1024** (frontend PR#332, 2026-09-28). The links into it came from **BMD-1025** (PR#326). The nav wording was aligned to the ACs by PR#351 (2026-10-01): "Post intervention" without a hyphen and "Trading rules" with a lower-case r. The figures it renders are calculated by **BMD-993** (backend PR#374) and the statuses derived there too.

## Steps

### Step 1 — View the area habitats trading summary `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/area-trading-summary`
- **Template:** `src/server/area-trading-summary/index.njk` (extends `common/templates/unit-type-page.njk`)
- **Auth required:** Yes — active session + an approved `bng completer` role, as every unit-type page
- **Backend endpoint:** `GET /projects/{id}` (via `fetchProjectOrThrow`)
- **Description:** Renders `project.postIntervention.tradingRules.areaHabitats` (the figures) and `project.tradingRuleStatuses.areaHabitats` (`medium` / `low` statuses).

  **Left navigation** — `buildUnitTypeNavigation`. Area habitats expands to **Baseline → Post intervention → Trading rules**; Trading rules is the current item (`<strong aria-current="page">`, no link). Hedgerows / Watercourses render only when the project has that habitat in baseline or post-intervention. Reports is always last; the team has said to ignore it for BMD-1024 (spike, no story).

  **Heading** — project name caption, `<h1>Area habitats trading summary</h1>`, and an "Upload file" button whose `returnUrl` is this page.

  **Trading summary** — `<section aria-labelledby="trading-summary-heading">`, a table with "Distinctiveness group" / "Status" columns and one row per band **present** (`Medium`, `Low`), each with a green `Met` or red `Not met` tag.

  **Medium distinctiveness** (only when a Medium habitat is present) — `<h2>` plus:

  | Element                    | Content                                                                                                                                                                                                                                                     |
  | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Deficit tile               | "Medium distinctiveness unit deficit required to meet trading rules": `figures.medium.deficit` as `{n} units` (2 dp) + the Medium status tag                                                                                                                |
  | One grid per broad habitat | `<h3>{broad habitat}</h3>`, columns "Habitat type" / "Unit change", a row per Medium habitat type (type shown without its broad-habitat prefix), totals row "Total broad habitat change"                                                                    |
  | Intertidal grid            | when the backend's merged group "Intertidal sediment and hard structures" is present: `<h3>Intertidal sediment and Intertidal hard structures</h3>`, columns "Broad habitat" / "Habitat type" / "On-site unit change", totals row with an empty middle cell |

  **Low distinctiveness** (only when a Low habitat is present) — `<h2>`, three tiles ("Low distinctiveness net change in units", "Medium units available to offset low distinctiveness deficit", "Cumulative surplus of units", each `{n} units`), then one grid with "Broad habitat" / "Habitat type" / "On-site unit change" and a "Total on-site unit change" row.

  **Display rounding vs. the verdict.** Values render to 2 dp, but the statuses are decided by the backend on full precision. A Medium deficit of a fraction of a unit therefore reads **"0.00 units" beside a red "Not met"** (seen with the IGGI fixture pair). That is the AC's `< 0` rule working, not a bug — but a test pinning "0.00 ⇒ Met" would be wrong.

- **On success:** Renders with page title "Area habitats trading summary - {serviceName}"
- **On error:**
  - No baseline → 302 to `/projects/{id}/project-summary` (BMD-1043; it was the removed task list)
  - No post-intervention document → 302 to `/projects/{id}/area-summary` (nothing to trade against; the page is not linked before then)
  - Post-intervention document without figures (uploaded before BMD-993, or calculation failed) → inset text "Trading rules have not been calculated for this project…" and no tables
  - Backend 404 / unreachable → `error/index` (404 / 502), as every unit-type page

---

## Entry points

| From                                                                 | Element                                                       | When                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------- |
| Area summary, area baseline, area post-intervention                  | "Trading rules" child under Area habitats in the left nav     | post-intervention uploaded |
| Project summary, area summary, area baseline, area post-intervention | "View area trading rules" link in the area Trading Rules tile | post-intervention uploaded |

---

## Journey coverage

Added 2026-10-02 by `/validate-ac-automated` against the BMD-1024 ACs — `test/specs/project-management/area-trading-summary.spec.js` (domain tag `@project-management`).

The frontend unit suite covers every AC (`area-trading-summary/controller.test.js`, plus `unit-type-navigation.test.js`) — all against a **mocked** backend handed the worked-example literal. The backend and the engine cover the arithmetic (`bng-library` `area-trading-rules.worked-example.test.mjs`, backend `area-trading-rule-statuses.test.js`, `enrich-post-intervention-area-trading-rules.test.js`) — on synthetic input. No suite showed that a **real upload** produces the figures this page renders, which is what the journey tests are for: one witness per data family, from two shared fixture pairs.

| Test                        | Fixture pair   | Data family witnessed                                   |
| --------------------------- | -------------- | ------------------------------------------------------- |
| Nav, heading, upload button | higher-deficit | page furniture on this page's own controller            |
| Status grid                 | higher-deficit | `tradingRuleStatuses.areaHabitats.medium` / `.low`      |
| Medium deficit tile         | higher-deficit | `figures.medium.deficit`                                |
| Broad-habitat grid          | higher-deficit | `figures.habitatTypes` + `figures.medium.broadHabitats` |
| Low tiles + grid            | higher-deficit | `figures.low.*`, `figures.medium.surplus`               |
| Intertidal grid             | IGGI           | the backend's intertidal merge (sole witness)           |
| Nav destinations            | both           | the hrefs actually resolve from this page               |

Deliberately **not** duplicated (the rule is covered elsewhere and the rendering shape already has a real-data witness here): Medium "Met", Low "Not met" and the 0.00 "Met" tile — variants of the families above.

### Entry points (BMD-1025)

Added 2026-10-08 by `/validate-ac-automated` against the BMD-1025 ACs. The nav child comes from one builder (`buildUnitTypeNavigation`, which takes only the project and the current href), but the tile link is built **per controller** (`tradingRulesHref`), so each page needs its own tile witness. All but one are assertions folded into tests that already load the right shared project; the project-summary one is a separate test on an already-shared project. No extra uploads.

| AC   | Page                   | Witness                                                                                                                       |
| ---- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| AC1  | Area summary           | ✅ `area-summary.spec.js` — "the five Results tiles agree with the project summary"                                           |
| AC1  | Area baseline          | ✅ `area-baseline.spec.js` — "a project that satisfies the trading rules reads "Met""                                         |
| AC1  | Area post intervention | ✅ `area-post-intervention.spec.js` — "the left navigation marks Post intervention as current…"                               |
| AC2  | Area summary           | ✅ `area-summary.spec.js` — "Area habitats is current and expands to show its Baseline child"                                 |
| AC2  | Area baseline          | ✅ `area-baseline.spec.js` — "renders the full left navigation with Baseline as the current child"                            |
| AC3  | Project summary        | ✅ `project-summary.spec.js` — "the area habitats Trading Rules tile links to the area trading summary"                       |
| AC3  | Area summary           | ✅ `area-trading-summary.spec.js` — "opens from "View area trading rules"…"                                                   |
| AC3  | Area baseline          | ✅ `area-baseline.spec.js` — "a project that satisfies the trading rules reads "Met""                                         |
| AC3  | Area post intervention | ✅ `area-post-intervention.spec.js` — "the results tiles match the project summary…"                                          |
| AC4  | Project summary        | ✅ `project-summary.spec.js` — "elements still deferred to later tickets render as text rather than links"                    |
| AC4  | Area summary           | ✅ `area-summary.spec.js` — the page-content test on the baseline-only project                                                |
| AC4  | Area baseline          | ✅ `area-baseline.spec.js` — "a baseline with no post-intervention file reads "Not met""                                      |
| AC5a | Nav click              | ✅ `area-trading-summary.spec.js` — "the left navigation expands Area habitats with Trading rules current" (arrives by click) |
| AC5b | Tile click             | ✅ `area-trading-summary.spec.js` — "opens from "View area trading rules"…"                                                   |

AC2 is worth its assertions: the 2026-10-01 manual run caught the area "Post intervention" child rendering on a baseline-only project, and no journey test noticed.

---

## Fixtures

| Pair                                                                              | Shape                                                                                                                                                               |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trading-higher-deficit-not-covered-from-below-{baseline,post-intervention}.gpkg` | Medium grassland lost, two Low grasslands enhanced: Medium Not met (−153.69), Low Met (+166.54). Hedgerows, no rivers.                                              |
| `{Baseline,Post-intervention} - IGGI habitat.gpkg`                                | IGGI (Medium in the engine reference data, despite the file's V.Low column) retained in Intertidal hard structures; has rivers, so Watercourses appears in the nav. |
