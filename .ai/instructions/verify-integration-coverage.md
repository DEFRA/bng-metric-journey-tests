# Verify Integration Coverage — Reference

## Purpose

Identify gaps in backend integration test coverage for a named user flow and recommend enhancements. This is the **only** command that may write to sibling service repositories.

---

## Scope

- **In scope:** `../bng-metric-backend/integration-tests/`
- **Out of scope:** frontend integration tests (none exist; do not create any in `../bng-metric-frontend`)
- **Out of scope:** unit tests (`../bng-metric-backend/src/**/*.test.js`)

---

## Step 1 — Read the flow doc

Read `test/flows/<flow-name>.flow.md`. For each `[IMPLEMENTED]` step, extract:

- The backend endpoint called (from the **Backend endpoint** field)
- The HTTP method and path

Steps with no backend endpoint (frontend-only rendering) are out of scope — note them as "No backend call" in the coverage table.

---

## Step 2 — Read existing integration tests

Read all files in `../bng-metric-backend/integration-tests/`. For each backend endpoint identified in Step 1, find:

- Tests that call this endpoint with a valid request (happy path)
- Tests that call this endpoint with invalid/missing data (validation / error paths)
- Tests that call this endpoint without authentication (auth guard check)
- Tests that exercise boundary conditions (e.g. large payloads, duplicate submissions)

---

## Step 3 — Infer edge cases from backend source

For each endpoint, read the corresponding route handler in `../bng-metric-backend/src/routes/`. Look for:

- Joi validation schemas — each rule is a potential edge case (required, min/max, pattern, valid values)
- Auth middleware — confirm an unauthenticated test exists
- Error responses — 400, 401, 403, 404, 409, 422, 500 — check which are tested
- Database interactions — duplicate key constraints, not-found conditions

---

## Step 4 — Produce the coverage table

| Endpoint                | Scenario                    | Covered? | File if yes                          | Recommendation       |
| ----------------------- | --------------------------- | -------- | ------------------------------------ | -------------------- |
| `POST /api/projects`    | Happy path — create project | Yes      | `integration-tests/projects.test.js` | —                    |
| `POST /api/projects`    | Missing required field      | No       | —                                    | Add integration test |
| `POST /api/projects`    | Unauthenticated request     | No       | —                                    | Add integration test |
| `GET /api/projects/:id` | Project not found (404)     | No       | —                                    | Add integration test |

**Recommendation values:**

- **Add integration test** — scenario not covered; a new test case should be added
- **Enhance** — test exists but assertions are incomplete
- **—** (dash) — fully covered

---

## Step 5 — Approval gate

Present the coverage table and a summary of the gaps. **Stop here.** Do not modify any file until the user explicitly approves.

On approval: add or update test cases in the relevant file(s) under `../bng-metric-backend/integration-tests/`. Follow the existing test style in those files (framework, import patterns, setup/teardown). Do not modify unit test files or source files.
