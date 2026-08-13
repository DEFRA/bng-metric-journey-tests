# Discover User Journey — Reference

## Purpose

Identify gaps in E2E test coverage for a named user flow and recommend new tests or enhancements to existing ones. Edge cases are inferred automatically from source validation logic.

The flow file is the contract.

**Read the sibling suites before recommending anything.** A proposed journey test that
the backend integration suite (or a frontend unit test) already covers is not a gap, and
a journey test is the most expensive test we own. `.ai/instructions/coverage-boundaries.md`
is the rule for that decision — read it before Step 2b and apply it there. Note in
particular that "covered elsewhere" rarely means "skip": integration tests never render,
so they substitute for a rule assertion but never for the wiring.

`/verify-integration-coverage` is **dormant**. Never recommend deferring or routing work
to it; gaps in backend coverage are recorded as annotations and proposals instead.

**File upload tests:** When recommending tests that involve file uploads (e.g. steps whose route is `/upload-baseline-file` or any step that requires a `.gpkg` file), source fixtures from `../bng-metric-harness/example-files/`. The file must be copied into `test/example-files/` in this repo before the test is written — this ensures it is available for repeated local and CI runs. Use the file that matches the scenario (happy path, specific validation error, invalid format). If the right file is ambiguous, ask the user before finalising the recommendation.

---

## Pre-flight check

Before doing anything else, ask the user to confirm **both** of the following:

1. "Have you run `docker compose pull` to pull the latest service images?"
2. "Have you run the full test suite (`docker compose up --wait` → `npm run test:github`) against those images and confirmed all tests pass with no failures?"

If the answer to either is **no**, stop and ask the user to complete the pre-flight first:

```sh
docker compose pull
docker compose up --wait
npm run test:github
```

Only proceed once the user confirms both steps are done and all tests passed.

---

## Step 1 — Read the flow doc

Read `test/flows/<flow-name>.flow.md`. Only `[IMPLEMENTED]` steps are in scope for executable tests. Do **not** discard `[PLANNED]`/`[BLOCKED]` steps — collect them for the "Blocked / not-yet-built" section (Step 4b).

---

## Step 2 — Map existing specs to flow steps

Read all files in `test/specs/`. For each `[IMPLEMENTED]` flow step:

1. Check if any spec imports a page object or flow that corresponds to the route in that step.
2. Check if any spec navigates to that route directly.
3. Note which test titles cover the step and what they assert.

A step is **covered** only when each of its material _sub-assertions_ is exercised — not merely when a happy-path test exists. For each step, enumerate the sub-assertions a thorough tester would expect, then check each against the specs. Common sub-assertion axes:

- **Presence vs. value** — is the label/field shown _and_ is its rendered value correct? (e.g. a trading-rule label being shown ≠ the guidance text being correct per distinctiveness band.)
- **Positive vs. negative access** — the owner can see/use a resource ≠ a different user is denied; and denial must hold both by **listing** _and_ by **direct object URL** (IDOR).
- **List vs. detail**, **happy path vs. each error branch**, **initial render vs. post-interaction state**.

Mark a step **Partial** when the happy path exists but a sub-assertion is missing, and name the missing sub-assertion in the Recommendation column (→ **Enhance**). Only mark it fully covered (**—**) when no material sub-assertion is outstanding.

---

## Step 2b — Check the sibling suites

For every step or scenario that Step 2 marked **No** or **Partial** — i.e. every candidate
recommendation — check whether it is already covered outside this repo before proposing a
journey test. Follow `.ai/instructions/coverage-boundaries.md`, Steps A–C.

Where to look:

- `../bng-metric-backend/integration-tests/` — `route-manifest.json` is the index of which
  endpoints exist; the test files are named by behaviour.
- `../bng-metric-backend/src/**/*.test.js` — backend unit tests, for rules and error codes.
- `../bng-metric-frontend/src/server/<dir>/controller.test.js` and shared helpers under
  `src/server/common/helpers/` — these boot the real server with `wreck` mocked, so they
  cover rendered markup against fabricated backend data.

Record **file:line** for every counterpart you find; a matching test title is not evidence.
Apply the two traps from the boundaries file — _mapping is not detection_, and _a shared
module is not shared coverage when parameterised per flow_ — before concluding anything is
covered.

Carry the result into the Step 4 table as the **Covered elsewhere?** column.

---

## Step 3 — Infer edge cases from the flow doc

For each `[IMPLEMENTED]` step, read the **Validation**, **On success**, and **On error** fields from the flow doc. These are the primary source for edge case inference — do not re-read source files unless a field is marked `Unknown`.

Derive edge cases as follows:

- Each **Validation** rule is a potential edge case (e.g. "required" → empty submission; "max N characters" → oversized input; "allowed values: X, Y" → invalid value).
- **On error** describes what the user should see on failure — assert this in the edge case test.
- **On success** describes the redirect or outcome — assert this in the happy path test.
- If **Auth required** is Yes, an unauthenticated access attempt is always an edge case.
- **Access control (when a step reads/writes a user-owned resource):** a _different_ authenticated user must be denied — both when **listing** (resource absent) and when opening the resource's **direct URL** (IDOR → not-found/forbidden, never another user's data). Drive it with two browser contexts (creator + other user).
- **Session lifecycle (when Auth required is Yes):** an expired/missing session on a protected route redirects to sign-in. Drive it by clearing the session cookie client-side (`page.context().clearCookies({ name: '<session-cookie>' })`) — this does not poison the shared `STORAGE_STATE`. Leave silent token-refresh to backend unit tests.

These taxonomy items go beyond form validation; they are not triggered by a **Validation** field, so derive them from the step's nature (owned resource, protected route). Many are stub-only — annotate each with its run-mode reachability (see Step 4).

If a **Validation** field is `Unknown` or absent, read the route handler at `../bng-metric-frontend/src/server/<dir>/index.js` for the Joi schema or validation helper to fill the gap.

---

## Step 3b — Cross-reference the error catalogue and fixtures (upload/validation flows)

The flow doc is not a complete index of validation rules — a thinly-documented **On error** field hides the backend error catalogue, and built-but-untested gates slip through. For any flow that uploads or validates a file (e.g. steps whose route is `/upload-baseline-file`):

1. Read the backend error catalogue: `../bng-metric-backend/src/validation/**/errors.js` for the full set of error codes.
2. List available fixtures: `ls ../bng-metric-harness/example-files/`.
3. Diff both against the fixtures **actually referenced** in `test/specs/`. An error code that has a matching unused fixture is a candidate gap → recommend **Write E2E**. An error code with no fixture is a candidate **placeholder** (see Step 3c).

**The fixture name is a hint, not a guarantee.** A fixture may trip a different error code than its name implies (e.g. a "habitats with incorrect geometry" fixture can surface as a _schema mismatch_ + _zero parcels_ rather than a "non-polygon geometry" message). Before finalising the assertion text for any such test, confirm the **actual rendered message**: trace the backend error-builder's `message`, then the frontend error-file `buildHeading` (the heading is the message up to the first `": "`), or upload the fixture once and read the rendered error summary. Never assert on a message inferred from the code name alone.

---

## Step 3c — Classify outcome observability

For each step/gap, decide whether its success/error outcome is observable in the browser.

If the outcome is **not** browser-observable — a DB trigger, an audit/log row, an async backend side-effect with no UI surface — it is **out of scope for a journey test**. Do not recommend **Write E2E** and do not mark it an uncovered journey gap (that is a false positive). Flag it in the gap table as **Backend proposal**, naming the behaviour and where it should be covered.

You may **read** the sibling suites (Step 2b) but must not **write** to them. `/verify-integration-coverage` is dormant, so a backend gap is not routed anywhere — it is recorded in the "Backend coverage proposals" section of the output (Step 4c) and, where a journey test currently stands in for it, as a comment on that test.

---

## Step 4 — Produce the gap table

Output a table with one row per flow step (happy path) and one row per inferred edge case. For any **Enhance** row, include a one-line description of exactly what to add or change in the identified spec file — this becomes the implementation instruction after approval.

| Step                            | Scenario                            | Covered here?        | Covered elsewhere?                | Run mode   | Recommendation                                             |
| ------------------------------- | ----------------------------------- | -------------------- | --------------------------------- | ---------- | ---------------------------------------------------------- |
| Step 1 — View project name form | Happy path — form renders           | Yes (`home.spec.js`) | —                                 | e2e + stub | —                                                          |
| Step 2 — Submit project name    | Happy path — redirects to dashboard | No                   | No                                | e2e + stub | Write E2E                                                  |
| Step 2 — Submit project name    | Empty name → error summary shown    | No                   | `projects.test.js:88` (rule only) | e2e + stub | Write E2E — integration never renders the error summary    |
| Step 2 — Submit project name    | Name > 1,000 chars → error message  | Partial              | `controller.test.js:41` (mocked)  | e2e + stub | Enhance: add assertion for the specific error message text |
| Step 2 — Submit project name    | `audit_log` row written on create   | No                   | `audit-log.test.js:12`            | —          | Backend proposal — not browser-observable                  |

The **Covered elsewhere?** column carries the file:line found in Step 2b, plus a
parenthetical saying what kind of coverage it is — `(rule only)` for an integration test,
`(mocked)` for a frontend unit test handed fabricated backend data. That parenthetical is
what stops "covered elsewhere" being read as "skip".

**Run mode** — the e2e coverage ceiling for the recommended test:

- **e2e + stub** — uses the completer `STORAGE_STATE`; runs everywhere.
- **stub-only** — uses `NO_ROLE`/`NO_PROJECTS` profiles, multiple users, or session/cookie manipulation; skips in e2e via `skipInE2e`. The single real Defra ID account cannot reproduce these.

Determine it from the profile/technique the test requires, not the route. After the table, add a one-line note summarising which recommended gaps are **stub-only**, so the e2e coverage ceiling is explicit.

**Recommendation values:**

- **Write E2E** — a new test case is needed (in a new or existing spec). Use this both when
  nothing covers the scenario and when a sibling suite covers the _rule_ but no journey test
  witnesses this rendering shape with real data.
- **Enhance** — a related test exists but does not fully assert this scenario; the Recommendation column must state exactly what to add or change
- **Skip** — a sibling suite covers the rule **and** an existing journey test already
  witnesses this rendering shape with real data. Name that sibling test; without one, this
  value is not available (see the coverage floor in `.ai/instructions/coverage-boundaries.md`).
- **Backend proposal** — outcome is not browser-observable (Step 3c). Not a journey gap;
  goes in the Step 4c list.
- **—** (dash) — fully covered, no action needed

---

## Step 4c — Backend coverage proposals

Any behaviour that a journey test cannot cover, or that only a journey test currently
covers, goes in a short second list: _Behaviour / Where it should be covered / What stands
in for it today_.

This is a hand-off for the service team, not work this repo performs — `/verify-integration-coverage`
is dormant and must not be recommended. When a journey test is the sole witness for a
behaviour, the test itself must also carry a comment saying so; see "Annotations" in
`.ai/instructions/coverage-boundaries.md` for the required form.

---

## Step 4b — Blocked / not-yet-built gaps

List each `[PLANNED]`/`[BLOCKED]` step — and any reviewer-raised gap whose feature is not built — in a separate table: _Scenario / Why blocked / Unblock trigger_.

For each, recommend a **documented skip placeholder** following the repo convention: a `test.skip('<descriptive title>', async () => { …ready-to-run body… })` (or a describe-level skip) carrying the unblock steps in a comment, placed in the spec it will eventually live in. This keeps the gap tracked and executable-on-unblock without inventing fixtures or features.

**Drift check first.** Before recommending a placeholder, verify the blocked status against current source — a step marked `[PLANNED]` may now be implemented (e.g. confirm the route is still unregistered in `../bng-metric-frontend/src/server/<dir>/index.js`). If it is now implemented, move it into the Step 4 gap table as a real **Write E2E** instead.

---

## Step 5 — Approval gate

Present the gap table and a short summary of how many tests need writing or enhancing. **Stop here.** Do not touch any test file until the user explicitly approves the analysis.

On approval:

- For **Write E2E** items: follow the checklist in `AGENTS.md` under "Adding a New Test".
- For **Enhance** items: apply the specific change described in the Recommendation column to the identified spec file.
