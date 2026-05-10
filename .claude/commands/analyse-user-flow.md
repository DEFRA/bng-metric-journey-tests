---
description: Analyse frontend and backend source for a named user flow and create or update the flow doc in test/flows/.
---

A user flow analysis has been requested.

If `$ARGUMENTS` is empty, ask the user: **"Which flow would you like to analyse? Provide a kebab-case name (e.g. `create-project`) or a brief description of the user journey."** Do not proceed until they reply.

Before doing anything else, ask the user to confirm: **"Have you pulled the latest changes on the `main` branch of both `bng-metric-frontend` and `bng-metric-backend`?"**

If the answer is no, stop and ask them to pull first. Do not proceed until confirmed.

Once confirmed, read `.ai/instructions/analyse-user-flow.md` and follow all steps exactly.

The user flow to analyse is: $ARGUMENTS

This may be a kebab-case flow name (e.g. `create-project`) or a brief natural language description (e.g. "user enters a project name and is redirected to the dashboard"). Both are valid — use it as a hint to identify the relevant routes in `router.js`.

Do not write any files until the analysis is approved.
