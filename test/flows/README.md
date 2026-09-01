# Flows

Flows encapsulate **multi-step user journeys** that span more than one page. They sit between specs and page objects in the layering hierarchy.

## What belongs here

- A sequence of page interactions that constitutes a complete or partial user journey (e.g. "start a project", "upload a baseline file", "sign in and reach the dashboard").
- Any logic that orchestrates page objects in sequence.
- Helper assertions that validate the state of a journey at a checkpoint.

## What does NOT belong here

- Single-page interactions (those belong in the page object).
- Test assertions that are specific to a single test case (those belong in the spec).
- Direct Playwright `page.*` calls — use page object methods instead.

## File naming

Most flows have two files; some add an optional third:

| File                                         | Purpose                                                                                               |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `test/flows/<domain>/<journey-name>.flow.md` | Living doc — step-by-step description with status markers; updated by `/analyse-user-flow`            |
| `test/flows/<domain>/<journey-name>.flow.js` | JavaScript flow class — orchestrates page objects for that journey                                    |
| `test/flows/<domain>/<journey-name>.ac.md`   | AC-coverage matrix (optional companion) — maps acceptance criteria to specs; not consumed by commands |

## Keeping flow docs up to date

After pulling the latest changes to `../bng-metric-frontend` or `../bng-metric-backend`, run:

```
/analyse-user-flow <flow-name>
```

This reads the current source and updates (or creates) the `.flow.md` file with accurate `[IMPLEMENTED]`, `[PLANNED]`, and `[BLOCKED]` markers. The `.flow.md` is the contract used by `/discover-journey-tests` and `/verify-integration-coverage` — keep it current.

## Status markers (journey flow docs)

When documenting a journey's steps, use these markers in the flow doc:

| Marker              | Meaning                                             |
| ------------------- | --------------------------------------------------- |
| `[IMPLEMENTED]`     | Route/feature live in frontend; test can be written |
| `[BLOCKED: reason]` | Feature in frontend but E2E blocked — reason stated |
| `[PLANNED]`         | Not yet implemented in frontend                     |

**Maintenance rule:** Update the marker in the flow doc _before_ touching test code.

---

## Example flow doc skeleton

```markdown
# Create Project User Flow

## Overview

The user creates a new project by entering a project name. On success they are returned to the project dashboard where the new project appears.

## Steps

### Step 1 — View project name form `[IMPLEMENTED]`

- **Route:** `GET /define-project-name`
- **Template:** `src/server/define-project-name/index.njk`
- **Auth required:** Yes
- **Backend endpoint:** None
- **Description:** User navigates to the form to enter a new project name.
- **Validation:** None (display-only)
- **On success:** Renders the form
- **On error:** N/A

### Step 2 — Submit project name `[IMPLEMENTED]`

- **Route:** `POST /define-project-name`
- **Template:** `src/server/define-project-name/index.njk`
- **Auth required:** Yes
- **Backend endpoint:** `POST /projects/new`
- **Description:** User submits the project name form.
- **Validation:** Project name required; max 1,000 characters; no control characters or Unicode surrogates
- **On success:** Redirects to `/project-dashboard`
- **On error:** Re-renders form with GOV.UK error summary and inline field error
```

---

## Example flow class skeleton

```javascript
// test/flows/project-management/create-project.flow.js
import { DefineProjectNamePage } from '@pages/define-project-name.page.js'

export class CreateProjectFlow {
  constructor(page) {
    this.page = page
    this.defineProjectNamePage = new DefineProjectNamePage(page)
  }

  async createProject(name) {
    await this.defineProjectNamePage.open()
    await this.defineProjectNamePage.enterProjectName(name)
    await this.defineProjectNamePage.submit()
  }
}
```

---

## Journey Status

| Journey                                                  | Flow doc                                                         | Flow class                                                       | Status           |
| -------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------- |
| project-management / create-project                      | `project-management/create-project.flow.md`                      | `project-management/create-project.flow.js`                      | `[IMPLEMENTED]`  |
| project-management / project-dashboard                   | `project-management/project-dashboard.flow.md`                   | —                                                                | `[IMPLEMENTED]`  |
| project-management / change-project-name                 | `project-management/change-project-name.flow.md`                 | —                                                                | `[IMPLEMENTED]`  |
| project-management / project-details                     | `project-management/project-details.flow.md`                     | —                                                                | `[IMPLEMENTED]`  |
| project-management / project-summary                     | `project-management/project-summary.flow.md`                     | —                                                                | `[IMPLEMENTED]`§ |
| project-management / area-summary                        | `project-management/area-summary.flow.md`                        | —                                                                | `[IMPLEMENTED]`¶ |
| project-management / area-baseline                       | `project-management/area-baseline.flow.md`                       | —                                                                | `[IMPLEMENTED]`¶ |
| project-management / hedgerows-summary                   | `project-management/hedgerows-summary.flow.md`                   | —                                                                | `[IMPLEMENTED]`¶ |
| project-management / watercourses-summary                | `project-management/watercourses-summary.flow.md`                | —                                                                | `[IMPLEMENTED]`¶ |
| authentication / defra-id-login                          | `authentication/defra-id-login.flow.md`                          | `authentication/defra-id-login.flow.js`                          | `[IMPLEMENTED]`  |
| authentication / sign-out                                | `authentication/sign-out.flow.md`                                | —                                                                | `[IMPLEMENTED]`  |
| authentication / access-denied                           | `authentication/access-denied.flow.md`                           | —                                                                | `[IMPLEMENTED]`  |
| authentication / session-expired                         | `authentication/session-expired.flow.md`                         | —                                                                | `[IMPLEMENTED]`* |
| upload-file / choose-upload-type                         | `upload-file/choose-upload-type.flow.md`                         | —                                                                | `[IMPLEMENTED]`‡ |
| upload-baseline / upload-baseline-file                   | `upload-baseline/upload-baseline-file.flow.md`                   | `upload-baseline/upload-baseline-file.flow.js`                   | `[IMPLEMENTED]`  |
| upload-post-intervention / upload-post-intervention-file | `upload-post-intervention/upload-post-intervention-file.flow.md` | `upload-post-intervention/upload-post-intervention-file.flow.js` | `[IMPLEMENTED]`  |
| habitat-list / habitat-list                              | `habitat-list/habitat-list.flow.md`                              | —                                                                | `[IMPLEMENTED]`  |
| habitat-list / baseline-habitat-details                  | `habitat-list/baseline-habitat-details.flow.md`                  | — (stub → habitat-details)                                       | `[IMPLEMENTED]`  |
| habitat-list / post-intervention-habitat-list            | `habitat-list/post-intervention-habitat-list.flow.md`            | —                                                                | `[IMPLEMENTED]`  |
| habitat-details / habitat-details                        | `habitat-details/habitat-details.flow.md`                        | —                                                                | `[IMPLEMENTED]`  |
| habitat-details / post-intervention-habitat-details      | `habitat-details/post-intervention-habitat-details.flow.md`      | —                                                                | `[IMPLEMENTED]`  |
| happy-path / capture-happy-path                          | `happy-path/capture-happy-path.flow.md`                          | — (screenshots spec)                                             | `[IMPLEMENTED]`† |

\* Session-expired's interactive redirect trigger is `[BLOCKED: shared server-side session]`; coverage is via the sign-out link `href` and the rendered signed-out page.
† Not a regression journey — a local-only UCD screenshot export run via `npm run screenshots` (`playwright.screenshots.config.js`), excluded from `test:local`/`test:github`/`test:e2e`.
§ Added by BMD-870 (frontend PR#219, 2026-08-14), extended by BMD-852 (PR#227, 2026-08-18). `GET /projects/{id}/project-summary` is the new landing page for **any project with a baseline** — reached from the dashboard row link and from a successful baseline upload, which no longer lands on `baseline-habitat-list`. BMD-852 added the post-intervention variant (backend-supplied net unit/percentage change, green `Met` tag at the 10% target) and widened the guard so a project with both documents renders here rather than redirecting to the task list. The ticket records it as replacing the task list ("to be deprecated in due course") and the habitat list's summary section. The area/hedgerow/watercourse drill-downs, trading rules and the project-details clickthrough are `[PLANNED]` (separate tickets). Covered by `test/specs/project-management/project-summary.spec.js` (domain tag `@project-management`); the backend-failure 502 path is an unconditional skip placeholder pending a fault-injection hook, and the both-documents guard redirect is asserted in `test/specs/upload-post-intervention/upload-post-intervention.spec.js`, which already pays for both uploads.

¶ The unit-type drill-down pages, added 2026-08-25 → 08-28 and documented by `/analyse-user-flow` on 2026-09-01. **BMD-854** (frontend PR#237) built the shared scaffolding — the `unit-type-page.njk` layout, the left-hand unit-type navigation, the `appTargetsSummary` macro and the placeholder controller — and turned the project summary's nav items and section headings into real links. **BMD-857** (PR#244) added `area-baseline`, the only baseline detail page and the only linked baseline tile. **BMD-855/BMD-919** (PR#249) built the real hedgerows page but **left `watercourses-summary` on the placeholder controller**, so the two linear unit types are not symmetrical — `/hedgerows-summary` renders results and targets, `/watercourses-summary` renders an "under construction" line. All four share one guard (`hasBaselineData` → 302 to `/add-project-details/{id}`) and one auth rule (session + approved `bng completer`). All four gained journey coverage on 2026-09-01 — `area-summary` (7 tests), `area-baseline` (4), `hedgerows-summary` (5) and `watercourses-summary` (2, asserting the placeholder for what it is). Their projects come from `@utils/summary-projects.js`, whose module-scope cache is shared across spec files in a worker, so all four specs together cost no upload beyond the ones `project-summary.spec.js` already paid for. The pages share `UnitTypeSummaryPage` (`test/pages/unit-type-summary.page.js`), so each spec asserts only what differs from the area summary. Note the shared `appUnitTypeSummary` macro renders its `<h2>` **only** when `headingHref` is supplied — the project summary supplies one, these pages do not, so a section locator keyed to the heading does not transfer between them.

‡ Added by BMD-850 (frontend PR#207, 2026-08-11). The `GET`/`POST /projects/{id}/upload-file` selection page is the shared entry point to **both** upload journeys — the task list and both habitat lists link here rather than to a type-specific upload form. Covered by `test/specs/upload-file/upload-file.spec.js` (domain tag `@upload-file`); the backend-failure 502 path is an unconditional skip placeholder pending a fault-injection hook.
