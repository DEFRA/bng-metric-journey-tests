# Area Habitats Summary User Flow

## Overview

The user drills down from the [project summary](project-summary.flow.md) into a single unit type — area habitats — to see that type's units in isolation alongside the net-gain targets it has to meet. It is the first of the drill-down pages the project summary was always meant to link to.

Added by **BMD-854** (frontend PR#237, 2026-08-25, "Area Habitats Redesign"), which built the shared drill-down scaffolding: the `unit-type-page.njk` layout, the left-hand unit-type navigation, the `appTargetsSummary` macro, and the placeholder controller its sibling pages reuse. **BMD-897** (PR#238, 2026-08-25) then added the post-intervention-only state to the shared `buildUnitSummary`.

## Steps

### Step 1 — View area habitats summary `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/area-summary`
- **Template:** `src/server/area-summary/index.njk` (extends `common/templates/unit-type-page.njk`)
- **Auth required:** Yes — active session + an **approved (status 3)** `bng completer` role (`requireBngCompleterRole` pre-method; redirects to `/auth/forbidden` otherwise)
- **Backend endpoint:** `GET /projects/{id}` (via `fetchProjectOrThrow` in `src/server/common/helpers/fetch-project.js`)
- **Description:** Renders the area-habitats view of a project that has a baseline. Layout is the wide container (`app-width-container--wide`) split into a one-sixth navigation column and a five-sixths main column.

  **Left navigation** — `<nav aria-label="Project summary">` built by `buildUnitTypeNavigation` (`src/server/common/helpers/unit-type-navigation.js`). Items are **conditional**, not a fixed list:

  | Item          | When present                                               |
  | ------------- | ---------------------------------------------------------- |
  | Summary       | always — links to `/projects/{id}/project-summary`         |
  | Area habitats | always                                                     |
  | Hedgerows     | only when `projectHasHabitatData(project, 'hedgerows')`    |
  | Watercourses  | only when `projectHasHabitatData(project, 'watercourses')` |

  `projectHasHabitatData` is true when **either** `baseline` **or** `postIntervention` carries a non-empty array for that type — so a hedgerow that exists only post-intervention still earns its nav item.

  **Current-item rendering.** `markCurrent` strips the `href` from the item matching the current page and sets `current: true`; `projectNavLabel` then renders it as `<strong class="app-project-navigation__current" aria-current="page">` rather than a link. On this page that is **Area habitats**.

  **Expansion.** Only the unit type being viewed expands. `buildUnitTypeItem` gives Area habitats a `children` array containing a single **Baseline** child (→ `/projects/{id}/area-baseline`) when the current href is either `area-summary` or `area-baseline`; on any other page Area habitats renders collapsed with no child. Hedgerows and Watercourses never expand — they have no baseline page.

  **Heading** — project name as a `govuk-caption-l`, `<h1>Area habitats</h1>`, and a GOV.UK **"Upload file"** button to the right, href `uploadFileHref(projectId, '/projects/{id}/area-summary')` — i.e. the shared file-type selection page carrying a `returnUrl` back to **this** page.

  **Results** — an `<h2>Results</h2>` followed by a single `appUnitTypeSummary` for area habitats. Note this section has **no `<h2>` of its own**: the macro renders its heading only when `headingHref` is supplied, and the drill-down pages supply none. The section therefore falls back to `aria-label="Area habitats"` instead of `aria-labelledby="area-habitats-heading"`. **A locator that finds the section by its `<h2>` on the project summary finds nothing here.**

  Tiles, per the shared macro:

  | Tile                                | Value                                                                                                                                                            |
  | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Total on-site net percentage change | `-100.00%` + red `Not met` when baseline > 0 and no post-intervention; otherwise the backend percentage, green `Met` at ≥ 10%; `N/A` with no tag when non-finite |
  | Trading Rules                       | inert text "View trading rules" — `[PLANNED]`                                                                                                                    |
  | On-site baseline                    | `{units} units` + **link** "View on-site area baseline" → `/projects/{id}/area-baseline`                                                                         |
  | On-site post intervention           | `0.00 units` + link "Upload on-site post intervention file" when absent; backend units + inert "View on-site post intervention" when present                     |
  | Total on-site net unit change       | negated baseline when no post-intervention; else the backend `habitatsNetUnitChange`                                                                             |

  The baseline tile's action is `areaBaselineAction('/projects/{id}/area-baseline')` — **the only baseline tile anywhere that is a link**, and the only one whose text reads "View on-site **area** baseline" rather than "View on-site baseline".

  **Targets** — an `appTargetsSummary` section, `<section class="app-targets-summary" aria-labelledby="targets-heading">` with `<h2 id="targets-heading">Targets</h2>` and three tiles:

  | Tile                       | Value                                                                                                              |
  | -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
  | Target percentage net gain | `10%` — `NET_GAIN_TARGET_PERCENTAGE`, hardcoded                                                                    |
  | Units required             | `baselineUnits × 1.1`, 2dp, suffixed ` units`                                                                      |
  | Unit deficit               | `max(0, unitsRequired − postInterventionUnits)`, 2dp + ` units`; `N/A` when post-intervention units are non-finite |

  The deficit floors at zero, so a project that has met its target reads `0.00 units` rather than a negative figure. With **no** post-intervention document at all the units are treated as `0`, so the deficit equals the units required.

- **Unit sourcing:** area units are `areaUnits(units)` = `habitatsTotal + treesTotal` from `project.baseline.units`, each normalising to `0` when absent. The post-intervention side uses `areaInterventionSummary` = `areaUnits(units, null)` — **null**, not zero, when both totals are absent, which is what makes the deficit render `N/A` rather than a misleading number.
- **Validation:** `id` path param must be a valid uuidv4 (Joi); invalid → Hapi 400
- **On success:** Renders `area-summary/index` with page title "Area habitats - {serviceName}"
- **On error:**
  - Project has **no baseline** → 302 to `/add-project-details/{id}` (Step 2)
  - Backend 404 → `Boom.notFound` → the global `error/index` page (404)
  - Backend unreachable or any non-2xx / non-404 status → `Boom.badGateway` ("Failed to fetch project") → `error/index` (502)
  - Dead, unrefreshable session → redirect to `/auth/session-expired`

---

### Step 2 — Redirect a project with no baseline to the task list `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/area-summary` (same route — the guard branch)
- **Template:** None (302)
- **Auth required:** Yes — as Step 1
- **Backend endpoint:** `GET /projects/{id}`
- **Description:** `hasBaselineData(project)` is `Boolean(project?.baseline)`. When false the handler redirects before rendering — the page has nothing to show without a baseline. Identical to the guard on the project summary and on every other unit-type page.
- **Validation:** As Step 1
- **On success:** 302 to `/add-project-details/{id}`
- **On error:** As Step 1

---

## Entry points

| From                                              | Href                          | When                                             |
| ------------------------------------------------- | ----------------------------- | ------------------------------------------------ |
| Project summary nav                               | `/projects/{id}/area-summary` | always                                           |
| Project summary — "Area habitats" section heading | `/projects/{id}/area-summary` | always — the `<h2>` is a real link since BMD-854 |
| Area baseline nav                                 | `/projects/{id}/area-summary` | always — parent of the expanded Baseline child   |

There is **no back link** on this page; the left navigation is the only way back to the summary.

---

## Journey coverage

Added 2026-09-01 by `/discover-journey-tests` — `test/specs/project-management/area-summary.spec.js` (12 tests, domain tag `@project-management`). Extended 2026-09-03 by `/validate-ac-automated` against the BMD-854 ACs, which added the five post-intervention and navigation-wiring tests in the last five rows below.

The frontend unit suite already covers this page densely (`area-summary/controller.test.js`, 20 tests; plus `unit-summary.test.js` and `unit-type-navigation.test.js`), but every one of those mocks `wreck` and is handed hand-written literals — so they prove the page's **rendering**, never that the backend emits those fields. The journey tests deliberately do not mirror them. They cover only what a mocked test cannot:

| Test                                          | Why it needs a real browser and real data                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Renders from real backend data                | `baseline.units` actually reaches the page                                                                                            |
| Baseline units agree with the project summary | both pages read the same backend field through the same formatter — a mismatch means one is reading something else                    |
| Targets computed from the real baseline       | the Targets section exists nowhere else in the service; nothing outside the mocked tests had seen this arithmetic run on real numbers |
| Nav expansion                                 | the **Baseline** child renders only on the area pages; the project summary witnesses only the collapsed state                         |
| Drill-down wiring ×2                          | unit tests assert the href is in the markup, not that following it resolves                                                           |
| Entry points (BMD-854 AC1)                    | the nav link and section-heading hrefs are asserted on the project summary but were never followed                                    |
| Left-nav destinations (AC7)                   | the baseline-only fixture renders no Hedgerows link, so neither linear href was ever asserted or followed from this page              |
| Post-intervention results (AC4)               | every other test here runs baseline-only; nothing rendered the populated tile, its hyphenated heading, the percentage or net change   |
| Deficit — shortfall (AC5)                     | `buildTargetsSummary` is shared, but this controller picks what to feed it — re-pointing it at another unit type would stay green     |
| Deficit — target met (AC5)                    | the only non-degenerate zero-deficit case for area units; needs the area net-gain fixture pair, not the linear one                    |

Deliberately **not** covered here, each with its witness: invalid uuid → 400 (Joi rejects before the mocked boundary, so `controller.test.js:435` is genuine coverage); unauthenticated and role enforcement (`auth: 'session'` and `requireBngCompleterRole` take no per-route parameter — `session-expired.spec.js` and `forbidden.spec.js:89` witness them); unknown uuid, cross-user IDOR and the no-baseline guard (same `fetchProjectOrThrow` and guard, witnessed on `project-summary`).

---

## Deferred elements

| Element                          | Current state                                | Marker      |
| -------------------------------- | -------------------------------------------- | ----------- |
| "View trading rules"             | inert `<span>` in the Trading Rules tile     | `[PLANNED]` |
| Trading rules status             | not rendered                                 | `[PLANNED]` |
| "View on-site post intervention" | inert `<span>` once post-intervention exists | `[PLANNED]` |
