# Discover User Journey — Reference

## Purpose

Identify gaps in E2E test coverage for a named user flow and recommend new tests or enhancements to existing ones. Edge cases are inferred automatically from source validation logic.

The flow file is the contract. Do **not** read integration tests — that is the responsibility of `/verify-integration-coverage`.

**File upload tests:** When recommending tests that involve file uploads (e.g. steps whose route is `/upload-baseline-file` or any step that requires a `.gpkg` file), source fixtures from `../bng-metric-harness/example-files/`. The file must be copied into `test/example-files/` in this repo before the test is written — this ensures it is available for repeated local and CI runs. Use the file that matches the scenario (happy path, specific validation error, invalid format). If the right file is ambiguous, ask the user before finalising the recommendation.

---

## Step 1 — Read the flow doc

Read `test/flows/<flow-name>.flow.md`. Only steps marked `[IMPLEMENTED]` are in scope. Skip `[PLANNED]` and `[BLOCKED]` steps entirely.

---

## Step 2 — Map existing specs to flow steps

Read all files in `test/specs/`. For each `[IMPLEMENTED]` flow step:

1. Check if any spec imports a page object or flow that corresponds to the route in that step.
2. Check if any spec navigates to that route directly.
3. Note which test titles cover the step and what they assert.

A step is considered **covered** if at least one spec exercises the happy path for it. It is **partially covered** if only edge cases or only the happy path exist.

---

## Step 3 — Infer edge cases from the flow doc

For each `[IMPLEMENTED]` step, read the **Validation**, **On success**, and **On error** fields from the flow doc. These are the primary source for edge case inference — do not re-read source files unless a field is marked `Unknown`.

Derive edge cases as follows:

- Each **Validation** rule is a potential edge case (e.g. "required" → empty submission; "max N characters" → oversized input; "allowed values: X, Y" → invalid value).
- **On error** describes what the user should see on failure — assert this in the edge case test.
- **On success** describes the redirect or outcome — assert this in the happy path test.
- If **Auth required** is Yes, an unauthenticated access attempt is always an edge case.

If a **Validation** field is `Unknown` or absent, read the route handler at `../bng-metric-frontend/src/server/<dir>/index.js` for the Joi schema or validation helper to fill the gap.

---

## Step 4 — Produce the gap table

Output a table with one row per flow step (happy path) and one row per inferred edge case. For any **Enhance** row, include a one-line description of exactly what to add or change in the identified spec file — this becomes the implementation instruction after approval.

| Step                            | Scenario                            | Currently covered?   | File if covered   | Recommendation                                             |
| ------------------------------- | ----------------------------------- | -------------------- | ----------------- | ---------------------------------------------------------- |
| Step 1 — View project name form | Happy path — form renders           | Yes (`home.spec.js`) | —                 |
| Step 2 — Submit project name    | Happy path — redirects to dashboard | No                   | —                 | Write E2E                                                  |
| Step 2 — Submit project name    | Empty name → error summary shown    | No                   | —                 | Write E2E                                                  |
| Step 2 — Submit project name    | Name > 1,000 chars → error message  | Partial              | `project.spec.js` | Enhance: add assertion for the specific error message text |
| Step 2 — Submit project name    | Unauthenticated → redirect to login | No                   | —                 | Write E2E                                                  |

**Recommendation values:**

- **Write E2E** — not covered at all; a new test case is needed (in a new or existing spec)
- **Enhance** — a related test exists but does not fully assert this scenario; the Recommendation column must state exactly what to add or change
- **—** (dash) — fully covered, no action needed

---

## Step 5 — Approval gate

Present the gap table and a short summary of how many tests need writing or enhancing. **Stop here.** Do not touch any test file until the user explicitly approves the analysis.

On approval:

- For **Write E2E** items: follow the checklist in `AGENTS.md` under "Adding a New Test".
- For **Enhance** items: apply the specific change described in the Recommendation column to the identified spec file.
