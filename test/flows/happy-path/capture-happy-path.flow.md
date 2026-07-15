# Capture Happy Path User Flow (screenshot export)

## Overview

A local-only capture of the end-to-end **happy path** of the BNG Metric journey, producing index-numbered full-page PNGs of every screen a successful user sees, in journey order. UCD re-assembles the images into a Mural UI flow.

This is not a regression test. It runs only via `playwright.screenshots.config.js` (`npm run screenshots`) and is excluded from `test:local` / `test:github` / `test:e2e` by the main config's `testIgnore`. It has no `.flow.js` of its own — the spec (`test/screenshots/happy-path.screenshots.spec.js`) reuses the existing page objects and flow helpers.

## Steps

| #   | Screenshot                              | Screen                                                                                          | Status                                                                                      |
| --- | --------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 01  | `01-home.png`                           | Home page, signed out (`/`)                                                                     | [IMPLEMENTED]                                                                               |
| —   | _not captured_                          | Defra ID / Government Gateway sign-in (external IdP)                                            | [BLOCKED: external Azure B2C pages — the local stub's register screens are not the real UI] |
| 02  | `02-project-name.png`                   | Define project name, filled in (`/project-name`)                                                | [IMPLEMENTED]                                                                               |
| 03  | `03-manage-projects.png`                | Project dashboard listing the new project (`/manage-projects`)                                  | [IMPLEMENTED]                                                                               |
| 04  | `04-add-project-details.png`            | Project task list, initial statuses (`/add-project-details/{id}`)                               | [IMPLEMENTED]                                                                               |
| 05  | `05-upload-baseline-file.png`           | Upload baseline form with file chosen (`/projects/{id}/upload-baseline-file`)                   | [IMPLEMENTED]                                                                               |
| 06  | `06-checking-your-file.png`             | Upload processing page (`/projects/{id}/upload-received`)                                       | [IMPLEMENTED] — transient meta-refresh page; capture is best-effort                         |
| 07  | `07-baseline-habitat-list.png`          | On-site baseline habitats (`/projects/{id}/baseline-habitat-list`)                              | [IMPLEMENTED]                                                                               |
| 08  | `08-baseline-habitat-details.png`       | Baseline habitat details for the first area habitat (`/baseline-habitat-details`)               | [IMPLEMENTED]                                                                               |
| 09  | `09-upload-post-intervention-file.png`  | Upload post-intervention form with file chosen (`/projects/{id}/upload-post-intervention-file`) | [IMPLEMENTED]                                                                               |
| 10  | `10-post-intervention-habitat-list.png` | On-site post intervention habitats (`/projects/{id}/post-intervention-habitat-list`)            | [IMPLEMENTED]                                                                               |
| 11  | `11-add-project-details-complete.png`   | Project task list with Completed statuses (`/add-project-details/{id}`)                         | [IMPLEMENTED]                                                                               |
| —   | _not captured_                          | Project Details task                                                                            | [PLANNED] — route not yet implemented in frontend                                           |

## Fixtures

- Baseline upload: `Baseline - complete with area refs.gpkg`
- Post-intervention upload: `Post-intervention - complete.gpkg`

## How to run

1. Start the Docker Compose stack (frontend on `http://localhost:3000`, `cdp-uploader` pinned to `1.16.0` — see `compose.yml` note).
2. `npm run screenshots`
3. Output lands in `test/screenshots/output/happy-path/` (gitignored, cleared on each run).

Or invoke the `/capture-happy-path` slash command, which wraps these steps and first runs a **drift pre-flight**: it cross-checks the Steps table above against the current frontend routes (`../bng-metric-frontend/src/server/router.js`) and stops if the happy path has gained a screen this capture doesn't cover — so the export can't silently fall behind the build.

## Maintenance

When the happy path gains a screen (e.g. the Project Details task ships), add the step to `test/screenshots/happy-path.screenshots.spec.js` in journey order and update the table above before touching the spec.
