---
description: Run ACs from feature-input.md in a browser, capture screenshot evidence per AC, and produce a pass/fail report. Clears previous evidence on each run.
---

A manual AC validation has been requested. Read `.ai/instructions/validate-ac.md` (the "Manual validation" section) and follow all steps exactly.

Steps to follow in order:

1. Run the pre-flight check from the instruction file.
2. **Ticket-details source gate:** ask the user (via `AskUserQuestion`) whether to source ticket details from the **Jira API** or from a **manually filled `feature-input.md`**, per the "Ticket-details source gate" section of the instruction file.
   - **Jira API** — resolve the ticket key in this order: (1) a key in `$ARGUMENTS`, (2) a real (non-placeholder) `Ticket Number` already in `feature-input.md`, (3) ask the user. Then follow `.ai/instructions/jira-extraction.md`, populate `feature-input.md` from the ticket, and confirm the extraction summary with the user before continuing.
   - **Manual** — confirm the user has filled `feature-input.md`; wait if it is still the blank template.
3. Read `feature-input.md` — extract the feature title and all ACs.
4. Delete the entire `test/evidence/` folder if it exists (this clears previous evidence).
5. Create `test/evidence/YYYY-MM-DD/` using today's date.
6. Generate `test/evidence/tmp-validation.spec.js` — one `test()` block per AC with explicit `page.screenshot()` calls at key steps, saving screenshots to `test/evidence/YYYY-MM-DD/`.
7. Run the spec: `EVIDENCE=true RUN_MODE=local npx playwright test test/evidence/tmp-validation.spec.js --reporter=list` (the `EVIDENCE=true` flag opts the evidence spec past the suite's `testIgnore`).
8. Parse the terminal output and produce the pass/fail summary table as described in the instruction file.
9. Restore `feature-input.md` to its blank template state by copying `.ai/templates/feature-input.template.md` over it (see "Resetting feature-input.md after the run" in the instruction file).

The local frontend service must be running at `http://localhost:3000` before step 7.

Provided arguments (may contain the ticket key, e.g. `BMD-597`): $ARGUMENTS
