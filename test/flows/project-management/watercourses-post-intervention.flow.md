# Watercourses Post-Intervention User Flow

## Overview

The post-intervention twin of the [watercourses baseline](watercourses-baseline.flow.md): one level below the [watercourses summary](watercourses-summary.flow.md), showing every post-intervention watercourse split across **Retained / Enhanced / Created** tabs, one table per intervention type.

Added by **BMD-862** (frontend PR#285, merged 2026-09-15), which shipped the page furniture — left nav, header, results tiles and the tab shell. The grids inside the tabs are **BMD-999** (frontend PR#302, merged 2026-09-16) and are explicitly out of BMD-862's scope.

It is the second page built on `createHabitatPostInterventionController`, after [hedgerows post-intervention](hedgerows-post-intervention.flow.md). The two are the same factory with different config — habitat key, size reader, formatters, `baselineUnits` selector and `habitatNoun` — so **a witness for one is not a witness for the other**: every one of those values could be re-pointed at hedgerows with the hedgerow suite staying green.

Two things separate it from the other watercourse pages:

- Its tabs split by **intervention type** within watercourses. The [post-intervention habitat list](../habitat-list/post-intervention-habitat-list.flow.md) also has tabs, but they split by **unit type** (Areas / Hedgerows / Watercourses). Do not reuse one page's tab locators on the other.
- Its results tiles carry **no post-intervention action line at all** — the same self-link suppression the baseline page applies to its baseline tile, for the same reason: the link would point at the page the user is already on.

## Steps

### Step 1 — View the watercourses post-intervention page `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/watercourses-post-intervention`
- **Template:** `src/server/common/templates/habitat-post-intervention-page.njk` (extends `common/templates/unit-type-page.njk`)
- **Auth required:** Yes — active session + an **approved (status 3)** `bng completer` role (`requireBngCompleterRole` pre-method)
- **Backend endpoint:** `GET /projects/{id}` (via `fetchProjectOrThrow`)
- **Description:** Built by `createHabitatPostInterventionController` with `habitatKey: 'watercourses'`, `habitatNoun: 'watercourse'`, `readSize: (feature) => feature.sizeMetres` and `formatLengthKmDisplay` — the linear formatters, shared with hedgerows, not the area ones.

  **Left navigation** — as [`watercourses-baseline.flow.md`](watercourses-baseline.flow.md) Step 1, except the current item is the **Post-intervention** child nested under **Watercourses**. `withSectionChildren` expands whichever section owns the current href, so Area habitats renders collapsed while Watercourses keeps its link to `/projects/{id}/watercourses-summary` and its children render as:

  | Child               | Rendered as                                              | When                                            |
  | ------------------- | -------------------------------------------------------- | ----------------------------------------------- |
  | `Baseline`          | link to `/projects/{id}/watercourses-baseline-summary`   | only when the **baseline** has watercourse data |
  | `Post-intervention` | `<strong aria-current="page">Post-intervention</strong>` | always (this page)                              |

  **Hedgerows** appears only when `projectHasHabitatData(project, 'hedgerows')` — an OR across baseline and post-intervention.

  > **Copy note.** BMD-862 AC3 writes the current item as "Post intervention"; the app renders **"Post-intervention"** (`POST_INTERVENTION_TEXT`). Confirmed stale AC text, not a defect, during the BMD-862 manual validation (2026-09-16). Unlike the hedgerow page, the AC9 table's Baseline target (`watercourses-baseline-summary`) **does** match the implemented route.

  **Heading** — project name caption, `<h1>Post intervention for watercourses</h1>`, and the "Upload file" button whose `returnUrl` points back here.

  **Results** — `<h2>Watercourses results</h2>` followed by an `appUnitTypeSummary` carrying the same five tiles as the project summary's Watercourses section and the watercourses summary's Results section: net percentage change (with its Met/Not met tag), Trading Rules, On-site baseline, On-site post-intervention, and total net unit change. As on every drill-down there is **no section `<h2>`** (no `headingHref`), so the section carries `aria-label="Watercourses"` — and that label must be matched `exact`, because each tab panel's pane is named "{Tab} watercourse habitats".

  The **baseline tile keeps its link** (`watercoursesBaselineAction`) while the **post-intervention tile has no action line at all**. The controller passes `interventionAction: null`, which `resolveInterventionAction` distinguishes from `undefined` — `undefined` falls back to the shared inert "View on-site post intervention" default. That three-way distinction is BMD-862 AC5's exception, and it is why the absence assertion must be scoped to this page: the same component still renders the link on the project summary and the watercourses summary.

  > **Copy note.** AC5 writes the wording it wants removed as "View on-site watercourse post-**intervention**"; the app's wording everywhere else is "View on-site watercourse**s** post intervention". An exact match on either spelling alone would pass with the other still on the page, so the absence assertion uses a pattern covering both.

  **Details** — `<h2>Watercourses habitat details</h2>` and a `govukTabs` block titled `Intervention type`:

  | Tab        | Panel id    | Rendered when                                   |
  | ---------- | ----------- | ----------------------------------------------- |
  | `Retained` | `#retained` | at least one watercourse normalises to Retained |
  | `Enhanced` | `#enhanced` | at least one watercourse normalises to Enhanced |
  | `Created`  | `#created`  | at least one watercourse normalises to Created  |

  Order is fixed by `INTERVENTION_TAB_ORDER`, not by the data. The **first visible** tab is selected on load, so a project with no Retained watercourses opens on Enhanced. Each panel holds an `<h3>{Tab} watercourse habitats</h3>` and that intervention type's grid (BMD-999). Every panel is rendered on a single page load — the tabs are client-side only, with no second request.

  **Tab visibility depends on normalisation, not on the raw value.** `visibleInterventionTabs` filters through `interventionDisplay`, which strips a leading `"N. "` list prefix. The backend normalises the category to pick an engine calculation but **never writes the normalised value back** (see the header comment in `post-intervention-habitat-details/retention.js`), so the document keeps whatever the GeoPackage carried — `"Retained"`, `"1. Retained"` or `"  Retained  "` all have to land in the same tab. Nothing but a real upload exercises that.

  **`Lost` has no tab.** The backend drops Lost features at import (BMD-531/534), so they never reach the view. A fixture whose watercourses are all Lost renders the page with no tabs at all — `{% if tabItems.length %}` suppresses the whole block.

- **Validation:** `id` path param must be a valid uuidv4 (Joi); invalid → Hapi 400
- **On success:** Renders `common/templates/habitat-post-intervention-page` with page title "Post intervention for watercourses - {serviceName}"
- **On error:** As [`watercourses-baseline.flow.md`](watercourses-baseline.flow.md) Step 1 — no-baseline redirect, 404, 502, session-expired

---

### Step 2 — Redirect a project with no baseline to the task list `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/watercourses-post-intervention` (the guard branch)
- **Template:** None (302)
- **Auth required:** Yes — as Step 1
- **Backend endpoint:** `GET /projects/{id}`
- **Description:** `hasBaselineData(project)` false → redirect before rendering. As on the other unit-type pages the guard is on **any** baseline, not on watercourse data specifically.
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

  **Every tab stays an `<a href="#panel-id">` element**, selected or not. BMD-862 AC6 and AC7 each say the selected tab's label "becomes text only (not a link)". Visually the intent survives — the selected tab renders unlinked and unstyled, the others underlined, confirmed in the BMD-862 manual evidence — but in the DOM and the accessibility tree all three are anchors carrying `role="tab"`. That role **replaces** the implicit link role, so `getByRole('link')` matches none of them; a test for "is it a link" must assert the element and its `href`.

  BMD-862 carries no comment withdrawing those bullets, but the identical bullets on its hedgerow twin were **withdrawn on BMD-860** (Colin Gray, 2026-09-09) when the implementation moved to the GOV.UK component. Treated the same way here.

  With JavaScript unavailable the tabs degrade to in-page anchors over a stack of visible panels — the reason each panel is rendered up front.

- **Validation:** None
- **On success:** The clicked tab is selected and focused; its panel is visible
- **On error:** N/A

---

### Step 4 — Upload another file `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/upload-file?returnUrl=%2Fprojects%2F{id}%2Fwatercourses-post-intervention`
- **Template:** See [`../upload-file/choose-upload-type.flow.md`](../upload-file/choose-upload-type.flow.md)
- **Auth required:** As Step 1
- **Backend endpoint:** None on entry
- **Description:** The header "Upload file" button. `uploadFileHref` encodes this page as the `returnUrl`, so the selection page's Back and Cancel both come back here rather than defaulting to the task list.
- **Validation:** See the upload-file flow
- **On success:** Renders the file-type selection page
- **On error:** See the upload-file flow

---

## Entry points

| From                                                                 | Href                                            | When                                                                      |
| -------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------- |
| Project summary — "View on-site watercourses post intervention"      | `/projects/{id}/watercourses-post-intervention` | the Watercourses section renders **and** post-intervention data exists    |
| Watercourses summary — "View on-site watercourses post intervention" | `/projects/{id}/watercourses-post-intervention` | post-intervention data exists (otherwise the tile offers the upload link) |
| Watercourses summary — nav Post-intervention child                   | `/projects/{id}/watercourses-post-intervention` | always (the child renders whenever Watercourses is the current section)   |
| Watercourses baseline — nav Post-intervention child                  | `/projects/{id}/watercourses-post-intervention` | always, for the same reason                                               |

Both tile links come from `watercoursesInterventionAction`; on a project with **no** post-intervention document the tile shows "Upload on-site post intervention file" instead, so neither entry point exists until a file is uploaded.

There is **no back link**; the left navigation is the only way up.

---

## Journey coverage

Added 2026-09-16 for the BMD-862 AC sweep — `test/specs/project-management/watercourses-post-intervention.spec.js` (9 tests, domain tag `@project-management`), plus the AC1 entry-point assertions folded into `project-summary.spec.js`.

`watercourses-post-intervention/controller.test.js` covers this page in 13 tests, all with `wreck` mocked and four hand-built watercourses. The journey tests cover only what that cannot reach:

| Test                                          | AC     | Why it needs a browser and real data                                                                                                                                                               |
| --------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header, caption and upload action             | 4, 8   | this page's own `returnUrl`, and that following it resolves with Back returning here                                                                                                               |
| Results tiles, no post-intervention self-link | 5      | the `null` vs `undefined` distinction in `resolveInterventionAction` renders identically to a mock that passes neither; and the tile values come from real backend fields                          |
| Tiles agree with the watercourses summary     | 5      | both pages read `watercoursesTotal` through the same formatter — a mismatch means one has been re-pointed at a different backend field. Compared nowhere else                                      |
| Left navigation                               | 3      | the only shape where the current item is a nested **Post-intervention** child under Watercourses; `unit-type-navigation.test.js` proves the builder as a pure function, not that its hrefs resolve |
| Tabs render per intervention type present     | 6      | tab visibility runs real `retentionCategory` strings through `interventionDisplay`; the unit test hands it already-shaped values, including a literal `'1. Enhanced'`. See Step 1                  |
| Clicking a tab selects it                     | 7      | **no other suite can see this at all** — the GOV.UK Tabs component is client-side JS and the unit tests parse markup with cheerio                                                                  |
| Every left-navigation link resolves           | 9      | five hrefs asserted in the unit test as attributes; only a browser proves they resolve, including the conditional Hedgerows item                                                                   |
| Both watercourses summary triggers open it    | 2a, 2b | the nav child and the results link are separate view-model paths that happen to share a target; before this, `watercourses-summary.spec.js:251` proved only that the link is **visible**           |
| (project-summary.spec.js) the tile link       | 1      | `project-summary.spec.js:735` asserted only the **absence** of the inert default for watercourses — never that the link renders, carries the href, or resolves                                     |

**Fixtures.** The three-tab project comes from `getWatercourseInterventionTypesProject` in `@utils/summary-projects.js` — `Baseline - complete with watercourse refs.gpkg` (WC1, plus 2 hedgerows so the conditional Hedgerows nav item renders) paired with `Post-intervention - watercourses mixed retention.gpkg` (WC1 Retained, WC2 Enhanced, WC3 Created). It is the only shipped pairing that makes all three tabs visible at once, so it is a new build. The same pairing is already used by `post-intervention-habitat-list.spec.js` and `post-intervention-habitat-details.spec.js` through their own file-local caches.

**Sole witness, do not delete without a replacement.** The tab tests are the only place in any suite where a real GeoPackage's **watercourse** retention values decide what renders — the backend integration suite asserts `retentionCategory === 'Enhanced'` persists with units (`post-intervention-persistence.test.js:172`) but never `Retained` or `Created`, and never renders. The hedgerow tab tests do not stand in: `visibleInterventionTabs` is called per unit type with that type's own features. See the Backend coverage proposals in the BMD-862 analysis.

### BMD-999 — the grids inside the tabs `[IMPLEMENTED]`

Shipped by frontend PR#302 and covered here since 2026-09-16 — five tests in the
"intervention type grids" describe of `watercourses-post-intervention.spec.js`, added after
the BMD-999 AC sweep.

`watercourses-post-intervention/controller.test.js:279-415` asserts the Retained / Enhanced /
Created columns, values, totals and `aria-sort="none"` headers in markup — but with `wreck`
mocked and hand-built watercourse literals (`:28-56`), so it proves the grid renders
`riparianEncroachmentMultiplier` IF it arrives, never that a real import emits it. The
journey tests cover only what that cannot reach:

| Test                              | AC       | Why it needs a browser and real data                                                                                                                                      |
| --------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Retained grid                     | 4a, 5, 7 | the 9-column shape, and the only proof a real import emits the `baseline.*` fields it reads                                                                               |
| Enhanced grid                     | 4b, 5, 6 | the 14-column shape from real `proposed.*` fields, and whether the pane actually overflows — markup cannot show a layout fact                                             |
| Created grid                      | 4c, 5    | the same column set reached through a different retention path                                                                                                            |
| Re-sort ascending then descending | 8, 9     | the GOV.UK/MOJ sort is client-side JS; the unit tests parse markup with cheerio and cannot run it                                                                         |
| Ref link opens the details page   | 10       | `post-intervention-habitat-details.spec.js` reaches those pages by harvesting a featureId from the DEPRECATED habitat list and opening the URL — nothing clicks THIS grid |

**Not covered by the neighbours**, both of which look like coverage at a glance:

- The **deprecated post-intervention habitat list** asserts watercourse units and a totals row
  from real data (`post-intervention-habitat-list.spec.js:826,845`), but that page is built by
  `createHabitatListController` — a different builder. Nothing transfers.
- The **hedgerow twin** (`hedgerows-post-intervention.spec.js:646`) exercises the same
  `buildPostInterventionHabitatGrid`, but the factory takes `buildExtraColumns` as per-page
  config, and `buildWatercourseExtraColumns` — the Watercourse and Riparian encroachment
  columns — is watercourse-only.

**Sole witness, do not delete without a replacement.** These are the only tests in any suite
where a real uploaded watercourse's encroachment fields reach a rendered grid. Deleting them
would leave `buildWatercourseExtraColumns` proven only against fabricated literals. See the
Backend coverage proposals in the BMD-999 analysis.

> **Observed during the BMD-862 manual validation (2026-09-16).** In the Enhanced tab the fixture's WC2 renders an **empty Units cell and a `0.00` totals row** — the same "Incomplete feature renders as blank cells" shape the hedgerow grid has, with no `Status` column to explain it. It sits against BMD-862's shared precondition "units were successfully calculated on import" and against `post-intervention-persistence.test.js:177`, which asserts `units > 0` for Enhanced linear features. Raised against **BMD-999**, not this page's ACs. Confirmed again during the BMD-999 manual validation (2026-09-16) on a second fixture — R008 in `Post-intervention - all unit and intervention types.gpkg` (`Good -> Good`, no uplift) renders the same way, and its encroachment cells lose the `(multiplier)` suffix too. Both fixtures' non-uplift rows are excluded by the ACs' own precondition, so the grid tests assert VALUES only on a calculated row.

---

## Deferred elements

| Element              | Current state                                                                            | Marker      |
| -------------------- | ---------------------------------------------------------------------------------------- | ----------- |
| "View trading rules" | inert `<span>` in the Trading Rules tile                                                 | `[PLANNED]` |
| PI Areas             | no `postInterventionPath` for area habitats in `OPTIONAL_UNIT_TYPES` — BMD-858 unshipped | `[PLANNED]` |
