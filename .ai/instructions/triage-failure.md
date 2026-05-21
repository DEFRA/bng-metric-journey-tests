# Triage Failure — Reference

## Purpose

Investigate a failing journey test in the correct order: check whether the related flow doc has drifted from the current service before diagnosing the test itself. A test may be failing because the service changed, not because the test is wrong — fixing the test without checking this produces a passing test that asserts the wrong behaviour.

---

## Step 1 — Parse the failure

From the failure log or description, extract:

- **Spec file** — which file in `test/specs/` contains the failing test
- **Test title** — the full `test(...)` description
- **Failing assertion** — what Playwright expected vs what it got
- **Route or URL** — the page or endpoint the test was interacting with when it failed

If any of these cannot be determined from the input, ask the user to clarify before continuing.

---

## Step 2 — Locate the flow doc

Search `test/flows/` for the flow doc whose steps cover the failing route. Match on the **Route** field in each step.

- If a matching flow doc is found: proceed to Step 3.
- If no flow doc exists for that route: note this, skip Steps 3–4, and proceed directly to Step 5.

---

## Step 3 — Check for drift

Read the flow doc step that covers the failing route. Then read the current frontend source for that route:

- The route handler in `../bng-metric-frontend/src/server/<route>/controller.js`
- The Joi schema or validation helper used by that route
- The template file referenced in the On success / On error fields

Compare the flow doc against the source for:

| What to check                       | Flow doc field   |
| ----------------------------------- | ---------------- |
| Route path                          | Route            |
| Validation rules and error messages | Validation       |
| Success redirect                    | On success       |
| Error view / error message          | On error         |
| Auth requirement                    | Auth required    |
| Backend endpoint called             | Backend endpoint |

Flag any discrepancy as **drift**.

---

## Step 4 — Update flow doc if drifted _(approval gate)_

**If drift was found:**

Present a clear diff of the proposed changes to the flow doc — what the doc currently says vs what the source now says. Explain which change in the service likely caused the test to fail.

**Stop here. Do not update the flow doc until the user explicitly approves.**

On approval: update the flow doc with accurate fields and markers.

**If no drift was found:**

State clearly: _"The flow doc is current — the failure is not caused by service drift."_ Proceed to Step 5.

---

## Step 5 — Diagnose the test failure

With the (now current) flow doc as reference, identify the root cause of the failure. Common causes:

- **Changed selector or `data-testid`** — element the test targets was renamed or removed
- **Changed error message text** — validation message wording changed
- **Changed redirect URL** — success or error path changed
- **Changed page title or heading** — `toHaveTitle` or heading assertion no longer matches
- **Changed response structure** — backend payload shape changed, affecting what the frontend renders
- **Auth / session state issue** — storage state is stale or auth flow changed
- **Timing issue** — a `waitForURL` or `waitForSelector` is racing a slow response

State the diagnosis clearly before proposing a fix.

---

## Step 6 — Propose and apply fix _(approval gate)_

Present the exact change needed to the failing test (or page object if the selector lives there). Include:

- Which file(s) will be changed
- The before and after of each change
- Why this fix addresses the diagnosed root cause

**Stop here. Do not modify any test file until the user explicitly approves.**

On approval: apply the fix and confirm which files were changed.
