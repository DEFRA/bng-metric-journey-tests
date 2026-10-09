# Area Post-Intervention User Flow

## Overview

The area twin of the [hedgerows](hedgerows-post-intervention.flow.md) and [watercourses](watercourses-post-intervention.flow.md) post-intervention pages: one level below the [area summary](area-summary.flow.md), showing every post-intervention area habitat split across **Retained / Enhanced / Created** tabs, one grid per intervention type.

Added by **BMD-858** (page furniture — left nav, header, results tiles, size section, tab shell) and **BMD-997** (the grids inside the tabs), both delivered in frontend PR#300 (merged 2026-09-30).

It runs on the same `createHabitatPostInterventionController` factory as its linear twins, but three things are area-specific and are passed in as config — so a hedgerow or watercourse witness is **not** a witness for this page:

- **`collectAreaFeatures` merges habitat parcels and urban trees** (`[...habitats, ...trees]`). Tree rows (`T…` refs) sit in the same grids as parcels, and their units and sizes are in the same totals.
- **A "Broad habitat" column** (`buildAreaLeadingExtraColumns`, `common/helpers/area-post-intervention-grid.js`) is inserted after `Size`. Like Habitat type, it reads from `baseline` for a Retained feature and from `proposed` otherwise.
- **Size is in hectares** — `formatAreaHectares`, 10 significant figures with an `ha` suffix and no space — for both rows and the totals row.

## Steps

### Step 1 — View the area post-intervention page `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/area-post-intervention`
- **Template:** `src/server/common/templates/habitat-post-intervention-page.njk` (extends `common/templates/unit-type-page.njk`)
- **Auth required:** Yes — active session + an **approved (status 3)** `bng completer` role
- **Backend endpoint:** `GET /projects/{id}` (via `fetchProjectOrThrow`)
- **On error:** a project with no baseline redirects to `/projects/{id}/project-summary` (BMD-1043; it was the removed task list)
- **Description:** `<h1>Post intervention for area habitats</h1>` under the project name caption, an "Upload file" button whose `returnUrl` points back here, `<h2>Area habitat results</h2>` (renamed from "Area habitats results" by frontend PR#361) with the five area summary tiles (no post-intervention self-link), an `<h2>Area habitats size</h2>` section, then `<h2>Area habitat details</h2>` and the GOV.UK Tabs component (title "Intervention type").

  **Left navigation.** `buildUnitTypeNavigation` with this page as the current href: Summary, Area habitats (expanded — Baseline, **Post intervention** as `<strong aria-current="page">`, Trading rules), then Hedgerows / Watercourses each only when `projectHasHabitatData` finds that type in baseline OR post-intervention, then Reports. "Post intervention" and "Trading rules" date from frontend PR#351 (BMD-1024 PO ruling); before it they read "Post-intervention" and "Trading Rules".

  **Size section** (BMD-858 AC6, frontend PR#350 — replaced the original two-value "Site size / Area habitats size" block). Three tiles, each `formatSummaryAreaSize` (2 dp + `ha`, no space) or `N/A` when the figure is missing:

  | Tile label                                                                               | Source                                                         |
  | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
  | Total baseline habitat area                                                              | `baseline.habitatSizes.areaHabitats.totalSquareMetres`         |
  | Total post intervention habitat area                                                     | `postIntervention.habitatSizes.areaHabitats.totalSquareMetres` |
  | Site Area (excluding areas of individual trees, green walls, intertidal hard structures) | `postIntervention.habitatSizes.site.totalSquareMetres`         |

  **Entry points** (BMD-858 AC1/AC2, frontend PR#350). The Area habitats post-intervention tile on the [project summary](project-summary.flow.md), [area summary](area-summary.flow.md) and [area baseline](area-baseline.flow.md) pages is the link "View on-site area post intervention" → this page (`areaInterventionAction`); before #350 it was the inert text "View on-site post intervention". The "Post intervention" nav child reaches it from any area page.

  **Tabs.** Order is fixed by `INTERVENTION_TAB_ORDER`; a tab renders only when at least one feature's `interventionDisplay(retentionCategory)` matches it, and the first visible tab is selected on load. Each panel holds `<h3>{Tab} area habitats</h3>` and that intervention type's grid.

  **A GeoPackage "Lost" area parcel lands in the Created tab.** The backend persists a Lost **area** habitat as Created (BMD-534 PO ruling; `enrich-post-intervention-area-habitat.js`) — Lost hedgerows, watercourses and trees are dropped at import instead. So a fixture's Lost parcels are expected Created rows, typically sealed-surface with `0.00` units and a `N/A - Other (0)` target condition.

### Step 2 — Read an intervention-type grid (BMD-997) `[IMPLEMENTED]`

Each panel holds a `moj-sortable-table` inside an MOJ **scrollable pane** — `<div class="moj-scrollable-pane" role="region" aria-label="{Tab} area habitats" tabindex="0">`. Built by `buildPostInterventionHabitatGrid` (`common/helpers/post-intervention-habitat-grid.js`), one row per feature of that intervention type.

| Column                    | Retained | Enhanced | Created | Value                                                                                                                                     |
| ------------------------- | -------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `Ref`                     | ✓        | ✓        | ✓       | linked to `/post-intervention-habitat-details?featureId={featureId}&projectId={id}&returnUrl=%2Fprojects%2F{id}%2Farea-post-intervention` |
| `Units`                   | ✓        | ✓        | ✓       | `formatHabitatUnits` — 2 dp, capped at 7 s.f.                                                                                             |
| `Size`                    | ✓        | ✓        | ✓       | `formatAreaHectares` — 10 s.f. + `ha`, no space                                                                                           |
| `Broad habitat`           | ✓        | ✓        | ✓       | `broadType` — baseline for Retained, proposed otherwise                                                                                   |
| `Habitat type`            | ✓        | ✓        | ✓       | `type` — same source rule                                                                                                                 |
| `Distinctiveness`         | ✓        | ✓        | ✓       | `"{label} ({score})"`                                                                                                                     |
| `Condition`               | ✓        | —        | —       | `"{label} ({score})"`                                                                                                                     |
| `Strategic significance`  | ✓        | ✓        | ✓       | `Low (1)` for Retained; the proposed value otherwise                                                                                      |
| `Target condition`        | —        | ✓        | ✓       | `"{label} ({score})"` — the **proposed** condition                                                                                        |
| `Standard time to target` | —        | ✓        | ✓       | `formatYears` — `"1 year"` / `"N years"`                                                                                                  |
| `Advance`                 | —        | ✓        | ✓       | `formatYears`                                                                                                                             |
| `Delay`                   | —        | ✓        | ✓       | `formatYears`                                                                                                                             |
| `Final time to target`    | —        | ✓        | ✓       | the backend's pre-formatted `"N years ({multiplier})"`                                                                                    |
| `Standard difficulty`     | —        | ✓        | ✓       | `"{label} ({multiplier})"` — the ticket title-cases "Standard Difficulty"; the page renders sentence case                                 |

A `<tfoot>` **totals row** closes every grid: `Total` in the Ref column, `formatHabitatUnits` over the summed units, `formatAreaHectares` over the summed size, and an empty cell for every other column. Both sums are computed **server-side from the unrounded feature values** (`sumFinite`), so the Units total can differ from a sum of the displayed 2 dp cells by a few hundredths on a long grid.

**Default order and sorting.** `sortHabitatFeatures` sorts by ref ascending with `numeric: true` (so `H2-2` precedes `H2-10`), and every `<th>` ships `aria-sort="none"`. `createAll(SortableTable)` binds MOJ's component to every grid, including those inside `display:none` tab panels; a heading click toggles that column `ascending` → `descending` and clears the rest. Numeric cells carry the raw value as `data-sort-value`.

**Scrolling.** The Enhanced and Created grids (13 columns) overflow the pane at a 1280 px viewport; the 8-column Retained grid is the narrow case.

### Step 3 — Open a habitat from the grid `[IMPLEMENTED]`

- **Route:** `GET /post-intervention-habitat-details?featureId={featureId}&projectId={id}&returnUrl=…`
- **Description:** Clicking a Ref opens the read-only post-intervention details page for that feature. The `returnUrl` is this page; the details page uses it as the Back target on its unsupported-feature view (`post-intervention-habitat-details/controller.js:165`). See [post-intervention-habitat-details.flow.md](../habitat-details/post-intervention-habitat-details.flow.md).

---

## Journey coverage

Added 2026-10-01 for BMD-997 — the "intervention type grids" describe of `test/specs/project-management/area-post-intervention.spec.js` (domain tag `@project-management`).

`area-post-intervention/controller.test.js` (`:239`, `:262`, `:316`) and `post-intervention-habitat-grid.test.js` assert the tabs, columns, rows and totals in markup — with `wreck` mocked and one hand-built feature per tab. They prove the grid renders `proposed.broadType` **if it arrives**, never that a real import emits it. The backend half of the same gap: `post-intervention-persistence.test.js:64-66` asserts only `status` and a numeric `units` per feature — none of the `proposed.*` display fields, no tree, and no Lost→Created parcel.

| Test                                                         | AC            | Why it needs a browser and real data                                                                                                                                                                                                            |
| ------------------------------------------------------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Retained grid — subheading, columns, rows, formats, Ref href | 1, 4a, 5, 7   | sole witness that a real area parcel carries `ref`, `sizeSquareMetres`, `broadType`, distinctiveness and condition into this grid                                                                                                               |
| Enhanced grid — target/time block on calculated rows         | 2, 4b, 5      | the only real-data witness for an area feature's `proposed.*` target and time-to-target fields                                                                                                                                                  |
| Created grid — including Lost parcels imported as Created    | 3, 4c, 5      | the Created tab is reached only through the backend's Lost→Created mapping or a real Created parcel; the unit test hands it a literal                                                                                                           |
| Retained parcel priced at Low (×1)                           | BMD-1051 AC2  | sole real-data witness: on-site H046 (High in the file) and H002 (Medium) have units = size × distinctiveness × condition. The Retained `Low (1)` cell is a frontend constant; off-site rows are avoided because spatial risk adds a multiplier |
| Enhanced parcel with a rejected strategic significance       | BMD-1051 AC4  | the area pricing path's witness for backend PR #465: H086 (Medium) reads Units `0.00` with blank derived cells — the hedgerow grid has its own                                                                                                  |
| Many-row grids — ref order, no highlight, totals, tree rows  | 5, 7          | natural ref ordering over 50+ rows, totals reconciled against rendered rows, and that **urban trees** reach the area grid                                                                                                                       |
| Click a column heading → ascending, then descending          | 8, 9          | client-side MOJ sort — cheerio never runs it                                                                                                                                                                                                    |
| A 13-column grid's pane overflows and scrolls                | 6             | a layout fact no markup assertion can see                                                                                                                                                                                                       |
| Clicking a habitat reference opens the details page          | 10a, 10b, 10c | since BMD-1043 `post-intervention-habitat-details.spec.js` also arrives by clicking this grid (the habitat list it used was removed)                                                                                                            |

**Fixtures.** The three-tab project is `getAreaInterventionTypesProject` (`Baseline - complete with area refs` + `Post-intervention - created area habitat`: H1/H2-2 Retained, H2-3/H3 Enhanced with real uplifts, H2-7 Created plus seven Lost parcels imported as Created). `post-intervention-habitat-details.spec.js` builds the same pairing through its own file-local cache, so a worker running both files uploads it twice — the same call the hedgerow and watercourse pairings make. The many-row project is `getAllUnitTypesPostInterventionProject` (33 Retained + 25 Enhanced parcels, 62 Lost→Created, plus urban trees), already built by `project-summary.spec.js` in the same module-scope cache, so it costs no upload.

### Page furniture (BMD-858) `[IMPLEMENTED]`

Added 2026-10-05 — the "page furniture" describe of the same spec, plus two entry-link tests. Every assertion below has a markup twin in `area-post-intervention/controller.test.js` (`:141` header, `:161` upload, `:174`/`:257` tiles, `:200`/`:230` size, `:268` nav) against a mocked `wreck`; these hold the half the unit suite cannot see — that this controller feeds them from a real project.

| Test                                                                   | AC     | Why it needs a browser and real data                                                                                                                      |
| ---------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header — project name, H1, Upload file                                 | 4      | the caption is the real project's name                                                                                                                    |
| Left navigation — current item, children, conditional unit types       | 3a, 10 | hrefs on THIS page; the click-throughs are witnessed from `area-trading-summary.spec.js` and `area-summary.spec.js` (same builder, no per-page parameter) |
| Results tiles agree with the project summary, no self-link             | 5      | this controller's own choice of unit fields (`areaUnits` + `areaInterventionSummary`)                                                                     |
| Size tiles — three labels, ha to 2 dp, agree with the habitat list     | 6      | the only page rendering `baseline.habitatSizes` beside the post-intervention figures                                                                      |
| Tab set skips an empty intervention type and selects the first visible | 7b     | `visibleInterventionTabs` runs on this page's own features — `getAreaGainProject` has no Retained area habitat, so Enhanced is the default                |
| Upload file opens the file-type selection page                         | 9      | the `returnUrl` is built per page from `config.path`                                                                                                      |
| Project summary / area summary tile links open this page               | 1, 2b  | `project-summary.spec.js` and `area-summary.spec.js` — the link exists only once the project has post-intervention data                                   |

**Trading Rules tag (BMD-858 AC5).** Until frontend PR#361 (2026-10-06) this page's Trading Rules tile carried no Met/Not met tag — `area-post-intervention/controller.js` passed no `tradingRulesStatus`, unlike `area-summary` and `area-baseline`. The results-tiles test caught it by comparing tile values with the project summary; it was parked from 2026-10-05 until the fix.

AC7a and AC8 (tab order, default selection, non-selected tabs as links, selection and focus on click) are asserted inside the BMD-997 Retained and Enhanced grid tests. AC2a (nav "Post intervention" from the area summary) and AC3b (Hedgerows suppressed) are not re-asserted here: the nav builder takes the project and the current href only, and `area-trading-summary.spec.js` (nav click to this page) and `project-summary.spec.js` ("hedgerows absent from both documents") already witness both with real data.

**Sole witness, do not delete without a replacement.** These are the only tests in any suite where a real uploaded area habitat's display fields, a Lost→Created parcel, or a post-intervention urban tree reach a rendered grid.
