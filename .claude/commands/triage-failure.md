---
description: Investigate a failing journey test — checks the related flow doc for drift before diagnosing and fixing the test.
---

A journey test failure has been reported.

If `$ARGUMENTS` is empty, ask the user: **"Please paste the failure log or describe the failing test (spec file, test title, and any error output)."** Do not proceed until they reply.

Read `.ai/instructions/triage-failure.md` and follow all steps exactly.

The failure details are: $ARGUMENTS

Do not modify any flow doc or test file until each approval gate is explicitly confirmed.
