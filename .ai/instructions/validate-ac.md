# Validate AC — Reference

Shared reference for `/validate-ac-automated` and `/validate-ac-manual`.

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

## Ticket-details source gate (`/validate-ac-manual` only)

After the pre-flight, ask the user (via `AskUserQuestion`) how to source the ticket details:

1. **Jira API** — extract the ticket from Jira and populate `feature-input.md` automatically.
2. **Manual** — the user fills `feature-input.md` themselves (current behaviour).

`/validate-ac-automated` does **not** run this gate — it reads `feature-input.md` as-is.

**Jira API path:**

- Resolve the ticket key in this order: (1) a key given with the command or earlier in the conversation, (2) a real (non-placeholder) `Ticket Number` already filled into `feature-input.md`, (3) ask the user for it (e.g. `BMD-123`).
- Follow `.ai/instructions/jira-extraction.md` to fetch and parse the issue.
- Overwrite `feature-input.md`, keeping the template's headings and layout exactly, with:
  - **Ticket Number / Title** ← `key` + `fields.summary`
  - **User flow** ← the best-matching doc under `test/flows/` based on the ticket content; if there is no confident match, keep the placeholder and flag it to the user
  - **Implementation PRs** ← development-info endpoint / remote links / PR URLs in comments (`repo: PR#n` lines); write `none linked on ticket` if nothing found
  - **What it does** ← the ticket description, summarised
  - **Acceptance criteria** ← the AC custom fields, as a numbered list (one AC per number, verbatim wording)
  - **Notes** ← relevant clarifications/exclusions from comments
- Show the user a short summary of what was extracted (ticket, flow match, PR list, AC count) and get confirmation before continuing — this catches wrong-field extraction.
- If credentials are missing or the fetch fails, say so and fall back to the manual path.

**Manual path:** confirm `feature-input.md` has been filled in; if it is still the blank template, stop and wait for the user to fill it.

---

## Extracting ACs from feature-input.md

Read `feature-input.md` in full. The key fields are:

- **Journey** — which flow file this belongs to (used to locate the relevant flow doc)
- **Acceptance criteria** — the numbered ACs to validate (each is analysed separately)
- **Notes** — any exclusions or scope limits

Each AC is treated as an independent unit. Do not combine ACs into a single test.

**File upload ACs:** When an AC requires a file upload, source the fixture in this order:

1. `test/example-files/` in this repo — a previously used fixture may already cover the scenario.
2. `../bng-metric-harness/example-files/` — the canonical fixture library; copy the chosen file into `test/example-files/` before generating the spec so it is available for repeated local and CI runs.
3. **Last resort:** generate one by mutating the nearest existing fixture — only after confirming neither location has a usable file — and save the generated file into `test/example-files/` so later runs can reuse it.

Choose the file that matches the scenario (happy path, specific validation error, invalid format). If the right file is ambiguous, ask the user before proceeding.

### Deriving the user-action sequence

Ticket ACs state an outcome; a demo has to show a journey. So each AC also carries a
`Steps:` sub-list in `feature-input.md` recording the sequence of user actions that
demonstrates it. `/validate-ac-manual` turns each step into a captioned step in the AC's
demo video, so this list is what a reviewer ends up reading on screen.

- **Keep the AC text verbatim** — the ticket's wording is the traceable record. The `Steps:`
  list sits underneath it and is derived, not a replacement.
- **Write steps in the user's language, not the test's**: "Select _Watercourses_ in the left
  navigation", not "click `navLink(WATERCOURSES)`".
- **One action or observation per step.** The last step is the outcome the AC asserts.
- **Aim for 3–6 steps.** If an AC needs more, or spans several scenarios, split it into
  `AC5b`, `AC5c` and so on — several short demos are more useful than one long one.
- **`Steps: n/a — assertion only`** when the AC is a pure rendering or calculation assertion
  with no journey (e.g. "the Results section shows the same five tiles as the Project
  Summary page"). These still get screenshots and still get a video; it is just a short one.

---

## Automated validation (`/validate-ac-automated`)

### Coverage table format

| AC  | AC description | Covered in journey tests? | File(s) if yes           | Covered elsewhere?                   | Recommendation                                    |
| --- | -------------- | ------------------------- | ------------------------ | ------------------------------------ | ------------------------------------------------- |
| AC1 | ...            | Yes / Partial / No        | `test/specs/foo.spec.js` | file:line + `(rule only)`/`(mocked)` | — / Enhance / Write E2E / Skip / Backend proposal |

**Recommendation values:**

- **Write E2E** — a new test case is needed. Use this both when nothing covers the AC and
  when a sibling suite covers the _rule_ but no journey test witnesses this rendering shape
  with real data.
- **Enhance** — a related test exists but does not fully assert this AC; describe specifically what is missing (e.g. "add assertion for error message when field is empty" or "extend `test/specs/foo.spec.js` to also verify the success banner text")
- **Skip** — a sibling suite covers the rule **and** an existing journey test already
  witnesses this rendering shape with real data. Name that sibling test; without one, this
  value is not available.
- **Backend proposal** — the AC's outcome is not browser-observable, so no journey test can
  assert it. List it under "Backend coverage proposals" (below) instead.
- **—** (dash) — fully covered, no action needed

For every **Enhance** recommendation, include a one-line description of exactly what to add or change in the existing test alongside the file reference. This description becomes the implementation instruction after approval.

### Backend coverage proposals

After the table, add a short list of any AC that a journey test cannot cover, or that only
a journey test will cover once written: _AC / Behaviour / Where it should be covered /
What stands in for it today_.

This is a hand-off for the service team, not work this repo performs. `/verify-integration-coverage`
is **dormant** and must not be recommended. When a new journey test is written as the sole
witness for a behaviour, it must carry a comment saying so — see "Annotations" in
`.ai/instructions/coverage-boundaries.md`.

### What to read

- `feature-input.md` — ACs and journey field
- `test/flows/<journey>.flow.md` — to understand which steps the ACs relate to and what validation/success/error behaviour is expected
- `test/specs/` — all existing specs; read the relevant spec files in full to determine whether and how each AC is already asserted
- `.ai/instructions/coverage-boundaries.md` — **read this before recommending any new
  test**, then apply it to every AC not already covered here

### Check the sibling suites first

For every AC marked **No** or **Partial** against this repo, check whether it is already
covered outside it before proposing a journey test. Follow `coverage-boundaries.md`,
Steps A–C. Look in:

- `../bng-metric-backend/integration-tests/` — `route-manifest.json` indexes the endpoints
- `../bng-metric-backend/src/**/*.test.js` — rules and error codes
- `../bng-metric-frontend/src/server/<dir>/controller.test.js` and `src/server/common/helpers/` — rendered markup against mocked backend data

Record **file:line** for each counterpart; a matching test title is not evidence. Apply the
two traps from the boundaries file — _mapping is not detection_, and _a shared module is
not shared coverage when parameterised per flow_ — before concluding an AC is covered.

You may **read** the sibling suites but must not **write** to them.

### Approval gate

Present the coverage table and a summary of which ACs need new tests and which need enhancements. Stop and wait for explicit approval before writing any test code.

On approval:

- For **Write E2E** items: follow the checklist in `AGENTS.md` under "Adding a New Test".
- For **Enhance** items: apply the specific change described in the Recommendation column to the identified spec file.

---

## Manual validation (`/validate-ac-manual`)

The run produces two kinds of evidence per AC: **screenshots**, which prove the outcome, and a
short **demo video**, which shows the journey the AC describes. Both come out of the same spec.

### Evidence folder

- Location: `test/evidence/YYYY-MM-DD/` (use today's date)
- On a fresh run: delete the entire `test/evidence/` folder before creating the new dated subfolder. This removes all previous evidence.

### Temporary spec

Generate `test/evidence/tmp-validation.spec.js` before running. Do not place it in `test/specs/`. The file is kept alongside the evidence after the run — do not delete it.

Every numbered step in an AC's `Steps:` list becomes one `demoStep()`, with the step text
passed verbatim as the title — that text is captioned onto the video, so the demo narrates
itself in the AC's own words.

```javascript
import { test, expect } from '@fixtures'
import { STORAGE_STATE } from '@utils/env.js'
import {
  demoStep,
  demoTitleCard,
  demoVideoName,
  saveDemoVideo
} from '@utils/evidence-video.js'

const DIR = 'test/evidence/YYYY-MM-DD'
const shot = (name) => ({ path: `${DIR}/${name}.png` })

test.describe('AC Validation — <Feature title from feature-input.md>', () => {
  test.use({ storageState: STORAGE_STATE })

  // Must be the LAST afterEach — it closes the context to finalise the video,
  // so nothing after it may touch `page`.
  test.afterEach(async ({ page }, testInfo) => {
    await saveDemoVideo(page, DIR, demoVideoName(testInfo))
  })

  test('AC1: <short AC summary> @ac-validation', async ({
    page,
    projectSummaryPage
  }) => {
    // First thing in the test, before any navigation — see demoTitleCard.
    await demoTitleCard(page, 'AC1', '<short AC summary>')

    await demoStep(page, 'Step 1 — Open the Project Summary page', async () => {
      await projectSummaryPage.open(project.id)
      await page.screenshot({
        ...shot('ac1-step1-project-summary-loaded'),
        fullPage: true
      })
    })

    await demoStep(
      page,
      'Step 2 — Select "Watercourses" in the left navigation',
      async () => {
        await projectSummaryPage.navLink(WATERCOURSES).click()
      }
    )

    await demoStep(
      page,
      'Step 3 — The "Watercourse habitats" page is displayed',
      async () => {
        await expect.soft(watercoursesSummaryPage.heading).toBeVisible()
        await page.screenshot({
          ...shot('ac1-step3-watercourses-summary-loaded'),
          fullPage: true
        })
      }
    )
  })
})
```

Use `expect.soft` throughout, so a failing assertion still leaves the remaining screenshots
and a complete video.

### Rules for a demo that matches the AC

- **Click what the AC says the user clicks.** Where a step describes an interaction, perform
  it — do not shortcut with `page.goto()` or a page object's `.open()`. Reaching the
  precondition state may navigate directly; the numbered steps may not. A test that jumps
  straight to a URL proves the page renders, but it does not demonstrate the journey, and on
  video it reads as a jump cut.
- **Step numbers line up.** A screenshot taken inside `Step 3` is named `ac1-step3-…png`, so
  the PNG index and the video caption point at the same moment.
- **Keep `beforeAll` setup off camera.** Project creation and file uploads via
  `@utils/summary-projects.js` run on their own browser context, so they are correctly absent
  from the video. Leave them there — do not move setup into the test body to put it on screen.

### Screenshot naming

`ac<N>-step<M>-<short-kebab-description>.png`

Examples:

- `ac1-step1-home-page-loaded.png`
- `ac2-step1-form-submitted.png`
- `ac2-step2-success-banner-visible.png`

Take at least one screenshot at the start of each AC and one at the key assertion point.
Prefer `locator.screenshot()` for content evidence (a panel, table or row) and
`page.screenshot({ fullPage: true })` for whole-page context.

### Demo video

One `.webm` per AC, named `ac<N>-demo.webm` from the test title, saved next to that AC's
screenshots. Recording is configured in `playwright.evidence.config.js` — the spec only has to
call the helpers in `test/utils/evidence-video.js`. Each video shows an animated pointer, a
label and highlight on every element acted upon, an opening title card naming the AC, and the
current step's caption.

Two constraints are baked into those helpers; both were established against the running app,
so do not re-litigate them in the generated spec:

- **Captions cannot be styled with CSS.** The frontend sends
  `Content-Security-Policy: style-src 'self'`, and Playwright injects overlay HTML into the
  page's own document, so every `style=` attribute and `<style>` block is dropped by the
  browser. Captions therefore use semantic tags (`<h2>`, `<mark>`) that the user agent styles
  on its own. This is also why `video.show.test` is left off in the config — its built-in
  caption is unreadable under this CSP.
- **The title card must come before the first navigation.** It is styled with inline CSS, so
  it only renders properly while the page is still on `about:blank`.

### Run command

```sh
npm run test:evidence
```

This runs the evidence spec through `playwright.evidence.config.js` at the local base URL
(`http://localhost:3000`); the service must be running first. That config — not the main one —
is what makes the evidence run correct: video recording on, `workers: 1` (concurrent uploads
clobber the shared `pendingUploadId` key), a pinned 1280×800 viewport, and a timeout long
enough for uploads plus the per-action dwell.

### Pass/fail report

After the run, parse the terminal output and produce a summary table. Include a
**GeoPackage file(s)** column naming the `.gpkg` fixture(s) each AC exercised (from
`test/example-files/`); use `—` when the AC involves no file upload:

| AC  | Description | GeoPackage file(s)    | Result      | Screenshots                            | Demo video      |
| --- | ----------- | --------------------- | ----------- | -------------------------------------- | --------------- |
| AC1 | ...         | `valid-baseline.gpkg` | PASS / FAIL | `ac1-step1-...png`, `ac1-step2-...png` | `ac1-demo.webm` |
| AC2 | ...         | —                     | PASS / FAIL | `ac2-step1-...png`                     | `ac2-demo.webm` |

If a test fails, include the error message from the terminal output alongside the result.

---

## Resetting feature-input.md after the run

`feature-input.md` is a working scratchpad, not a record, but it stays populated for the whole life of a ticket: the standard workflow is `/validate-ac-manual` first, then `/validate-ac-automated` against the same extracted ACs.

- **`/validate-ac-manual`** — do **not** reset. Leave the file populated so the automated run can reuse the extraction.
- **`/validate-ac-automated`** — this closes out the ticket. Once the coverage analysis is delivered and any approved test work is finished, restore the blank state by copying `.ai/templates/feature-input.template.md` over `feature-input.md`.

If the user says they are done with the ticket after the manual run alone (no automated run planned), reset then instead.
