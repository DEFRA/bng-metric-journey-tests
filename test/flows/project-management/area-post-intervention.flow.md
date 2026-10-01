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
- **On error:** a project with no baseline redirects to `/add-project-details/{id}`
- **Description:** `<h1>Post intervention for area habitats</h1>` under the project name caption, an "Upload file" button whose `returnUrl` points back here, `<h2>Area habitats results</h2>` with the five area summary tiles (no post-intervention self-link), a size section (`Site size`, `Area habitats size`, from `postIntervention.habitatSizes`), then `<h2>Area habitat details</h2>` and the GOV.UK Tabs component (title "Intervention type").

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

| Test                                                         | AC            | Why it needs a browser and real data                                                                                                  |
| ------------------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Retained grid — subheading, columns, rows, formats, Ref href | 1, 4a, 5, 7   | sole witness that a real area parcel carries `ref`, `sizeSquareMetres`, `broadType`, distinctiveness and condition into this grid     |
| Enhanced grid — target/time block on calculated rows         | 2, 4b, 5      | the only real-data witness for an area feature's `proposed.*` target and time-to-target fields                                        |
| Created grid — including Lost parcels imported as Created    | 3, 4c, 5      | the Created tab is reached only through the backend's Lost→Created mapping or a real Created parcel; the unit test hands it a literal |
| Many-row grids — ref order, no highlight, totals, tree rows  | 5, 7          | natural ref ordering over 50+ rows, totals reconciled against rendered rows, and that **urban trees** reach the area grid             |
| Click a column heading → ascending, then descending          | 8, 9          | client-side MOJ sort — cheerio never runs it                                                                                          |
| A 13-column grid's pane overflows and scrolls                | 6             | a layout fact no markup assertion can see                                                                                             |
| Clicking a habitat reference opens the details page          | 10a, 10b, 10c | `post-intervention-habitat-details.spec.js` arrives from the deprecated habitat list, not from this grid                              |

**Fixtures.** The three-tab project is `getAreaInterventionTypesProject` (`Baseline - complete with area refs` + `Post-intervention - created area habitat`: H1/H2-2 Retained, H2-3/H3 Enhanced with real uplifts, H2-7 Created plus seven Lost parcels imported as Created). `post-intervention-habitat-details.spec.js` builds the same pairing through its own file-local cache, so a worker running both files uploads it twice — the same call the hedgerow and watercourse pairings make. The many-row project is `getAllUnitTypesPostInterventionProject` (33 Retained + 25 Enhanced parcels, 62 Lost→Created, plus urban trees), already built by `project-summary.spec.js` in the same module-scope cache, so it costs no upload.

**Not covered here (BMD-858).** The page furniture — left navigation, header and upload action, results tiles, size section, tab visibility rules and the entry links from the project summary and area summary — has **no journey coverage** yet. It was validated manually on 2026-10-01; run `/validate-ac-automated` against BMD-858 to close it.

**Sole witness, do not delete without a replacement.** These are the only tests in any suite where a real uploaded area habitat's display fields, a Lost→Created parcel, or a post-intervention urban tree reach a rendered grid.
