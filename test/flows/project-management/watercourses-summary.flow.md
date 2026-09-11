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

  **Heading** — project name caption, `<h1>Watercourse habitats</h1>`, and the "Upload file" button. The H1 is the one place a unit-type page's copy diverges from its label: **frontend PR#271** (`25a5cbf`, 2026-09-07) re-headed it from "Watercourses" to "Watercourse habitats" for BMD-856, matching the area page's "Area habitats", while the nav item and the summary section's `aria-label` both stayed "Watercourses". The hedgerows page was not renamed, so it is still bare "Hedgerows". A locator that derives the H1 from the unit-type label — as `UnitTypeSummaryPage` did until that rename — finds nothing here.

  As on every drill-down page the unit summary section carries **no `<h2>`** (no `headingHref`), so it is reachable by `aria-label="Watercourses"` — the label, not the heading.

  The baseline tile **links** to [`/projects/{id}/watercourses-baseline`](watercourses-baseline.flow.md), reading "View on-site watercourses baseline" — its own unit type's wording, not the shared inert default "View on-site baseline". **BMD-859/861** (frontend PR#258, 2026-09-02) built the baseline page and linked it from the **project summary** tile and this page's navigation but left this tile inert; **PR#266** (2026-09-04) closed that gap by passing `watercoursesBaselineAction(href)` into this controller. The inert default survives only in the post-intervention-only state below, where BMD-897 nulls the action entirely.

- **Post-intervention-only watercourses (BMD-897) `[IMPLEMENTED]`:** when watercourses exist in `postIntervention` but not in `baseline`, `hasPostInterventionOnlyHabitat(project, 'watercourses')` is true and the summary changes shape exactly as documented for hedgerows — `Not applicable` percentage, no status tag, no baseline action, and the unhyphenated post-intervention heading.
- **Post-intervention-only targets (BMD-921) `[IMPLEMENTED]`:** the same flag also reshapes the **Targets** section. With no baseline to grow from, Tile 1 reads `Not applicable` instead of the fixed `10%`, and Tiles 2 and 3 both read `0.00 units` — units required is `0 × 1.1`, and the deficit clamps `max(0, 0 - PI units)` to zero. Until **frontend PR#275** (2026-09-11) Tile 1 read `10%` here; `/validate-ac-manual` caught it on 2026-09-04.

  The controller propagates `postInterventionOnly` **twice, as two independent arguments** — into `buildUnitSummary` for the Results rows and into `buildTargetsSummary` for the Targets tiles. The two shapes above therefore fail independently, which is why they carry a journey test each.

  The same PR gave `area-summary/controller.js` the new object signature but passes **no flag**, so an area project with post-intervention-only data still shows `10%` — consistent with BMD-918 being _Won't do_.

- **Unit sourcing:** baseline is `normaliseUnits(project.baseline.units.watercoursesTotal)`. Post-intervention reads `watercoursesTotal`, `watercoursesNetUnitChange` and `watercoursesNetUnitChangePercentage` from `project.postIntervention.units`; the frontend computes none of them.
- **Validation:** `id` path param must be a valid uuidv4 (Joi); invalid → Hapi 400
- **On success:** Renders `watercourses-summary/index` with page title "Watercourse habitats - {serviceName}" — PR#271 re-pointed `pageTitle` at the same constant as the H1, so the tab title changed with the heading
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

Rewritten 2026-09-01, extended 2026-09-08 and 2026-09-11 — `test/specs/project-management/watercourses-summary.spec.js` (8 tests, domain tag `@project-management`).

**The placeholder tests earned their keep.** They asserted the "under construction" copy and the absence of the upload button, Results heading and Targets section, on the reasoning that "when the real page ships these fail immediately and are rewritten, instead of the placeholder surviving behind a skip nobody revisits". BMD-856 shipped hours later and the first CI run failed on exactly that assertion. Worth remembering the next time a placeholder tempts a `test.skip`.

As with hedgerows, the tests do not re-assert the shared layout or the nav component's mechanics — `area-summary.spec.js` witnesses those. This page's own nav destinations are asserted here, because the AC names one per link. Covered here:

| Test                                             | Why it is not covered elsewhere                                                                                                         |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Watercourse figures and targets                  | reads `watercoursesTotal`, a third distinct backend field; also pins the upload button's returnUrl, which this controller builds itself |
| Baseline tile links to the watercourses baseline | the tile emits this unit type's own wording rather than the shared inert default                                                        |
| Watercourses current, area section collapsed     | the collapse case for this unit type, plus the three nav destinations this page offers                                                  |
| Both triggers open this page from the summary    | BMD-856 AC1 — the only witness that either route _into_ this page resolves                                                              |
| Post-intervention results and deficit            | BMD-856 AC4/AC5 — the only witness that watercourse post-intervention units reach this page and feed its targets arithmetic             |
| Post-intervention-only variant                   | `hasPostInterventionOnlyHabitat` is called with this page's own habitat-type argument — hedgerows' witness does not cover a typo here   |
| Post-intervention-only targets (BMD-921)         | the only real-data witness that the flag reaches `buildTargetsSummary`; the row above only proves it reaches `buildUnitSummary`         |

The post-intervention-only test needs a baseline with no watercourses plus a post-intervention file that has them — `getWatercourseGainProject` in `@utils/summary-projects.js`. The post-intervention results test needs both documents populated for every unit type — `getAllUnitTypesPostInterventionProject`, shared with the area and hedgerow specs, so it costs no extra upload in CI.

**Not covered here, deliberately:** the deficit clamping to zero from a **non-zero** baseline — a post-intervention file that clears a real 10% target. The clamp lives in the shared `buildTargetsSummary` (`unit-summary.test.js:207` proves it as a pure function) and `hedgerows-summary.spec.js` witnesses that rendering shape against real data. Once the shortfall test above proves this controller feeds watercourse units into that function, a second branch adds no wiring this suite does not already hold. (The BMD-921 test above reaches `0.00 units` the degenerate way, with nothing required in the first place, so it is not a substitute for that branch.)

---

## Deferred elements

| Element                          | Current state                                | Marker      |
| -------------------------------- | -------------------------------------------- | ----------- |
| "View trading rules"             | inert `<span>` in the Trading Rules tile     | `[PLANNED]` |
| "View on-site post intervention" | inert `<span>` once post-intervention exists | `[PLANNED]` |
