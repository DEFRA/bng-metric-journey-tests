---
description: Run ACs from feature-input.md in a browser, capture screenshot and demo-video evidence per AC, and produce a pass/fail report. Clears previous evidence on each run.
---

A manual AC validation has been requested. Read `.ai/instructions/validate-ac.md` (the "Manual validation" section) and follow all steps exactly.

Steps to follow in order:

1. Run the pre-flight check from the instruction file.
2. **Ticket-details source gate:** ask the user (via `AskUserQuestion`) whether to source ticket details from the **Jira API** or from a **manually filled `feature-input.md`**, per the "Ticket-details source gate" section of the instruction file.
   - **Jira API** — resolve the ticket key in this order: (1) a key in `$ARGUMENTS`, (2) a real (non-placeholder) `Ticket Number` already in `feature-input.md`, (3) ask the user. Then follow `.ai/instructions/jira-extraction.md`, populate `feature-input.md` from the ticket, and confirm the extraction summary with the user before continuing.
   - **Manual** — confirm the user has filled `feature-input.md`; wait if it is still the blank template.
3. Read `feature-input.md` — extract the feature title, all ACs, and each AC's `Steps:` sequence of user actions. If the ACs have no `Steps:` lists (a hand-filled file, or an older extraction), derive them now per "Deriving the user-action sequence" in the instruction file and write them back into `feature-input.md` before continuing.
4. Delete the entire `test/evidence/` folder if it exists (this clears previous evidence).
5. Create `test/evidence/YYYY-MM-DD/` using today's date.
6. Generate `test/evidence/tmp-validation.spec.js` — one `test()` block per AC, one `demoStep()` per step in that AC's `Steps:` list, explicit screenshots at key steps, and the `saveDemoVideo` `afterEach`. Follow the spec template in the instruction file.
7. Run the spec: `npm run test:evidence`.
8. Parse the terminal output and produce the pass/fail summary table as described in the instruction file, including the demo-video column.
9. Leave `feature-input.md` populated — the extracted ACs are reused by `/validate-ac-automated` next; that command performs the reset when the ticket is done (see "Resetting feature-input.md after the run" in the instruction file).

The local frontend service must be running at `http://localhost:3000` before step 7.

Provided arguments (may contain the ticket key, e.g. `BMD-597`): $ARGUMENTS
