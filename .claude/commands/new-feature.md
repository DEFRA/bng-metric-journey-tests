---
description: Run coverage-gap analysis for a new feature described in feature-input.md. Produces a recommendation table and waits for approval before writing any test code.
---

A new feature has been described in `feature-input.md`. Run the coverage-gap analysis exactly as follows — do not write any test code until the analysis is approved.

## Step 1 — Read the feature input

Read `feature-input.md` in full. Identify:

- The feature title and Jira reference
- Which flow file it belongs to
- The acceptance criteria (each AC is analysed separately)
- Any notes about exclusions or affected routes

## Step 2 — Read the relevant source

Read the following to understand what the feature does and where it lives:

- `../bng-metric-frontend/src/server/router.js` — find the affected routes
- The route handler(s) and Nunjucks templates at `../bng-metric-frontend/src/server/<route>/`
- `../bng-metric-backend/src` — any API endpoints the feature calls

## Step 3 — Read integration test coverage

Read `../bng-metric-harness/tests/` to find existing integration tests that cover the feature's ACs. Look in both frontend and backend subdirectories.

## Step 4 — Produce the coverage-gap analysis

Output a table with one row per AC:

| AC  | AC description | Frontend test covers it? | Backend test covers it? | Recommendation                                 |
| --- | -------------- | ------------------------ | ----------------------- | ---------------------------------------------- |
| AC1 | ...            | Yes / No (file if yes)   | Yes / No (file if yes)  | Write E2E / Descope / Enhance integration test |

**Recommendation rules:**

- **Write E2E** — not covered at integration level on either side; browser-level validation needed
- **Descope** — already covered at integration level; E2E would duplicate without adding confidence
- **Enhance integration test** — partially covered; a targeted integration test addition is more appropriate than E2E

## Step 5 — Wait for approval

Present the table and a short summary of which ACs will get E2E tests. **Stop here.** Do not touch any test files until the user explicitly approves the analysis.

Only after approval: follow the checklist in `AGENTS.md` under "Adding a New Test".
