# AGENTS.md — BNG Metric Journey Tests

Read this file at the start of every session. It is the single source of truth for how to work in this repo.

---

## Project Overview

End-to-end regression suite for the **Biodiversity Net Gain Metric Tool** — a GOV.UK service that lets land developers calculate ecological impact and required habitat enhancements for planning applications.

The suite runs on DEFRA's CDP Portal. Tests are packaged in a Docker image and run against deployed service environments on the platform.

**Sibling repos (must be cloned as siblings of this directory):**

- `../bng-metric-frontend` — Hapi.js frontend on port 3000, GOV.UK Frontend + Nunjucks
- `../bng-metric-backend` — Hapi.js API on port 3001, PostgreSQL + Drizzle ORM
- `../bng-metric-harness` — meta-repo that orchestrates frontend + backend; owns integration tests in `tests/`

---

## Session-Start Routine

1. Read `test/flows/README.md` and the relevant journey flow file(s).
2. Cross-reference against `../bng-metric-frontend/src` routes and templates to check for drift.
3. Check `feature-input.md` — if a feature is described there, run `/new-feature` (or follow the same steps manually) before writing any test code. The full sequence is in `.claude/commands/new-feature.md`.
4. Flag any route that is `[PLANNED]` or `[BLOCKED]` in a flow file but now appears implemented in source.

---

## Test Architecture

```
test/
  specs/      ← test orchestration and assertions only
  pages/      ← Page Objects (UI interaction, no business logic)
  flows/      ← multi-step user journeys spanning multiple pages
  fixtures/   ← test.extend() DI — always import test/expect from here
  utils/      ← pure helpers (env vars, data builders)
```

**Strict layering:**

- Specs import from `@fixtures`, `@flows/*`, and `@pages/*` only.
- Page Objects receive a `page` object in the constructor; they hold locators and single-page interactions.
- Flows encapsulate cross-page user journeys and may use multiple page objects.
- Fixtures (`test/fixtures/index.js`) wire up DI with `test.extend()`.

Always import `test` and `expect` from `@fixtures`, never directly from `@playwright/test`.

---

## Selectors — Priority Order

1. `page.getByRole(...)` — ARIA role + accessible name
2. `page.getByLabel(...)` — form field label text
3. `page.getByTestId(...)` — `data-testid` attribute (GOV.UK components use these)
4. `page.getByText(...)` — visible text, last resort for non-interactive elements

**Never** use CSS selectors or XPath.

---

## Assertions

- Always use Playwright web-first assertions: `await expect(locator).toBeVisible()`, `await expect(page).toHaveTitle(...)`, etc.
- No `waitForTimeout`. Rely on auto-waiting.
- Reusable assertions belong in Page Objects or Flows (e.g. `await homePage.assertSignInVisible()`).
- Spec-level assertions are fine for test-specific checks.

---

## Adding a New Test — Checklist

Before writing any test code:

1. Check `feature-input.md` describes the feature with ACs.
2. Run coverage-gap analysis: read `../bng-metric-harness/tests/` integration tests (frontend and backend coverage lives there). Recommend Write E2E / Descope / Enhance per AC.
3. Wait for gap analysis approval.
4. Update the relevant flow file (`test/flows/<journey>.flow.md`) with status markers before touching test code.

Then:

1. Add or update the Page Object in `test/pages/` for any new UI interactions.
2. Add or update the Flow in `test/flows/` if the test spans multiple pages.
3. Add the fixture to `test/fixtures/index.js` if a new page object needs DI.
4. Write the spec in `test/specs/`.
5. Run `npm run test:local` to confirm the test passes locally.
6. Run `npm run lint` and `npm run format:check`.

---

## Run Commands

| Command                              | What it does                                                        |
| ------------------------------------ | ------------------------------------------------------------------- |
| `npm run test:local`                 | Playwright against locally-running frontend (http://localhost:3000) |
| `npm run test:github`                | Playwright against Docker Compose stack (used in CI)                |
| `npm run test:e2e`                   | Playwright against CDP deployed env — set `ENVIRONMENT=dev\|test`   |
| `HEADED=true npm run test:local`     | Headed browser for debugging                                        |
| `BROWSER=firefox npm run test:local` | Override browser                                                    |
| `PROFILE=@smoke npm run test:e2e`    | Run only tests tagged `@smoke`                                      |

---

## CI / CDP Platform

- Tests are Dockerised and published to DEFRA Dockerhub on merge to `main`.
- The CDP Portal runs the latest published image. Confirm the build is green in GitHub Actions before triggering a Portal run.
- No proxy configuration needed — Playwright connects directly to the deployed service URL.
- Report: Playwright HTML reporter writes `playwright-report/index.html`. `bin/publish-tests.sh` uploads this to S3. The CDP Portal renders the `index.html` entry point.
- `PROFILE` env var filters tests by grep pattern (e.g. `PROFILE=@smoke`).

---

## What NOT to Do

- No `waitForTimeout` or `page.waitForTimeout`.
- No CSS selectors (`$('.foo')`, `locator('.foo')`) or XPath.
- No test logic in Page Objects (assertions belong in the spec or a dedicated `assert*` method).
- No multi-page workflows in Page Objects — that belongs in Flows.
- Do not import from `@playwright/test` directly in specs — always use `@fixtures`.
- Do not write test code before coverage-gap analysis is approved.
