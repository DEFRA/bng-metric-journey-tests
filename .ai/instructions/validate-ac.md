# Validate AC — Reference

Shared reference for `/validate-ac-automated` and `/validate-ac-manual`.

---

## Extracting ACs from feature-input.md

Read `feature-input.md` in full. The key fields are:

- **Journey** — which flow file this belongs to (used to locate the relevant flow doc)
- **Acceptance criteria** — the numbered ACs to validate (each is analysed separately)
- **Notes** — any exclusions or scope limits

Each AC is treated as an independent unit. Do not combine ACs into a single test.

---

## Automated validation (`/validate-ac-automated`)

### Coverage table format

| AC  | AC description | Covered in journey tests? | File(s) if yes           | Recommendation          |
| --- | -------------- | ------------------------- | ------------------------ | ----------------------- |
| AC1 | ...            | Yes / Partial / No        | `test/specs/foo.spec.js` | — / Enhance / Write E2E |

**Recommendation values:**

- **Write E2E** — no existing test covers this AC; a new test case is needed
- **Enhance** — a related test exists but does not fully assert this AC; describe specifically what is missing (e.g. "add assertion for error message when field is empty" or "extend `test/specs/foo.spec.js` to also verify the success banner text")
- **—** (dash) — fully covered, no action needed

For every **Enhance** recommendation, include a one-line description of exactly what to add or change in the existing test alongside the file reference. This description becomes the implementation instruction after approval.

### What to read

- `feature-input.md` — ACs and journey field
- `test/flows/<journey>.flow.md` — to understand which steps the ACs relate to and what validation/success/error behaviour is expected
- `test/specs/` — all existing specs; read the relevant spec files in full to determine whether and how each AC is already asserted

Do **not** read integration tests — that is the responsibility of `/verify-integration-coverage`.

### Approval gate

Present the coverage table and a summary of which ACs need new tests and which need enhancements. Stop and wait for explicit approval before writing any test code.

On approval:

- For **Write E2E** items: follow the checklist in `AGENTS.md` under "Adding a New Test".
- For **Enhance** items: apply the specific change described in the Recommendation column to the identified spec file.

---

## Manual validation (`/validate-ac-manual`)

### Evidence folder

- Location: `test/evidence/YYYY-MM-DD/` (use today's date)
- On a fresh run: delete the entire `test/evidence/` folder before creating the new dated subfolder. This removes all previous evidence.

### Temporary spec

Generate `test/evidence/tmp-validation.spec.js` before running. Do not place it in `test/specs/`. The file is kept alongside the evidence after the run — do not delete it.

The spec structure:

```javascript
import { test } from '@fixtures'

test.describe('AC Validation — <Feature title from feature-input.md>', () => {
  test('AC1: <AC description> @ac-validation', async ({ page }) => {
    // Navigate and interact to exercise this AC
    await page.screenshot({
      path: 'test/evidence/YYYY-MM-DD/ac1-step1-<description>.png'
    })
    // Continue steps...
    await page.screenshot({
      path: 'test/evidence/YYYY-MM-DD/ac1-step2-<description>.png'
    })
  })

  test('AC2: <AC description> @ac-validation', async ({ page }) => {
    // ...
  })
})
```

### Screenshot naming

`ac<N>-step<M>-<short-kebab-description>.png`

Examples:

- `ac1-step1-home-page-loaded.png`
- `ac2-step1-form-submitted.png`
- `ac2-step2-success-banner-visible.png`

Take at least one screenshot at the start of each AC and one at the key assertion point.

### Run command

```sh
RUN_MODE=local npx playwright test test/evidence/tmp-validation.spec.js --reporter=list
```

This uses the local base URL (`http://localhost:3000`). The service must be running before executing this command.

### Pass/fail report

After the run, parse the terminal output and produce a summary table:

| AC  | Description | Result      | Screenshots                            |
| --- | ----------- | ----------- | -------------------------------------- |
| AC1 | ...         | PASS / FAIL | `ac1-step1-...png`, `ac1-step2-...png` |
| AC2 | ...         | PASS / FAIL | `ac2-step1-...png`                     |

If a test fails, include the error message from the terminal output alongside the result.
