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

Each flow has two files:

| File                                | Purpose                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `test/flows/<journey-name>.flow.md` | Living doc — step-by-step description with status markers; updated by `/analyse-user-flow` |
| `test/flows/<journey-name>.flow.js` | JavaScript flow class — orchestrates page objects for that journey                         |

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
// test/flows/create-project.flow.js
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

| Journey                               | Flow doc | Flow class | Status      |
| ------------------------------------- | -------- | ---------- | ----------- |
| _(TBC — first journey not yet ready)_ | —        | —          | `[PLANNED]` |
