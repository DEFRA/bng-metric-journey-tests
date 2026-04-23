# BNG Metric Journey Tests

End-to-end regression suite for the [Biodiversity Net Gain Metric Tool](https://github.com/DEFRA/bng-metric-frontend).

Built with [Playwright Test](https://playwright.dev). Runs on DEFRA's CDP Portal.

---

## Prerequisites

- Node.js >= 22 (use `nvm use` to switch to the version in `.nvmrc`)
- Docker and Docker Compose (for full-stack local testing and CI mode)
- Sibling repos cloned alongside this one:
  - `../bng-metric-frontend`
  - `../bng-metric-backend`

---

## Quick start

```sh
npm install
npx playwright install --with-deps chromium   # one-time browser install
```

---

## Running tests

### Local — services already running

Start the frontend and backend on your machine using their own dev scripts, then:

```sh
npm run test:local
```

The frontend must be reachable at `http://localhost:3000` (its default).

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

## Adding tests

1. Fill in [feature-input.md](feature-input.md).
2. Tell the agent **"New feature input given"** — it will run a coverage-gap analysis.
3. Wait for analysis approval before writing test code.
4. Follow the checklist in [AGENTS.md](AGENTS.md#adding-a-new-test--checklist).

For step-by-step guidance on writing a page object, flow, or spec, see [`.ai/skills/ui-test/SKILL.md`](.ai/skills/ui-test/SKILL.md).

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

### Depends-On in PR descriptions

When raising a PR that depends on a specific frontend or backend branch, add `Depends-On` lines to the PR description:

```
Depends-On: DEFRA/bng-metric-frontend#feature/my-feature
Depends-On: DEFRA/bng-metric-backend#feature/my-api-change
```

The `journey-tests.yml` workflow parses these lines and checks out those branches automatically.

---

## Triggering from service repos

### What this is for

When a developer raises a PR in `bng-metric-frontend` or `bng-metric-backend`, you want confidence that their change doesn't break the end-to-end journeys — before it merges. This is done by having the service repo's own CI trigger the journey-test suite against the PR's Docker image, so the full stack is tested with the new code in place.

Without this, journey tests only run after a merge, which is too late.

### How it works

1. The service repo builds a Docker image from the PR branch and tags it with `github.sha`.
2. It calls the composite action at the root of this repo, passing that image tag as an input.
3. The action starts the Docker Compose stack, swapping in the PR image for that service while pulling the rest at `latest`.
4. Playwright runs against the live stack.

### Adding it to a service repo

In `bng-metric-frontend` or `bng-metric-backend`, add a workflow step after the Docker build:

```yaml
jobs:
  journey-tests:
    name: Run Journey Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build image
        run: docker build -t defradigital/bng-metric-frontend:${{ github.sha }} .

      - name: Run journey tests
        uses: DEFRA/bng-metric-journey-tests@main
        with:
          bng-metric-frontend-tag: ${{ github.sha }}
          # bng-metric-backend-tag defaults to latest — omit unless you need to pin it
```

For `bng-metric-backend`, swap the input:

```yaml
- name: Run journey tests
  uses: DEFRA/bng-metric-journey-tests@main
  with:
    bng-metric-backend-tag: ${{ github.sha }}
```

Alternatively, use the `run-journey-tests/` path if the service repo already references that:

```yaml
- uses: DEFRA/bng-metric-journey-tests/run-journey-tests@main
  with:
    bng-metric-frontend-tag: ${{ github.sha }}
```

Both call paths are supported and behave identically.

### When to trigger it

| Trigger               | Recommended approach                                                        |
| --------------------- | --------------------------------------------------------------------------- |
| On every PR           | Add as a required check in the service repo's branch protection rules       |
| After merge to `main` | Use `workflow_run` triggered by the service repo's `Publish` workflow       |
| Manually              | Dispatch `journey-tests.yml` from the Actions tab with the desired branches |

---

## CDP Portal

1. Confirm the latest build is green in GitHub Actions (Actions → Publish).
2. Log into the CDP Portal → Test Suites → **bng-metric-journey-tests**.
3. Select environment, optionally set `PROFILE` (e.g. `@smoke`), choose configuration, click **Run**.
4. Results and the HTML report are available from the run page.

**Proxy:** outbound HTTP uses `localhost:3128` — already configured in `playwright.config.js`.

**Timeout:** the Portal hard-kills runs at 2 hours. Keep the suite well under this.

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
