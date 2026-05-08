# BNG Metric Journey Tests

End-to-end regression suite for the [Biodiversity Net Gain Metric Tool](https://github.com/DEFRA/bng-metric-frontend).

Built with [Playwright Test](https://playwright.dev). Runs on DEFRA's CDP Portal.

---

## Prerequisites

- Node.js >= 22 (use `nvm use` to switch to the version in `.nvmrc`)
- Docker and Docker Compose (for full-stack local testing and CI mode)
- Sibling repos cloned alongside this one:
  - `../bng-metric-frontend`
  - `../bng-metric-backend` (integration tests live in `integration-tests/` there)

---

## Quick start

```sh
npm install
npx playwright install --with-deps chromium   # one-time browser install
```

---

## Running tests

### Local — services already running

Start the frontend and backend individually using their own dev scripts. The frontend must be reachable at `http://localhost:3000` before running:

```sh
npm run test:local
```

> **LocalStack:** not required for journeys that only hit the frontend (e.g. the home page smoke test). Required for journeys that involve file uploads, S3, SQS, or SNS — start it separately with `docker compose up localstack -d` if needed.

Override options:

```sh
HEADED=true npm run test:local          # headed browser (visible window)
BROWSER=firefox npm run test:local      # use Firefox or webkit
PROFILE=@smoke npm run test:local       # filter by tag
```

### Local — full stack via Docker Compose

Closest approximation of CI. LocalStack, Redis, MongoDB, frontend and backend all start automatically.

```sh
docker compose pull
docker compose up --wait -d
npm run test:github
```

To pin specific image versions:

```sh
BNG_METRIC_FRONTEND_TAG=abc123 BNG_METRIC_BACKEND_TAG=abc123 docker compose up --wait -d
npm run test:github
```

Playwright report opens at `playwright-report/index.html` after the run.

### CDP Platform (against deployed services)

```sh
ENVIRONMENT=dev npm run test:e2e
ENVIRONMENT=test npm run test:e2e
```

Triggered from the Portal: Log in → Test Suites → select this suite → select environment → set `PROFILE` if needed → choose configuration → Run. Portal returns pass/fail and a report link.

---

## Folder structure

```
test/
  specs/      — test files
  pages/      — Page Objects (UI interaction per page)
  flows/      — multi-step user journeys
  fixtures/   — test.extend() DI — always import test/expect from here
  utils/      — pure helpers (env vars, etc.)
```

Always import `test` and `expect` from `@fixtures`, not directly from `@playwright/test`.

See [AGENTS.md](AGENTS.md) and [`.ai/coding-rules.md`](.ai/coding-rules.md) for full conventions.

---

## Slash commands

Each command is independent — use whichever fits your current task.

| Command                               | When to use                                                                                                  | Requires                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `/analyse-user-flow <flow>`           | After pulling latest frontend or backend changes — syncs `test/flows/<flow>.flow.md` with the current source | Nothing pre-filled                                           |
| `/discover-user-journey <flow>`       | To find gaps in journey test coverage for a flow and discover edge cases                                     | An up-to-date flow doc in `test/flows/`                      |
| `/validate-ac-automated`              | To check whether specific ACs are covered by existing journey tests                                          | `feature-input.md` filled with ACs                           |
| `/validate-ac-manual`                 | To run ACs in a headless browser and capture screenshot evidence                                             | `feature-input.md` filled with ACs; frontend running locally |
| `/verify-integration-coverage <flow>` | To find gaps in backend integration test coverage for a flow                                                 | An up-to-date flow doc in `test/flows/`                      |

For step-by-step guidance on writing a page object, flow, or spec once a gap is identified, see [`.ai/skills/ui-test/SKILL.md`](.ai/skills/ui-test/SKILL.md) and the checklist in [AGENTS.md](AGENTS.md#adding-a-new-test--checklist).

---

## GitHub workflow — branch selection

Dispatch the `journey-tests.yml` workflow with branch inputs to test against non-default code:

```
GitHub → Actions → Run Journey Tests on GitHub → Run workflow
  Use workflow from: <select branch of journey-tests to run>
  frontend-branch: main  (or a feature branch)
  backend-branch: main   (or a feature branch)
  browser: chromium
```

---

## CDP Portal

1. Confirm the latest build is green in GitHub Actions (Actions → Publish).
2. Log into the CDP Portal → Test Suites → **bng-metric-journey-tests**.
3. Select environment, optionally set `PROFILE` (e.g. `@smoke`), choose configuration, click **Run**.
4. Results and the HTML report are available from the run page.

---

## Environment variables

| Variable      | Default     | Description                                     |
| ------------- | ----------- | ----------------------------------------------- |
| `RUN_MODE`    | `local`     | `local` / `github` / `e2e` — selects base URL   |
| `ENVIRONMENT` | `dev`       | CDP environment name (used when `RUN_MODE=e2e`) |
| `BASE_URL`    | _(derived)_ | Override the target URL directly                |
| `BROWSER`     | `chromium`  | `chromium` / `firefox` / `webkit`               |
| `HEADED`      | _(unset)_   | Set to `true` for headed browser                |
| `PROFILE`     | _(unset)_   | Playwright grep pattern, e.g. `@smoke`          |

---

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

> Contains public sector information licensed under the Open Government licence v3
