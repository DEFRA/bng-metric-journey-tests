---
description: Analyse journey test coverage for a named user flow and recommend new tests or enhancements, including edge cases.
---

A journey test discovery has been requested.

If `$ARGUMENTS` is empty, ask the user: **"Which flow would you like to analyse? Provide a kebab-case name (e.g. `create-project`) or a brief description of the user journey."** Do not proceed until they reply.

Read `.ai/instructions/discover-journey-tests.md` and follow all steps exactly.

The user flow to analyse is: $ARGUMENTS

This may be a kebab-case flow name (e.g. `create-project`) or a brief natural language description. Use it to locate the matching flow doc in `test/flows/`. If the description is ambiguous, list the available flow files and ask the user to confirm which one before proceeding.

Do not write any test code until the gap analysis is approved.
