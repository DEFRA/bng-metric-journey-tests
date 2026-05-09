# Demo Guide — BNG Metric Journey Tests AI Framework

30-minute session. Keep this open as a reference alongside your terminal.

---

## Run sheet

| Time          | Segment                  | Format |
| ------------- | ------------------------ | ------ |
| 0:00 – 3:00   | Scene setting            | Talk   |
| 3:00 – 11:00  | `/analyse-user-flow`     | Live   |
| 11:00 – 19:00 | `/discover-user-journey` | Live   |
| 19:00 – 26:00 | `/validate-ac-automated` | Live   |
| 26:00 – 28:00 | Remaining capabilities   | Talk   |
| 28:00 – 30:00 | Questions                | —      |

---

## Segment 0 — Scene setting (3 min)

**The problem to open with:**

> "E2E tests are only useful if they reflect what the service actually does. As the service changes — new routes, updated validation, new journeys — tests can silently drift out of sync. Keeping them aligned is a manual process that nobody has time for. This framework makes it automatic."

**The architecture in one sentence:**

> "Flow files are the spine. They describe each user journey step-by-step — what route, what validation, what happens on success or failure. Every other capability reads from them."

**Show the command table from AGENTS.md and say:**

> "Five commands. The first one writes flow files. The rest consume them. Each is independent — you can run any one at any time."

| Command                        | What it does                                         |
| ------------------------------ | ---------------------------------------------------- |
| `/analyse-user-flow`           | Reads source code → creates or updates a flow file   |
| `/discover-user-journey`       | Reads flow file + existing tests → recommends gaps   |
| `/validate-ac-automated`       | Reads ACs in feature-input.md → checks coverage      |
| `/validate-ac-manual`          | Runs ACs in a browser → captures screenshot evidence |
| `/verify-integration-coverage` | Reads flow file + backend tests → recommends gaps    |

---

## Segment 1 — `/analyse-user-flow` (8 min)

**Setup line:**

> "I've just pulled the latest on frontend and backend main. We have a user flow — changing a project name — that isn't documented yet. Let me map it out."

**Command to type:**

```
/analyse-user-flow user changes an existing project name
```

**What happens — walk the audience through each step out loud:**

1. Confirmation prompt: _"Notice it stops first and asks if I've pulled the latest. It won't read stale source."_
2. Reads `router.js`: _"It scans the router to find the relevant routes — the GET to show the form and the POST to submit it."_
3. Reads the controller: _"Now it reads the route handlers. Watch what it pulls out of the POST handler..."_
4. Points at Validation field: _"Every Joi validation rule becomes a named validation rule in the flow file. Those rules will become the edge cases it recommends testing."_
5. Points at On success / On error: _"It records what happens on success — redirect to the task list — and what happens on failure — re-render with the GOV.UK error summary."_

**When the proposed flow file appears:**

> "Before writing anything, it shows me the full proposed document and waits for my approval. Nothing is written until I say yes. That's the pattern across all five commands."

**Key talking point for non-technical audience:**

> "What you're seeing is the AI reading the actual production code — not documentation, not tickets — and producing a structured description of what the system does. That description becomes the source of truth for everything else."

**Approve the flow file to write `change-project-name.flow.md`.**

---

## Segment 2 — `/discover-user-journey` (8 min)

**Setup line:**

> "We already have a flow with tests written — creating a project. Let me ask the framework: what's covered, what's missing, and what edge cases should we be testing?"

**Command to type:**

```
/discover-user-journey create-project
```

**What happens — walk through out loud:**

1. Reads `test/flows/create-project.flow.md`: _"It picks up the flow file we already have. Only `[IMPLEMENTED]` steps are in scope."_
2. Reads `test/specs/create-project.spec.js`: _"It cross-references every implemented step against the existing test suite."_
3. Points at Validation fields being used: _"The edge cases it recommends come directly from the Validation fields in the flow file — it doesn't re-read source code. The flow file is the contract."_

**When the gap table appears, point at:**

- A row marked **—** (covered): _"This step has a test. No action needed."_
- A row marked **Write E2E**: _"This scenario has no coverage at all. It's recommending a new test case."_
- A row marked **Enhance** with a description: _"This one is the most important for the team — a test exists but it's not asserting the right thing. It tells you exactly what to add."_

**Key talking point:**

> "It's not just flagging gaps — it's telling you what to do about each one. Write a new test, or add one assertion to an existing test. That's an actionable recommendation, not a report."

**Key talking point for non-technical audience:**

> "Before this framework, this analysis would take a developer the better part of a morning. Now it takes thirty seconds and produces a table you can act on immediately."

---

## Segment 3 — `/validate-ac-automated` (7 min)

**Setup line:**

> "Different angle now. The team has written acceptance criteria for the change-project-name feature. Let me check: are these ACs already covered by tests?"

**Before typing the command — show `feature-input.md` is pre-filled and say:**

> "This is the feature input file — it's where you describe the feature with its ACs before asking the framework to evaluate coverage. Think of it as the brief you hand to the AI."

**Command to type:**

```
/validate-ac-automated
```

**What happens — walk through out loud:**

1. Reads `feature-input.md`: _"It picks up the ACs one by one."_
2. Reads the flow file: _"It uses the flow file to understand which steps each AC relates to."_
3. Reads the specs: _"It checks whether those steps are exercised in the test suite."_

**When the AC × coverage table appears:**

- Point at a fully covered AC: _"This one is done — no action needed."_
- Point at an uncovered AC: _"This AC has no test. The recommendation is to write a new E2E test."_
- Point at an Enhance row with its description: _"This one is the most valuable — there's a related test but it doesn't assert what the AC requires. And it tells you precisely what to add."_

**Key talking point:**

> "The difference between this command and the previous one is the starting point. `/discover-user-journey` starts from the flow and sweeps everything. This one starts from your ACs — useful when a ticket lands and you want to know immediately what testing work it implies."

---

## Segment 4 — Remaining capabilities (2 min)

**`/validate-ac-manual`:**

> "The manual validation command runs the same ACs in a real browser — headless — and captures screenshots at each key step. It produces a pass/fail report with evidence for each AC. Useful for demonstrating compliance or reviewing a feature before sign-off."

**`/verify-integration-coverage`:**

> "The last command looks at the same flow files but from the backend angle — it checks the integration tests in the backend service and recommends where coverage is thin. It's the only command that can write to the backend repository. Keeping integration tests and E2E tests aligned from the same flow file means the whole test pyramid stays coherent."

---

## Recovery notes

| Problem                            | Recovery                                                                                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `/analyse-user-flow` is slow       | Say: "While that runs, let me show you the flow file it's going to produce" — open `create-project.flow.md` to illustrate the format          |
| Service isn't running              | Segments 1–3 don't need a live browser — they read source and specs. Carry on                                                                 |
| Command produces unexpected output | Every command has an approval gate — nothing is written. Say: "This is the safety valve — I can see the output and decide whether to proceed" |
| Terminal too small to read         | Increase font size before starting; keep line length in mind when typing commands                                                             |

---

## Pre-demo checklist

- [ ] Node version: `nvm use 24.11.1`
- [ ] Frontend running: `cd ../bng-metric-frontend && npm run dev`
- [ ] Tests green: `npm run test:local` in journey-tests
- [ ] `feature-input.md` open in editor (for segment 3)
- [ ] `create-project.flow.md` open in editor (to show during segment 2)
- [ ] Terminal font size readable from the back of the room
- [ ] This file open in a second window
