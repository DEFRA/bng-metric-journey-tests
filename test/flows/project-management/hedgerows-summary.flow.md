# Hedgerows Summary User Flow

## Overview

The hedgerow equivalent of the [area habitats summary](area-summary.flow.md): one unit type's units in isolation, plus the net-gain targets it has to meet. Reached from the left-hand unit-type navigation, which only offers it when the project actually has hedgerow data.

Added by **BMD-855 / BMD-919** (frontend PR#249, 2026-08-28). Before it, `/projects/{id}/hedgerows-summary` served the shared "under construction" placeholder; the route existed from BMD-854 but the page did not. **Its sibling `/watercourses-summary` is still on that placeholder** — see [`watercourses-summary.flow.md`](watercourses-summary.flow.md). The two linear unit types are no longer symmetrical, and a test that assumes they behave alike will be wrong about one of them.

## Steps

### Step 1 — View hedgerows summary `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/hedgerows-summary`
- **Template:** `src/server/hedgerows-summary/index.njk` (extends `common/templates/unit-type-page.njk`)
- **Auth required:** Yes — active session + an **approved (status 3)** `bng completer` role (`requireBngCompleterRole` pre-method)
- **Backend endpoint:** `GET /projects/{id}` (via `fetchProjectOrThrow`)
- **Description:** Renders the hedgerows view of a project that has a baseline.

  **Left navigation** — as [`area-summary.flow.md`](area-summary.flow.md) Step 1, with **Hedgerows** as the current item. Area habitats renders **collapsed** here: `buildUnitTypeItem` only attaches the Baseline child when the current page is `area-summary` or `area-baseline`, so moving to a different unit type collapses the section you came from. Hedgerows itself never expands — there is no hedgerow baseline page.

  **Navigation edge case.** The Hedgerows nav item is conditional on `projectHasHabitatData(project, 'hedgerows')`, but the **route is not**. A project with no hedgerow data anywhere still renders this page on a direct URL — it just shows zeros, and the nav contains no Hedgerows item to mark current, so nothing on the page is flagged `aria-current="page"`. Worth pinning in a test; it is the kind of state a user reaches from a stale bookmark.

  **Heading** — project name caption, `<h1>Hedgerows</h1>`, "Upload file" button with a `returnUrl` back to this page.

  **Results** — `<h2>Results</h2>` and one `appUnitTypeSummary`. As on every drill-down page there is **no section `<h2>`** (no `headingHref`), so the section carries `aria-label="Hedgerows"`.

  Unlike area habitats, the baseline tile passes **no `baselineAction`**, so it falls back to the shared default: inert text "View on-site baseline" (not "View on-site _area_ baseline") with no link, since no hedgerow baseline page exists.

  **Targets** — the same three tiles as the area summary: `10%` target, `baselineUnits × 1.1` units required, and `max(0, unitsRequired − postInterventionUnits)` deficit floored at zero, or `N/A` when the post-intervention figure is non-finite.

- **Post-intervention-only hedgerows (BMD-897) `[IMPLEMENTED]`:** when the project has hedgerows in `postIntervention` but **none** in `baseline`, `hasPostInterventionOnlyHabitat(project, 'hedgerows')` is true and the summary changes shape:

  | Element                   | Normal                                       | Post-intervention-only                           |
  | ------------------------- | -------------------------------------------- | ------------------------------------------------ |
  | Net percentage change     | formatted percentage + `Met`/`Not met` tag   | **`Not applicable`**, **no tag**                 |
  | Baseline tile action      | inert "View on-site baseline"                | **`null` — no action paragraph rendered at all** |
  | Post-intervention heading | "On-site post-**intervention**" (hyphenated) | "On-site post intervention" (unhyphenated)       |
  | Post-intervention action  | inert "View on-site post intervention"       | **link** "Upload on-site post intervention file" |

  The heading spelling flips because `buildPostInterventionSummary` treats post-intervention-only as _not_ a standard intervention. A locator keyed to the hyphenated heading will not find this variant.

- **Unit sourcing:** baseline is `normaliseUnits(project.baseline.units.hedgerowsTotal)` — non-finite normalises to `0`. Post-intervention reads `hedgerowsTotal`, `hedgerowsNetUnitChange` and `hedgerowsNetUnitChangePercentage` from `project.postIntervention.units`; the frontend computes none of them. Post-intervention units render `null` (→ `N/A`) rather than `0.00` when `hedgerowsTotal` is non-finite.
- **Validation:** `id` path param must be a valid uuidv4 (Joi); invalid → Hapi 400
- **On success:** Renders `hedgerows-summary/index` with page title "Hedgerows - {serviceName}"
- **On error:** As [`area-summary.flow.md`](area-summary.flow.md) Step 1 — no-baseline redirect, 404, 502, session-expired

---

### Step 2 — Redirect a project with no baseline to the task list `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/hedgerows-summary` (the guard branch)
- **Template:** None (302)
- **Auth required:** Yes — as Step 1
- **Backend endpoint:** `GET /projects/{id}`
- **Description:** `hasBaselineData(project)` false → redirect. Note this guards on **any** baseline, not on hedgerow data specifically — a project with an area-only baseline renders this page rather than redirecting.
- **Validation:** As Step 1
- **On success:** 302 to `/add-project-details/{id}`
- **On error:** As Step 1

---

## Entry points

| From                                          | Href                               | When                                           |
| --------------------------------------------- | ---------------------------------- | ---------------------------------------------- |
| Project summary nav                           | `/projects/{id}/hedgerows-summary` | only when the project has hedgerow data        |
| Project summary — "Hedgerows" section heading | `/projects/{id}/hedgerows-summary` | only when the Hedgerows section renders at all |
| Any unit-type page nav                        | `/projects/{id}/hedgerows-summary` | same condition                                 |

There is **no back link**; the left navigation is the only way back.

---

## Journey coverage

Added 2026-09-01 — `test/specs/project-management/hedgerows-summary.spec.js` (5 tests, domain tag `@project-management`).

This page is structurally identical to the area summary, so the tests deliberately do **not** re-assert the shared layout, the targets arithmetic or the nav mechanics — `area-summary.spec.js` witnesses all of that against real data, and repeating it would test the shared macro rather than this page's wiring. Covered here is only what differs:

| Test                                      | Why it is not covered by the area summary                                                                                                                                                                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hedgerow figures and targets              | reads `baseline.units.hedgerowsTotal`, a different backend field                                                                                                                                                                                          |
| Inert baseline tile                       | no hedgerow baseline page exists, so the wording drops "area" and carries no link                                                                                                                                                                         |
| Hedgerows current, area section collapsed | the collapse case — area-summary witnesses the expansion                                                                                                                                                                                                  |
| Post-intervention-only variant (BMD-897)  | `hasPostInterventionOnlyHabitat` is called by each controller with its own habitat-type argument. A shared helper is not shared coverage when the caller picks the parameter — point this page's call at the wrong type and every other test still passes |
| Direct URL with no hedgerow data          | the nav entry is conditional, the route is not; nothing is marked current                                                                                                                                                                                 |

The post-intervention-only test needs a baseline with no hedgerows plus a post-intervention file that has them — `getHedgerowGainProject` in `@utils/summary-projects.js`.

---

## Deferred elements

| Element                          | Current state                                     | Marker      |
| -------------------------------- | ------------------------------------------------- | ----------- |
| "View trading rules"             | inert `<span>` in the Trading Rules tile          | `[PLANNED]` |
| "View on-site baseline"          | inert `<span>` — no hedgerow baseline page exists | `[PLANNED]` |
| "View on-site post intervention" | inert `<span>` once post-intervention exists      | `[PLANNED]` |
