# Watercourses Summary User Flow

## Overview

The watercourses drill-down. The route, the auth, the no-baseline guard and the left-hand navigation are all live, but the page itself is still the shared **placeholder** — it renders an "under construction" line where the results and targets belong.

The route arrived with **BMD-854** (frontend PR#237, 2026-08-25) alongside a hedgerows placeholder. **BMD-855 / BMD-919** (PR#249, 2026-08-28) then built the real hedgerows page and left this one behind, so the two linear unit types are **no longer symmetrical**: `/hedgerows-summary` renders results and targets, `/watercourses-summary` does not. See [`hedgerows-summary.flow.md`](hedgerows-summary.flow.md).

## Steps

### Step 1 — View the watercourses placeholder `[IMPLEMENTED]`

Marked `[IMPLEMENTED]` rather than `[PLANNED]` because the route, the role check, the redirect guard, the navigation and the placeholder copy are all real and testable today. Only the results content is missing — tracked separately below.

- **Route:** `GET /projects/{id}/watercourses-summary`
- **Template:** `src/server/common/templates/unit-summary-placeholder.njk` — **shared**, not a `watercourses-summary/index.njk`. The route directory contains no template of its own.
- **Auth required:** Yes — active session + an **approved (status 3)** `bng completer` role (`requireBngCompleterRole` pre-method)
- **Backend endpoint:** `GET /projects/{id}` (via `fetchProjectOrThrow`)
- **Description:** The controller is `createUnitSummaryPlaceholderController({ label: 'Watercourses', current: 'Watercourses', summaryPath: 'watercourses-summary' })` from `src/server/common/helpers/unit-summary-placeholder-controller.js`. It fetches the project, applies the same baseline guard as every other unit-type page, and renders the placeholder.

  The page has the same wide two-column shell as the real pages — one-sixth navigation, five-sixths main — but the main column holds only:

  - project name as a `govuk-caption-l`
  - `<h1 class="govuk-heading-xl">Watercourses</h1>`
  - `<p class="govuk-body">The Watercourses summary page is under construction.</p>`

  **There is no "Upload file" button** on the placeholder — `unit-summary-placeholder.njk` extends `layouts/page.njk` directly, not `unit-type-page.njk`, so it inherits neither the heading row's button nor the `unitTypeBody` block. That is the clearest signal distinguishing a placeholder page from a real one.

  **Left navigation** — identical construction to the other unit-type pages (`buildUnitTypeNavigation`), with **Watercourses** as the current item. Area habitats renders collapsed. The Watercourses nav item is conditional on `projectHasHabitatData(project, 'watercourses')`, while the route is not — so on a direct URL to a project with no watercourse data the page still renders and no nav item is marked current.

- **Validation:** `id` path param must be a valid uuidv4 (Joi); invalid → Hapi 400
- **On success:** Renders `common/templates/unit-summary-placeholder` with page title "Watercourses - {serviceName}"
- **On error:** As [`area-summary.flow.md`](area-summary.flow.md) Step 1 — no-baseline redirect, 404, 502, session-expired

---

### Step 2 — Redirect a project with no baseline to the task list `[IMPLEMENTED]`

- **Route:** `GET /projects/{id}/watercourses-summary` (the guard branch)
- **Template:** None (302)
- **Auth required:** Yes — as Step 1
- **Backend endpoint:** `GET /projects/{id}`
- **Description:** `hasBaselineData(project)` false → redirect. The guard runs **before** the placeholder renders, so it is genuinely exercised despite the page having no content of its own.
- **Validation:** As Step 1
- **On success:** 302 to `/add-project-details/{id}`
- **On error:** As Step 1

---

### Step 3 — Watercourse results and targets `[PLANNED]`

- **Route:** `GET /projects/{id}/watercourses-summary`
- **Template:** Unknown — presumably a `watercourses-summary/index.njk` extending `unit-type-page.njk`, mirroring hedgerows
- **Auth required:** Yes — as Step 1
- **Backend endpoint:** `GET /projects/{id}`
- **Description:** The unit summary and targets sections the placeholder stands in for. The backend already supplies everything needed — `watercoursesTotal`, `watercoursesNetUnitChange` and `watercoursesNetUnitChangePercentage` are all present on `project.baseline.units` / `project.postIntervention.units` and are already consumed by the project summary — so this is frontend-only work. Expect it to mirror [`hedgerows-summary.flow.md`](hedgerows-summary.flow.md) Step 1 exactly, including the BMD-897 post-intervention-only variant.
- **Validation:** Unknown
- **On success:** Unknown
- **On error:** Unknown

---

## Entry points

| From                                             | Href                                  | When                                       |
| ------------------------------------------------ | ------------------------------------- | ------------------------------------------ |
| Project summary nav                              | `/projects/{id}/watercourses-summary` | only when the project has watercourse data |
| Project summary — "Watercourses" section heading | `/projects/{id}/watercourses-summary` | only when the Watercourses section renders |
| Any unit-type page nav                           | `/projects/{id}/watercourses-summary` | same condition                             |

---

## Journey coverage

Added 2026-09-01 — `test/specs/project-management/watercourses-summary.spec.js` (2 tests, domain tag `@project-management`).

The placeholder is asserted **for what it is** rather than skipped, for the same reason `project-summary.spec.js` pins its deferred elements: when Step 3 ships, these fail immediately and are rewritten, instead of the placeholder quietly surviving behind a skip nobody revisits.

| Test                                          | Covers                                                                                                                                                                                                                                                           |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renders the placeholder, not a unit-type page | the "under construction" copy **and** the absence of the Upload file button, Results heading and Targets section — the structural tells that it extends `layouts/page.njk` rather than `unit-type-page.njk`. The copy alone could survive a half-built real page |
| Reachable from the project summary            | the nav, the current-item marking and the collapsed area section — the only genuinely finished parts of this route                                                                                                                                               |

No results or targets assertions exist, by design. Guard, auth, role and uuid validation are covered by the shared reasoning recorded in [`area-summary.flow.md`](area-summary.flow.md).

---

## Testing note

Assert the placeholder for what it is — the `<h1>`, the "under construction" sentence, the navigation state and the guard redirect. Do **not** write assertions for the results or targets tiles: they will need rewriting rather than un-skipping when Step 3 lands, and a skipped placeholder test is easy to overlook. When the real page ships, this doc's Step 1 and Step 3 merge into one.
