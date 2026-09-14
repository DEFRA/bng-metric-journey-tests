# Hedgerows Post-Intervention User Flow

## Overview

The post-intervention twin of the [hedgerows baseline](hedgerows-baseline.flow.md): one level below the [hedgerows summary](hedgerows-summary.flow.md), showing every post-intervention hedgerow split across **Retained / Enhanced / Created** tabs, one table per intervention type.

Added by **BMD-860** (frontend PR#278, merged 2026-09-11), which shipped the page furniture — left nav, header, results tiles and the tab shell. The grids inside the tabs are **BMD-998**, delivered in the same PR.

Two things separate it from every other unit-type page:

- It is the first page in the service whose tabs are the **GOV.UK Tabs component**. The existing [post-intervention habitat list](../habitat-list/post-intervention-habitat-list.flow.md) also has tabs, but they split by **unit type** (Areas / Hedgerows / Watercourses); these split by **intervention type** within one unit type. Do not reuse one page's tab locators on the other.
- Its results tiles carry **no post-intervention action line at all** — the same self-link suppression the baseline page applies to its baseline tile, for the same reason: the link would point at the page the user is already on.

Its area and watercourse equivalents are separate stories (PI Areas, PI Watercourses) and had not shipped when this doc was written — `unit-type-navigation.js` gives a `postInterventionPath` to hedgerows only.

## Steps

### Step 1 — View the hedgerows post-intervention page `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/hedgerows-post-intervention`
- **Template:** `src/server/common/templates/habitat-post-intervention-page.njk` (extends `common/templates/unit-type-page.njk`)
- **Auth required:** Yes — active session + an **approved (status 3)** `bng completer` role (`requireBngCompleterRole` pre-method)
- **Backend endpoint:** `GET /projects/{id}` (via `fetchProjectOrThrow`)
- **Description:** Built by `createHabitatPostInterventionController`, a factory the area and watercourse pages will share once they ship. Everything hedgerow-specific is passed in as config — habitat key, size reader, formatters, `baselineUnits` selector — so a witness for this page is **not** a witness for its future siblings.

  **Left navigation** — as [`hedgerows-baseline.flow.md`](hedgerows-baseline.flow.md) Step 1, except the current item is the **Post-intervention** child nested under **Hedgerows**. `withSectionChildren` expands whichever section owns the current href, so Area habitats renders collapsed while Hedgerows keeps its link to `/projects/{id}/hedgerows-summary` and its children render as:

  | Child               | Rendered as                                              | When                                         |
  | ------------------- | -------------------------------------------------------- | -------------------------------------------- |
  | `Baseline`          | link to `/projects/{id}/hedgerows-baseline`              | only when the **baseline** has hedgerow data |
  | `Post-intervention` | `<strong aria-current="page">Post-intervention</strong>` | always (this page)                           |

  **Watercourses** appears only when `projectHasHabitatData(project, 'watercourses')` — an OR across baseline and post-intervention.

  > **Copy note.** BMD-860 AC3 writes the current item as "Post intervention"; the app renders **"Post-intervention"** (`POST_INTERVENTION_TEXT`). The AC's AC9 table likewise names the Baseline target `hedgerows-baseline-summary`; the implemented route is `hedgerows-baseline`. Both confirmed as stale AC text, not defects, during the BMD-860 manual validation (2026-09-14).

  **Heading** — project name caption, `<h1>Post intervention for hedgerows</h1>`, and the "Upload file" button whose `returnUrl` points back here.

  **Results** — `<h2>Hedgerows results</h2>` followed by an `appUnitTypeSummary` carrying the same five tiles as the project summary's Hedgerows section and the hedgerows summary's Results section: net percentage change (with its Met/Not met tag), Trading Rules, On-site baseline, On-site post-intervention, and total net unit change. As on every drill-down there is **no section `<h2>`** (no `headingHref`), so the section carries `aria-label="Hedgerows"`.

  The **baseline tile keeps its link** (`hedgerowsBaselineAction`) while the **post-intervention tile has no action line at all**. The controller passes `interventionAction: null`, which `resolveInterventionAction` distinguishes from `undefined` — `undefined` falls back to the shared inert "View on-site post intervention" default. That three-way distinction is BMD-860 AC5's exception, and it is why the absence assertion must be scoped to this page: the same component still renders the link on the project summary and the hedgerows summary.

  **Details** — `<h2>Hedgerow habitat details</h2>` and a `govukTabs` block titled `Intervention type`:

  | Tab        | Panel id    | Rendered when                                |
  | ---------- | ----------- | -------------------------------------------- |
  | `Retained` | `#retained` | at least one hedgerow normalises to Retained |
  | `Enhanced` | `#enhanced` | at least one hedgerow normalises to Enhanced |
  | `Created`  | `#created`  | at least one hedgerow normalises to Created  |

  Order is fixed by `INTERVENTION_TAB_ORDER`, not by the data. The **first visible** tab is selected on load, so a project with no Retained hedgerows opens on Enhanced. Each panel holds an `<h3>{Tab} hedgerow habitats</h3>` and that intervention type's grid (BMD-998). Every panel is rendered on a single page load — the tabs are client-side only, with no second request.

#### Intervention-type grid (BMD-998) `[IMPLEMENTED]`

Each panel holds a `moj-sortable-table` wrapped in an MOJ **scrollable pane** — a `<div class="moj-scrollable-pane" role="region" aria-label="{Tab} hedgerow habitats" tabindex="0">`, so the pane and the `<h3>` above it share a name. Built by `buildPostInterventionHabitatGrid` (`common/helpers/post-intervention-habitat-grid.js`) via the shared `appHabitatDetailsTable` macro, with one row per hedgerow of that intervention type.

**The column set varies by intervention type.** Retained carries `Condition`; Enhanced and Created drop it and carry the target/time-to-target block instead:

| Column                    | Retained | Enhanced | Created | Value                                                                   |
| ------------------------- | -------- | -------- | ------- | ----------------------------------------------------------------------- |
| `Ref`                     | ✓        | ✓        | ✓       | `feature.ref` (trimmed, falling back to `featureId`), linked to details |
| `Units`                   | ✓        | ✓        | ✓       | `formatHabitatUnits` — 2 dp, capped at 7 s.f.                           |
| `Size`                    | ✓        | ✓        | ✓       | `formatLengthKmDisplay` — 7 s.f. + `km`, no space                       |
| `Habitat type`            | ✓        | ✓        | ✓       | `proposed.type`                                                         |
| `Distinctiveness`         | ✓        | ✓        | ✓       | `"{label} ({score})"`                                                   |
| `Condition`               | ✓        | —        | —       | `"{label} ({score})"`                                                   |
| `Strategic significance`  | ✓        | ✓        | ✓       | fixed `Low (1)` for MVS (BMD-315 AC9)                                   |
| `Target condition`        | —        | ✓        | ✓       | `"{label} ({score})"` — the **proposed** condition                      |
| `Standard time to target` | —        | ✓        | ✓       | `formatYears` — `"1 year"` / `"N years"`                                |
| `Advance`                 | —        | ✓        | ✓       | `formatYears`                                                           |
| `Delay`                   | —        | ✓        | ✓       | `formatYears`                                                           |
| `Final time to target`    | —        | ✓        | ✓       | the **backend's** pre-formatted string — see the copy note below        |
| `Standard difficulty`     | —        | ✓        | ✓       | `"{label} ({multiplier})"`                                              |

A `<tfoot>` **totals row** closes every grid: the fixed text `Total` in the Ref column, `formatHabitatUnits` over the summed units, `formatTotalLengthSize` over the summed size, and an empty cell for every other column. Both sums are computed **server-side from the rendered features** (`sumFinite`), independently of the backend's persisted `postIntervention.units.hedgerowsTotal` driving the tiles above.

**Default order and sorting.** `sortHabitatFeatures` sorts by ref ascending before rendering, and every `<th>` ships `aria-sort="none"` — so no column is highlighted until the user clicks one. `createAll(SortableTable)` then binds MOJ's component to **every** grid on the page, including those inside `display:none` tab panels; a click toggles that column `ascending` → `descending` and clears the rest. Ref cells carry a zero-padded `data-sort-value` (`refSortValue`, 10-digit runs) so `P-10` sorts after `P-2`; numeric cells carry the raw value.

> **Copy note — `Final time to target` pluralises a one-year value.** The cell renders `"1 years (0.965)"` where the `Standard time to target` beside it correctly renders `"1 year"`. The frontend formats its own year columns with `formatYears`, which handles the singular, but takes `proposed.finalTimeToTargetCondition` **verbatim** from the backend, which hardcodes the plural (`bng-metric-backend` `proposed-time-difficulty-display.js`, `` `${finalYears} years (${timeMultiplier})` ``). It predates BMD-998 and is shared with area habitats and watercourses. Raised during the BMD-998 manual validation (2026-09-14) and **accepted by the ticket owner as out of scope** — not a defect against this page.

> **An Incomplete hedgerow renders as blank cells.** When the backend could not calculate units — an Enhanced hedgerow whose proposed condition does not improve on its baseline is the common case — `Units`, `Distinctiveness` and the whole target/time block render empty. This grid has **no `Status` column**, unlike the [post-intervention habitat list](../habitat-list/post-intervention-habitat-list.flow.md) (BMD-531), so nothing on the page says why. AC4's column table does not ask for one; flagged to the PO rather than treated as a defect.

**Tab visibility depends on normalisation, not on the raw value.** `visibleInterventionTabs` filters through `interventionDisplay`, which strips a leading `"N. "` list prefix. The backend normalises the category to pick an engine calculation but **never writes the normalised value back** (see the header comment in `post-intervention-habitat-details/retention.js`), so the document keeps whatever the GeoPackage carried — `"Retained"`, `"1. Retained"` or `"  Retained  "` all have to land in the same tab. Nothing but a real upload exercises that.

**`Lost` has no tab.** The backend drops Lost features at import (BMD-531/534), so they never reach the view. A fixture whose hedgerows are all Lost renders the page with no tabs at all — `{% if tabItems.length %}` suppresses the whole block.

- **Validation:** `id` path param must be a valid uuidv4 (Joi); invalid → Hapi 400
- **On success:** Renders `common/templates/habitat-post-intervention-page` with page title "Post intervention for hedgerows - {serviceName}"
- **On error:** As [`hedgerows-baseline.flow.md`](hedgerows-baseline.flow.md) Step 1 — no-baseline redirect, 404, 502, session-expired

---

### Step 2 — Redirect a project with no baseline to the task list `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/hedgerows-post-intervention` (the guard branch)
- **Template:** None (302)
- **Auth required:** Yes — as Step 1
- **Backend endpoint:** `GET /projects/{id}`
- **Description:** `hasBaselineData(project)` false → redirect before rendering. As on the other unit-type pages the guard is on **any** baseline, not on hedgerow data specifically.
- **Validation:** As Step 1
- **On success:** 302 to `/add-project-details/{id}`
- **On error:** As Step 1

---

### Step 3 — Switch intervention type tab `[IMPLEMENTED]`

- **Route:** None — client-side only (`govuk-frontend` Tabs, `data-module="govuk-tabs"`)
- **Template:** As Step 1
- **Auth required:** As Step 1
- **Backend endpoint:** None
- **Description:** Clicking a tab selects it, moves focus to it, reveals its panel and hides the previously selected one. Selection is conveyed by `aria-selected` and the `govuk-tabs__list-item--selected` modifier.

  **Every tab stays an `<a href="#panel-id">` element**, selected or not. BMD-860 AC6 and AC7 each say the selected tab's label "becomes text only (not a link)"; those bullets were **withdrawn on the ticket** (Colin Gray, 2026-09-09) when the implementation moved to the GOV.UK component. Visually the intent survives — the selected tab renders unlinked and unstyled, the others underlined — but in the DOM and the accessibility tree all three are anchors carrying `role="tab"`. That role **replaces** the implicit link role, so `getByRole('link')` matches none of them; a test for "is it a link" must assert the element and its `href`.

  With JavaScript unavailable the tabs degrade to in-page anchors over a stack of visible panels — the reason each panel is rendered up front.

- **Validation:** None
- **On success:** The clicked tab is selected and focused; its panel is visible
- **On error:** N/A

---

### Step 4 — Upload another file `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/upload-file?returnUrl=%2Fprojects%2F{id}%2Fhedgerows-post-intervention`
- **Template:** See [`../upload-file/choose-upload-type.flow.md`](../upload-file/choose-upload-type.flow.md)
- **Auth required:** As Step 1
- **Backend endpoint:** None on entry
- **Description:** The header "Upload file" button. `uploadFileHref` encodes this page as the `returnUrl`, so the selection page's Back and Cancel both come back here rather than defaulting to the task list.
- **Validation:** See the upload-file flow
- **On success:** Renders the file-type selection page
- **On error:** See the upload-file flow

---

## Entry points

| From                                                           | Href                                         | When                                                                      |
| -------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------- |
| Project summary — "View on-site hedgerows post intervention"   | `/projects/{id}/hedgerows-post-intervention` | the Hedgerows section renders **and** post-intervention data exists       |
| Hedgerows summary — "View on-site hedgerows post intervention" | `/projects/{id}/hedgerows-post-intervention` | post-intervention data exists (otherwise the tile offers the upload link) |
| Hedgerows summary — nav Post-intervention child                | `/projects/{id}/hedgerows-post-intervention` | always (the child renders whenever Hedgerows is the current section)      |
| Hedgerows baseline — nav Post-intervention child               | `/projects/{id}/hedgerows-post-intervention` | always, for the same reason                                               |

Both tile links come from `hedgerowsInterventionAction`; on a project with **no** post-intervention document the tile shows "Upload on-site post intervention file" instead, so neither entry point exists until a file is uploaded.

There is **no back link**; the left navigation is the only way up.

---

## Journey coverage

Added 2026-09-14 for the BMD-860 AC sweep and extended the same day for BMD-998 — `test/specs/project-management/hedgerows-post-intervention.spec.js` (16 tests, domain tag `@project-management`), plus the AC1 entry-point assertions folded into `project-summary.spec.js`.

`hedgerows-post-intervention/controller.test.js` covers this page in 15 tests, all with `wreck` mocked and four hand-built hedgerows. The journey tests cover only what that cannot reach:

| Test                                          | AC     | Why it needs a browser and real data                                                                                                                                            |
| --------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header, caption and upload action             | 4, 8   | this page's own `returnUrl`, and that following it resolves with Back returning here                                                                                            |
| Results tiles, no post-intervention self-link | 5      | the `null` vs `undefined` distinction in `resolveInterventionAction` renders identically to a mock that passes neither; and the tile values come from real backend fields       |
| Tiles agree with the hedgerows summary        | 5      | both pages read `hedgerowsTotal` through the same formatter — a mismatch means one has been re-pointed at a different backend field. Compared nowhere else                      |
| Left navigation                               | 3      | the only shape where the current item is a nested **Post-intervention** child; `unit-type-navigation.test.js` proves the builder as a pure function, not that its hrefs resolve |
| Tabs render per intervention type present     | 6      | tab visibility runs real `retentionCategory` strings through `interventionDisplay`; the unit test hands it already-shaped values. See the normalisation note in Step 1          |
| Created tab absent when nothing was created   | 6      | the negative half of the same condition, on a fixture whose hedgerows are Retained/Enhanced/Lost                                                                                |
| Clicking a tab selects it                     | 7      | **no other suite can see this at all** — the GOV.UK Tabs component is client-side JS and the unit tests parse markup with cheerio                                               |
| Every left-navigation link resolves           | 9a, 9b | five hrefs asserted in the unit test as attributes; only a browser proves they resolve, including the conditional Watercourses item                                             |
| Both hedgerows summary triggers open it       | 2a, 2b | the nav child and the results link are separate view-model paths that happen to share a target                                                                                  |
| (project-summary.spec.js) the tile link       | 1      | `project-summary.spec.js` asserted the **inert** default for all three unit types until BMD-860; the hedgerow tile is now the one that links                                    |

### BMD-998 — the grids inside the tabs

`hedgerows-post-intervention/controller.test.js:365-461` asserts the columns, rows, totals and `aria-sort="none"` headers in markup, but with `wreck` mocked and hand-built hedgerow literals: it proves the grid renders `proposed.distinctivenessScore` **if it arrives**, never that a real import emits it. The backend is the other half of the same gap — `post-intervention-persistence.test.js:154` asserts `status` and a numeric `units` for Enhanced **linear** features and nothing else: no Retained or Created hedgerow, and none of the ten `proposed.*` display fields these columns read.

| Test                                                     | AC        | Why it needs a browser and real data                                                                                                                   |
| -------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Retained grid — columns, rows, formats, Ref href, totals | 4a, 5, 7  | sole witness that a real hedgerow carries `ref`, `sizeMetres`, `units`, distinctiveness and condition through import into this grid                    |
| Created grid — target and time-to-target columns         | 4c, 5, 7  | the 12-column shape, and the only real-data witness for the target/time block                                                                          |
| Enhanced grid — same columns, populated on HG018         | 4b, 5     | runs on the **other** fixture; see the calculated-row note below                                                                                       |
| Click a column heading → ascending, then descending      | 8, 9      | the resulting ROW ORDER on this grid's own `data-sort-value`s, **and** that `createAll(SortableTable)` binds a table inside a `display:none` tab panel |
| A twelve-column grid's pane overflows horizontally       | 6         | the pane's overflow is a layout fact no markup assertion can see                                                                                       |
| Clicking a habitat reference opens the details page      | 10a, b, c | `post-intervention-habitat-details.spec.js` arrives from the **deprecated** habitat list's Hedgerows tab — a different page with different Ref cells   |
| (tabs describe) selecting Created reveals its subheading | 3         | every other test sees that heading hidden or absent, neither of which proves it renders when the tab is chosen                                         |

**Fixtures.** The BMD-860 pairing has exactly one hedgerow per tab, which cannot witness a totals row worth summing, a default ordering or a re-sort — so the grids use `getLinearInterventionTypesProject` (`created linear features`: 7 Retained, 2 Enhanced, 4 Created). Its Enhanced pair is the exception: **HG006 Good → Good and HG009 Moderate → Poor do not improve on their baseline condition**, so the engine calculates no units and their Units, Distinctiveness and target/time cells render empty. AC4b's column values therefore run on `getAllUnitTypesPostInterventionProject` instead, whose **HG018 (Poor → Moderate) is the only Enhanced hedgerow in any shipped fixture with a real uplift**.

`post-intervention-habitat-details.spec.js:281` builds the created-linear pairing through its own file-local project cache, so a worker running both files uploads it twice. Consolidating means unpicking that file's build-time unit harvesting, so it is deliberately left alone.

**Sole witness, do not delete without a replacement.** These are the only tests in any suite where a real uploaded hedgerow's fields reach a rendered grid. See the Backend coverage proposals in the BMD-998 analysis.

---

The three-tab project comes from `getHedgerowInterventionTypesProject` in `@utils/summary-projects.js` — the only fixture pairing that makes Retained, Enhanced **and** Created visible at once with the BMD-860 shape, so it is a new build. The AC6 negative case and the AC1 entry point both ride on `getAllUnitTypesPostInterventionProject`, already built by `project-summary.spec.js` in the same module-scope cache, so they cost **no upload**.

**Sole witness, do not delete without a replacement.** The tab tests are the only place in any suite where a real GeoPackage's retention values decide what renders — the backend integration suite asserts `retentionCategory === 'Enhanced'` persists with units (`post-intervention-persistence.test.js:172`) but never `Retained` or `Created`, and never renders. See the Backend coverage proposals in the BMD-860 analysis.

---

## Deferred elements

| Element                    | Current state                                                           | Marker      |
| -------------------------- | ----------------------------------------------------------------------- | ----------- |
| "View trading rules"       | inert `<span>` in the Trading Rules tile                                | `[PLANNED]` |
| PI Areas / PI Watercourses | no `postInterventionPath` in `OPTIONAL_UNIT_TYPES` for either unit type | `[PLANNED]` |
