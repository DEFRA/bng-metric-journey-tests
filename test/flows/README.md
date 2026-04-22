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

One file per user journey: `tests/flows/<journey-name>.flow.js`

## Status markers (journey flow docs)

When documenting a journey's steps, use these markers in the flow doc:

| Marker              | Meaning                                             |
| ------------------- | --------------------------------------------------- |
| `[IMPLEMENTED]`     | Route/feature live in frontend; test can be written |
| `[BLOCKED: reason]` | Feature in frontend but E2E blocked — reason stated |
| `[PLANNED]`         | Not yet implemented in frontend                     |

**Maintenance rule:** Update the marker in the flow doc _before_ touching test code.

---

## Example skeleton

```javascript
// tests/flows/home.flow.js
import { HomePage } from '@pages/home.page.js'

export class HomeFlow {
  constructor(page) {
    this.page = page
    this.homePage = new HomePage(page)
  }

  async visitUnauthenticated() {
    await this.homePage.open()
    return this.homePage
  }
}
```

---

## Journey Status

| Journey                               | Flow file | Status      |
| ------------------------------------- | --------- | ----------- |
| _(TBC — first journey not yet ready)_ | —         | `[PLANNED]` |
