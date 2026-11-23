# Capture Happy Path User Flow (screenshot export)

## Overview

A local-only capture of the end-to-end **happy path** of the BNG Metric journey, producing index-numbered full-page PNGs of every screen a successful user sees, in journey order. UCD re-assembles the images into a Mural UI flow.

This is not a regression test. It runs only via `playwright.screenshots.config.js` (`npm run screenshots`) and is excluded from `test:local` / `test:github` / `test:e2e` by the main config's `testIgnore`. It has no `.flow.js` of its own — the spec (`test/screenshots/happy-path.screenshots.spec.js`) reuses the existing page objects and flow helpers.

## Steps

Re-sequenced on 2026-11-23 to close drift found by the `/capture-happy-path` pre-flight: the journey now chooses an upload type before **each** upload (the spec selects the type and submits, rather than opening the upload forms directly), captures the post-intervention processing page, and ends on Project Details. Screens from 10 onwards are renumbered; images from earlier exports do not line up one-to-one.

| #   | Screenshot                                    | Screen                                                                                                    | Status                                                                                      |
| --- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 01  | `01-home.png`                                 | Home page, signed out (`/`)                                                                               | [IMPLEMENTED]                                                                               |
| —   | _not captured_                                | Defra ID / GOV.UK One Login sign-in (external IdP)                                                        | [BLOCKED: external Azure B2C pages — the local stub's register screens are not the real UI] |
| 02  | `02-project-name.png`                         | Define project name, filled in (`/project-name`)                                                          | [IMPLEMENTED]                                                                               |
| 03  | `03-manage-projects.png`                      | Project dashboard listing the new project (`/manage-projects`)                                            | [IMPLEMENTED]                                                                               |
| 04  | `04-upload-file.png`                          | Choose upload type, reached by opening the new project (`/projects/{id}/upload-file`); Baseline is chosen | [IMPLEMENTED] — BMD-1076 redirects a no-baseline summary here                               |
| 05  | `05-upload-baseline-file.png`                 | Upload baseline form with file chosen (`/projects/{id}/upload-baseline-file`)                             | [IMPLEMENTED]                                                                               |
| 06  | `06-checking-your-file.png`                   | Baseline upload processing page (`/projects/{id}/upload-received`)                                        | [IMPLEMENTED] — transient meta-refresh page; capture is best-effort                         |
| 07  | `07-project-summary-baseline.png`             | Project summary with baseline results (`/projects/{id}/project-summary`)                                  | [IMPLEMENTED]                                                                               |
| 08  | `08-area-baseline.png`                        | Baseline for area habitats (`/projects/{id}/area-baseline`)                                               | [IMPLEMENTED]                                                                               |
| 09  | `09-baseline-habitat-details.png`             | Baseline habitat details for the first area habitat (`/baseline-habitat-details`)                         | [IMPLEMENTED]                                                                               |
| 10  | `10-upload-file-post-intervention.png`        | Choose upload type with Post-intervention selected, from the summary's Upload file button                 | [IMPLEMENTED]                                                                               |
| 11  | `11-upload-post-intervention-file.png`        | Upload post-intervention form with file chosen (`/projects/{id}/upload-post-intervention-file`)           | [IMPLEMENTED]                                                                               |
| 12  | `12-checking-your-file-post-intervention.png` | Post-intervention upload processing page (`/projects/{id}/post-intervention-upload-received`)             | [IMPLEMENTED] — transient meta-refresh page; capture is best-effort                         |
| 13  | `13-project-summary-complete.png`             | Project summary with post-intervention results (`/projects/{id}/project-summary`)                         | [IMPLEMENTED]                                                                               |
| 14  | `14-area-post-intervention.png`               | Post intervention for area habitats (`/projects/{id}/area-post-intervention`)                             | [IMPLEMENTED]                                                                               |
| 15  | `15-project-details.png`                      | Project Details form, from the left navigation (`/project-details/{projectId}`)                           | [IMPLEMENTED] — linked from the left navigation since BMD-849                               |

A best-effort capture that misses its transient page leaves a gap at its index; later screens keep their numbers.

## Fixtures

- Baseline upload: `Baseline - complete with area refs.gpkg`
- Post-intervention upload: `Post-intervention - complete.gpkg`

## How to run

1. Start the Docker Compose stack (frontend on `http://localhost:3000`, `cdp-uploader` pinned to `1.16.0` — see `compose.yml` note).
2. `npm run screenshots`
3. Output lands in `test/screenshots/output/happy-path/` (gitignored, cleared on each run).

Or invoke the `/capture-happy-path` slash command, which wraps these steps and first runs a **drift pre-flight**: it cross-checks the Steps table above against the current frontend routes (`../bng-metric-frontend/src/server/router.js`) and stops if the happy path has gained a screen this capture doesn't cover — so the export can't silently fall behind the build.

## Maintenance

When the happy path gains a screen, add the step to `test/screenshots/happy-path.screenshots.spec.js` in journey order and update the table above before touching the spec.
