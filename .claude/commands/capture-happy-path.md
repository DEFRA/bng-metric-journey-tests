---
description: Capture ordered full-page PNGs of the BNG Metric happy-path journey for UCD to assemble into a Mural UI flow. Runs a drift pre-flight against the frontend routes first. Local-only.
---

A happy-path screenshot capture has been requested. The capture is implemented as a local-only Playwright spec — do **not** write a new spec; run the existing one.

Reference docs:

- `test/flows/happy-path/capture-happy-path.flow.md` — the screen list and journey order (the contract for what gets captured)
- `test/screenshots/happy-path.screenshots.spec.js` — the capture spec
- `playwright.screenshots.config.js` — the dedicated config (`npm run screenshots`)

## Pre-flight — drift check

The spec is a hard-coded linear journey: it cannot discover screens it doesn't know about, so a journey that gained a screen would otherwise produce a silently incomplete export. Before running the capture:

1. Ask the user to confirm they have pulled the latest `main` of `../bng-metric-frontend` and the latest service images (`docker compose pull` for `bng-metric-frontend`/`bng-metric-backend` only — never a plain full-stack pull, the pinned `cdp-uploader:1.16.0` must not be replaced by `latest`). Do not proceed until confirmed.
2. Read `../bng-metric-frontend/src/server/router.js` in full and identify the routes a successful user traverses on the happy path (home → create project → task list → upload baseline → habitat list → habitat details → upload post-intervention → post-intervention habitat list). Source only — no test files.
3. Compare against the Steps table in `test/flows/happy-path/capture-happy-path.flow.md`:
   - A happy-path route now implemented but **absent from the table** → drift.
   - A table entry marked `[PLANNED]` or `[BLOCKED]` that now appears implemented in the router → drift.
4. **If drift is found, stop.** Report the missing/changed screens and ask whether to (a) update the flow doc table and the spec to include them, then capture, or (b) capture as-is with the gap noted. Do not silently capture an incomplete journey.
5. If no drift, say so in one line and continue.

## Capture

1. Confirm the Docker Compose stack is up and healthy: `docker compose ps`. The frontend must respond on `http://localhost:3000` and `cdp-uploader` must be the pinned `1.16.0` image.
2. Run the capture: `npm run screenshots`. It clears and re-populates `test/screenshots/output/happy-path/` (gitignored).
3. Verify the output: list `test/screenshots/output/happy-path/` — expect the index-numbered PNGs named in the flow doc, in journey order. The `checking-your-file` capture is best-effort (transient meta-refresh page); a numbering gap there is acceptable, any other missing screen is a failure.
4. Report the absolute output directory path and the ordered file list so the user can hand the PNGs to UCD.

If a step of the journey fails, do not patch the spec ad hoc — check `test/flows/happy-path/capture-happy-path.flow.md` for drift against the frontend first (same discipline as `/triage-failure`).

If the user asks for a new screen to be added to the capture, update the flow doc table first, then the spec, keeping journey order.
