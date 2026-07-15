---
description: Validate that a development ticket's implementation matches its intent and capture evidence — for non-user-journey tickets. Does not create or modify journey tests.
---

A non-user-journey ticket validation has been requested. This session validates that a ticket's implementation was done as intended and produces evidence — it does **not** author or change journey tests.

**Input source gate:** first, ask the user (via `AskUserQuestion`) how to source the ticket inputs:

- **Jira API** — ask for the ticket key if it is not in `$ARGUMENTS`, then follow `.ai/instructions/jira-extraction.md` to pull everything from the ticket:
  - **Key-details** — key/title, description, requirements, and ACs (scan the populated AC custom fields; parse raw ADF).
  - **PR details** — from the development-info endpoint, remote links, or PR URLs in comments. "No PRs linked" is a valid answer — report it, don't guess.
  - **Supporting documents** — download the ticket's attachments into that ticket's evidence folder under `docs/`.
  - Present a short summary of what was extracted (title, requirement/AC count, PRs, attachments) and confirm with the user before validating. If credentials are missing or the fetch fails, say so and fall back to the manual path.
- **Manual** — the user supplies the inputs, as before. If not already provided in `$ARGUMENTS`, ask for and **wait** for:
  - **Ticket key-details** — the ticket key/title, the key details / requirements, and any acceptance criteria (as text).
  - **PR details** — a screenshot of the PR(s) for the ticket. If the ticket has no PR, the user should say so.
  - **Supporting documents** — any file that aids validation (e.g. an attached HTML widget, a fixture, a spec). Optional.

  Do **not** proceed until the user has supplied the key-details. The PR screenshot and supporting documents are optional — accept whatever is provided and validate against it.

Read `.ai/instructions/validate-adhoc-implementation.md` and follow all steps exactly.

Provided inputs: $ARGUMENTS
