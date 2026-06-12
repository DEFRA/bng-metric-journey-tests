---
description: Run ACs from feature-input.md in a browser, capture screenshot evidence per AC, and produce a pass/fail report. Clears previous evidence on each run.
---

A manual AC validation has been requested. Read `.ai/instructions/validate-ac.md` (the "Manual validation" section) and follow all steps exactly.

Read `feature-input.md` now to begin.

Steps to follow in order:

1. Read `feature-input.md` — extract the feature title and all ACs.
2. Delete the entire `test/evidence/` folder if it exists (this clears previous evidence).
3. Create `test/evidence/YYYY-MM-DD/` using today's date.
4. Generate `test/evidence/tmp-validation.spec.js` — one `test()` block per AC with explicit `page.screenshot()` calls at key steps, saving screenshots to `test/evidence/YYYY-MM-DD/`.
5. Run the spec: `EVIDENCE=true RUN_MODE=local npx playwright test test/evidence/tmp-validation.spec.js --reporter=list` (the `EVIDENCE=true` flag opts the evidence spec past the suite's `testIgnore`).
6. Parse the terminal output and produce the pass/fail summary table as described in the instruction file.

The local frontend service must be running at `http://localhost:3000` before step 5.
