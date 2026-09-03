# Watercourses Summary User Flow

## Overview

The watercourse equivalent of the [area habitats summary](area-summary.flow.md) and the [hedgerows summary](hedgerows-summary.flow.md): one unit type's units in isolation, plus the net-gain targets it has to meet. Reached from the left-hand unit-type navigation, which only offers it when the project actually has watercourse data.

**Was a placeholder until 2026-09-01.** BMD-854 (PR#237, 2026-08-25) added the route with a shared "under construction" controller for both linear types. BMD-855/BMD-919 (PR#249, 08-28) built the real hedgerows page and left this one behind, so for four days the two linear types were not symmetrical. **BMD-856/BMD-921** (PR#250, 2026-09-01) closed that gap — the shared `createUnitSummaryPlaceholderController` now has no callers in the frontend, which the service team may want to remove.

That PR also lifted `buildTargetsSummary` out of the area and hedgerow controllers into the shared `unit-summary.js`; all three unit types now compute their targets through one function.

## Steps

### Step 1 — View watercourses summary `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/watercourses-summary`
- **Template:** `src/server/watercourses-summary/index.njk` (extends `common/templates/unit-type-page.njk`)
- **Auth required:** Yes — active session + an **approved (status 3)** `bng completer` role (`requireBngCompleterRole` pre-method)
- **Backend endpoint:** `GET /projects/{id}` (via `fetchProjectOrThrow`)
- **Description:** Renders the watercourses view of a project that has a baseline. Layout, navigation, Results and Targets are identical to [`hedgerows-summary.flow.md`](hedgerows-summary.flow.md) Step 1 — the same `unit-type-page.njk` shell, the same `appUnitTypeSummary` and `appTargetsSummary` macros, and the same conditional navigation.

  **Navigation edge case**, as for hedgerows: the Watercourses nav item is conditional on `projectHasHabitatData(project, 'watercourses')`, but the **route is not**. A project with no watercourse data still renders this page on a direct URL, showing zeroes, with nothing in the nav marked current.

  As on every drill-down page the unit summary section carries **no `<h2>`** (no `headingHref`), so it is reachable by `aria-label="Watercourses"`.

  The baseline tile passes **no `baselineAction`**, so it falls back to the shared inert default "View on-site baseline", without the word "area" the linked area variant carries. **BMD-859/861** (frontend PR#258, 2026-09-02) built `/projects/{id}/watercourses-baseline` and linked it from the **project summary** tile and this page's navigation, but left this tile inert.

- **Post-intervention-only watercourses (BMD-897) `[IMPLEMENTED]`:** when watercourses exist in `postIntervention` but not in `baseline`, `hasPostInterventionOnlyHabitat(project, 'watercourses')` is true and the summary changes shape exactly as documented for hedgerows — `Not applicable` percentage, no status tag, no baseline action, and the unhyphenated post-intervention heading.
- **Unit sourcing:** baseline is `normaliseUnits(project.baseline.units.watercoursesTotal)`. Post-intervention reads `watercoursesTotal`, `watercoursesNetUnitChange` and `watercoursesNetUnitChangePercentage` from `project.postIntervention.units`; the frontend computes none of them.
- **Validation:** `id` path param must be a valid uuidv4 (Joi); invalid → Hapi 400
- **On success:** Renders `watercourses-summary/index` with page title "Watercourses - {serviceName}"
- **On error:** As [`area-summary.flow.md`](area-summary.flow.md) Step 1 — no-baseline redirect, 404, 502, session-expired

---

### Step 2 — Redirect a project with no baseline to the task list `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/watercourses-summary` (the guard branch)
- **Template:** None (302)
- **Auth required:** Yes — as Step 1
- **Backend endpoint:** `GET /projects/{id}`
- **Description:** `hasBaselineData(project)` false → redirect. Guards on **any** baseline, not on watercourse data specifically.
- **Validation:** As Step 1
- **On success:** 302 to `/add-project-details/{id}`
- **On error:** As Step 1

---

## Journey coverage

Rewritten 2026-09-01 — `test/specs/project-management/watercourses-summary.spec.js` (4 tests, domain tag `@project-management`).

**The placeholder tests earned their keep.** They asserted the "under construction" copy and the absence of the upload button, Results heading and Targets section, on the reasoning that "when the real page ships these fail immediately and are rewritten, instead of the placeholder surviving behind a skip nobody revisits". BMD-856 shipped hours later and the first CI run failed on exactly that assertion. Worth remembering the next time a placeholder tempts a `test.skip`.

As with hedgerows, the tests do not re-assert the shared layout or nav mechanics — `area-summary.spec.js` witnesses those. Covered here:

| Test                                         | Why it is not covered elsewhere                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Watercourse figures and targets              | reads `watercoursesTotal`, a third distinct backend field                                                                             |
| Inert baseline tile                          | no watercourse baseline page exists                                                                                                   |
| Watercourses current, area section collapsed | the collapse case for this unit type                                                                                                  |
| Post-intervention-only variant               | `hasPostInterventionOnlyHabitat` is called with this page's own habitat-type argument — hedgerows' witness does not cover a typo here |

The post-intervention-only test needs a baseline with no watercourses plus a post-intervention file that has them — `getWatercourseGainProject` in `@utils/summary-projects.js`.

---

## Deferred elements

| Element                          | Current state                                                   | Marker      |
| -------------------------------- | --------------------------------------------------------------- | ----------- |
| "View trading rules"             | inert `<span>` in the Trading Rules tile                        | `[PLANNED]` |
| "View on-site baseline"          | inert `<span>` — the page exists, this tile does not link to it | `[PLANNED]` |
| "View on-site post intervention" | inert `<span>` once post-intervention exists                    | `[PLANNED]` |
