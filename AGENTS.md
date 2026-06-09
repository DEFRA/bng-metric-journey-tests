# AGENTS.md — BNG Metric Journey Tests

Read this file at the start of every session. It is the single source of truth for how to work in this repo.

---

## Project Overview

End-to-end regression suite for the **Biodiversity Net Gain Metric Tool** — a GOV.UK service that lets land developers calculate ecological impact and required habitat enhancements for planning applications.

The suite runs on DEFRA's CDP Portal. Tests are packaged in a Docker image and run against deployed service environments on the platform.

**Sibling repos (must be cloned as siblings of this directory):**

- `../bng-metric-frontend` — Hapi.js frontend on port 3000, GOV.UK Frontend + Nunjucks
- `../bng-metric-backend` — Hapi.js API on port 3001, PostgreSQL + Drizzle ORM; integration tests live in `integration-tests/`
- `../bng-metric-harness` — test fixtures; `example-files/` contains 26 GeoPackage (`.gpkg`) files for file upload journeys (valid baseline, valid post-intervention, validation-error variants, and an invalid-format file). Before writing a test that requires a file upload, copy the relevant file into `test/example-files/` in this repo so it is available for repeated local and CI runs. Ask the user which file to use if the scenario is ambiguous.

---

## Session-Start Routine

1. Read `test/flows/README.md` and the relevant journey flow file(s).
2. Cross-reference against `../bng-metric-frontend/src` routes and templates to check for drift.
3. Check `feature-input.md` — if a feature is described there, run `/validate-ac-automated` to evaluate AC coverage, or `/discover-journey-tests <flow>` to analyse the full flow coverage before writing any test code.
4. Flag any route that is `[PLANNED]` or `[BLOCKED]` in a flow file but now appears implemented in source.

---

## Slash Commands

| Command                                    | What it does                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `/analyse-user-flow <flow-name>`           | Reads frontend and backend source for the named flow; creates or updates `test/flows/<flow-name>.flow.md`                            |
| `/discover-journey-tests <flow-name>`      | Analyses journey test coverage for the named flow; recommends new tests or enhancements including edge cases                         |
| `/validate-ac-automated`                   | Checks whether ACs in `feature-input.md` are covered by existing journey tests; recommends gaps to close                             |
| `/validate-ac-manual`                      | Runs ACs from `feature-input.md` in a headless browser; captures screenshot evidence and produces a pass/fail report                 |
| `/verify-integration-coverage <flow-name>` | Analyses backend integration test coverage for the named flow; recommends enhancements in `../bng-metric-backend/integration-tests/` |
| `/triage-failure <failure-log>`            | Investigates a failing journey test — checks the related flow doc for drift before diagnosing and proposing a fix                    |

**Ownership boundaries:**

- `/analyse-user-flow` writes to `test/flows/` only — no test code.
- `/discover-journey-tests`, `/validate-ac-automated` write to `test/` only, after approval.
- `/validate-ac-manual` writes to `test/evidence/` only (temp spec + screenshots).
- `/verify-integration-coverage` is the **only** command that may write to sibling repos (`../bng-metric-backend/integration-tests/`). It must not touch `../bng-metric-frontend/`.

---

## Test Architecture

```
test/
  specs/      ← test orchestration and assertions only
  pages/      ← Page Objects (UI interaction, no business logic)
  flows/      ← multi-step user journeys spanning multiple pages
  fixtures/   ← test.extend() DI — always import test/expect from here
  utils/      ← pure helpers (env vars, data builders)
  evidence/   ← AC manual validation evidence (screenshots + tmp spec); not committed
```

**Strict layering:**

- Specs import from `@fixtures`, `@flows/*`, and `@pages/*` only.
- Page Objects receive a `page` object in the constructor; they hold locators and single-page interactions.
- Flows encapsulate cross-page user journeys and may use multiple page objects.
- Fixtures (`test/fixtures/index.js`) wire up DI with `test.extend()`.

Always import `test` and `expect` from `@fixtures`, never directly from `@playwright/test`.

---

## Spec File Organisation

Each domain in `test/specs/<domain>/` follows a **one file per page/route** pattern, plus one thin flow file for the end-to-end happy path.

### File naming

| File                   | Covers                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `<route-name>.spec.js` | All tests for a single page/route (e.g. `project-dashboard.spec.js` for `/project-dashboard`) |
| `<flow-name>.spec.js`  | The end-to-end happy path that spans multiple pages (e.g. `create-project.spec.js`)           |
| `header.spec.js`       | Shared header/navigation — one file per domain, tested once                                   |
| `footer.spec.js`       | Shared footer — one file per domain, tested once                                              |

### What each page spec covers

A page spec should contain a describe block for each of these concerns that applies to the route. Not every block is needed for every route — include only what is relevant.

| Describe block                 | What to assert                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------- |
| `— form display`               | Page title, input fields, hint text, back link, submit button                   |
| `— validation`                 | One test per validation rule; `@smoke` on the empty/required case only          |
| `— happy path`                 | Successful submission outcome (redirect, updated data)                          |
| `— back link`                  | Back link target URL                                                            |
| `— role enforcement`           | Authenticated user without required role is redirected to `/auth/forbidden`     |
| `— unauthenticated access`     | Unauthenticated `GET` redirects to sign-in; `@smoke` on the most critical route |
| `— route parameter validation` | Non-UUID path param returns 400                                                 |
| `— error state`                | Edge cases such as unknown UUID hiding page content                             |

### Flow spec

The flow spec (e.g. `create-project.spec.js`) covers only the **end-to-end happy path** — the minimal sequence of steps that spans multiple pages and confirms the full journey produces the right outcome. It does not repeat page-level assertions that belong in the individual page specs.

### Example structure for a new flow

```
test/specs/my-domain/
  my-flow.spec.js              ← E2E happy path only
  first-page.spec.js           ← all tests for /first-page
  second-page.spec.js          ← all tests for /second-page/{id}
  header.spec.js               ← shared header (if not already covered)
  footer.spec.js               ← shared footer (if not already covered)
```

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
2. Run `/discover-journey-tests <flow>` or `/validate-ac-automated` to produce a coverage-gap analysis. Read `test/specs/` for existing journey test coverage. Recommend Write E2E / Enhance per AC.
3. Wait for gap analysis approval.
4. Update the relevant flow file (`test/flows/<journey>.flow.md`) with status markers before touching test code.

Then:

1. Add or update the Page Object in `test/pages/` for any new UI interactions.
2. Add or update the Flow in `test/flows/<domain>/` if the test spans multiple pages.
3. Add the fixture to `test/fixtures/index.js` if a new page object needs DI.
4. Write the spec in `test/specs/<domain>/`.
5. Run `npm run test:local` to confirm the test passes locally.
6. Run `npm run lint` and `npm run format:check`.

---

## Run Modes and e2e Skip Pattern

Tests run in three modes controlled by `RUN_MODE` (exported from `test/utils/env.js`):

- `local` — against a locally running frontend on `localhost:3000` (stub auth)
- `github` — against the Docker Compose stack, CI (stub auth)
- `e2e` — against a deployed CDP environment (real Defra ID auth)

**Authentication by mode.** In `local`/`github` the `cdp-defra-id-stub` mints all three user profiles. In `e2e` the suite signs in through the **real Defra ID / Government Gateway** flow (`test/setup/auth.setup.js` → `DefraIdLoginFlow`) and saves the session for the **completer** profile only. That single account cannot reproduce the `no-role` or `no-projects` profiles, so describes using those two still skip in e2e; describes using the main completer `STORAGE_STATE` now **run** in e2e.

`e2e` mode requires `DEFRA_ID_USERNAME` and `DEFRA_ID_PASSWORD` (gitignored `.env` locally, CDP Portal secret store in CI) — see `.env.example`.

Pattern for every `describe` block that uses `storageState` — pass the profile it uses to `skipInE2e`:

```js
import { STORAGE_STATE, NO_ROLE_STORAGE_STATE, skipInE2e } from '@utils/env.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

// completer profile → runs in e2e (skipInE2e returns false)
test.describe('Feature — some describe', () => {
  test.use({ storageState: STORAGE_STATE })
  test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
  // ...
})

// no-role / no-projects profile → still skips in e2e (stub only)
test.describe('Feature — role enforcement', () => {
  test.use({ storageState: NO_ROLE_STORAGE_STATE })
  test.skip(skipInE2e(NO_ROLE_STORAGE_STATE), E2E_SKIP_REASON)
})
```

`skipInE2e(profile)` returns `true` only in e2e mode for a non-completer profile. Unauthenticated describes (no `storageState`) must **not** receive `test.skip`.

**Expected skipped counts differ by mode — this is by design.** A clean run skips more tests on CDP (e2e) than locally:

- **local / github (stub): ~7 skipped** — unconditional placeholders for features not yet built or not mockable at the browser layer (`test.skip('…', …)` / `test.skip(true, …)`): the `Show map` button, the `Continue` task-list navigation, the area/watercourse totals rows + km-suffix formatting, the unregistered `Project Details` route, and the server-side backend-error (≥ 400) path.
- **e2e (CDP): ~17 skipped** — those same ~7 placeholders **plus the ~10 `no-role` (role-enforcement → `/auth/forbidden`) and `no-projects` (empty-state) tests.** The stub mints those profiles so they run locally/github, but the single real Defra ID account can't reproduce a no-role user or a guaranteed-empty account, so `skipInE2e()` skips them on CDP.

So the extra CDP skips are exactly the role-enforcement + empty-state describes. (Counts are indicative — they shift as placeholders are implemented or tests are added.)

---

## Test Tagging

Use Playwright's `{ tag }` annotation to attach tags to individual tests or entire describe blocks. Tags are separate from the test title — names stay descriptive, tags are metadata.

```js
// Single test
test('form renders pre-populated with existing project name', { tag: '@smoke' }, async () => {})

// Entire describe (all tests inside inherit the tag)
test.describe('Create project — happy path', { tag: '@smoke' }, () => { ... })

// Multiple tags on one test
test('uploads a metric file', { tag: ['@smoke', '@upload-file'] }, async () => {})
```

Run by tag against any stack:

```sh
PROFILE=@smoke npm run test:local     # local services
PROFILE=@smoke npm run test:github    # Docker Compose stack
PROFILE=@smoke npm run test:e2e       # CDP portal
PROFILE=@upload-file npm run test:github
```

`PROFILE` is applied as `grep: new RegExp(PROFILE)` in `playwright.config.js`. Playwright includes tag annotations in the full title when matching grep, so `{ tag: '@smoke' }` is matched by `PROFILE=@smoke` exactly as a title-embedded `@smoke` would be.

### @smoke — what to tag

Tag `@smoke` when a test is:

- The **happy path** for a feature (core user journey, end-to-end)
- The **key unauthenticated redirect** for a protected route (verifies auth is wired up in deployed env)
- The **key role-enforcement redirect** for an access-controlled route (verifies RBAC boundary)
- **One representative validation error** per form (e.g. empty input) — not every variant

Do **not** tag `@smoke`:

- Exhaustive validation variants (whitespace, max length, control characters)
- Sort order / ordering tests
- Error states and edge cases
- Route parameter validation (400 on non-UUID)

### @regression — what to tag

Tag `@regression` on any test that is **not** tagged `@smoke`. Every test must carry exactly one of `@smoke` or `@regression` — never neither.

The `@regression` set is the mirror of `@smoke`: it covers everything excluded from smoke:

- Exhaustive validation variants (whitespace, max length, control characters)
- Sort order / ordering tests
- Error states and edge cases (error pages, 404/400 responses)
- Route parameter validation (400 on non-UUID)
- Back-link navigation tests
- Page content tests beyond the minimal happy-path assertion

Apply the tag at the **describe block level** when all tests inside are non-smoke. Apply it at the **individual test level** when a describe block contains a mix of `@smoke` and `@regression` tests.

```sh
PROFILE=@regression npm run test:github   # Run all non-smoke tests
```

### @\<domain\> — what to tag

Every spec file belongs to exactly one **user-flow domain** (e.g. `project-management`). Tag all tests in the file with the domain name using a named outer `test.describe` with a `tag` option:

```js
// Wraps the entire file — all inner describes and tests inherit the tag
test.describe('project-management', { tag: '@project-management' }, () => {
  test.describe('Project dashboard — page content', () => {
    test('...', async () => { ... })
  })

  test.describe('Project dashboard — unauthenticated access', () => {
    test('...', async () => { ... })
  })
})
```

The title `'project-management'` appears as a prefix in test names in reports (e.g. `project-management › Project dashboard — page content › ...`), which makes domain context visible without any extra markup.

> **Note:** do not use the anonymous form `test.describe({ tag }, fn)` — Playwright treats the options object as the title (serialising it as `[object Object]`) and the tag is not propagated to child tests for `grep` filtering.

Rules:

- **One domain tag per file.** The outer named describe carries it; do not repeat it on individual tests or inner describes.
- **Module-level helpers** (e.g. `setupProject`) live outside the outer describe at the top of the module — they are not tests.
- **The domain tag matches the spec folder name** under `test/specs/` (e.g. files in `test/specs/project-management/` all use `@project-management`).
- This lets you run all tests for a domain without knowing individual file names:

**Mandatory: every test must have all three tag dimensions:**

| Dimension                 | Rule                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| `@<domain>`               | Inherited from the outer named describe — do not omit the outer wrapper                           |
| `@smoke` or `@regression` | Every test carries exactly one — `@smoke` if it meets the smoke criteria, `@regression` otherwise |

When adding a new spec file or describe block, verify both dimensions are present before committing.

```sh
PROFILE=@project-management npm run test:github
```

---

## Run Commands

| Command                                           | What it does                                                                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:local`                              | Playwright against locally-running frontend (http://localhost:3000)                                                           |
| `npm run test:github`                             | Playwright against Docker Compose stack (used in CI)                                                                          |
| `npm run test:e2e`                                | Playwright against CDP deployed env (real Defra ID) — set `ENVIRONMENT=dev\|test` and `DEFRA_ID_USERNAME`/`DEFRA_ID_PASSWORD` |
| `HEADED=true npm run test:local`                  | Headed browser for debugging                                                                                                  |
| `BROWSER=firefox npm run test:local`              | Override browser                                                                                                              |
| `PROFILE=@smoke npm run test:github`              | Run only `@smoke`-tagged tests against Docker Compose stack                                                                   |
| `PROFILE=@smoke npm run test:e2e`                 | Run only `@smoke`-tagged tests on the CDP portal                                                                              |
| `PROFILE=@regression npm run test:github`         | Run only `@regression`-tagged (non-smoke) tests                                                                               |
| `PROFILE=@habitat-list npm run test:github`       | Run tests for the `habitat-list` domain                                                                                       |
| `PROFILE=@project-management npm run test:github` | Run tests for the `project-management` domain                                                                                 |

---

## CI / CDP Platform

- Tests are Dockerised and published to DEFRA Dockerhub on merge to `main`.
- The CDP Portal runs the latest published image. Confirm the build is green in GitHub Actions before triggering a Portal run.
- No proxy configuration needed — Playwright connects directly to the deployed service URL.
- Report: Playwright HTML reporter writes `playwright-report/index.html`. `bin/publish-tests.sh` uploads this to S3. The CDP Portal renders the `index.html` entry point.
- `PROFILE` env var filters tests by tag (e.g. `PROFILE=@smoke`). Uses Playwright `{ tag }` annotations — see **Test Tagging** above.
- The **Run Journey Tests** GitHub workflow accepts an optional `profile` input (`@smoke`, `@project-management`, etc.). Leave it blank to run all tests.

---

## What NOT to Do

- No `waitForTimeout` or `page.waitForTimeout`.
- No CSS selectors (`$('.foo')`, `locator('.foo')`) or XPath.
- No test logic in Page Objects (assertions belong in the spec or a dedicated `assert*` method).
- No multi-page workflows in Page Objects — that belongs in Flows.
- Do not import from `@playwright/test` directly in specs — always use `@fixtures`.
- Do not write test code before coverage-gap analysis is approved.
- Do not read or modify `../bng-metric-backend/` or `../bng-metric-frontend/` except via `/verify-integration-coverage` (backend integration tests only).
