---
description: Analyse backend integration test coverage for a named user flow and recommend enhancements. The only command that may modify sibling service repositories.
---

An integration coverage analysis has been requested. Read `.ai/instructions/verify-integration-coverage.md` and follow all steps exactly.

The user flow to analyse is: $ARGUMENTS

This may be a kebab-case flow name (e.g. `create-project`) or a brief natural language description. Use it to locate the matching flow doc in `test/flows/`. If the description is ambiguous, list the available flow files and ask the user to confirm which one before proceeding.

Do not modify any file until the coverage analysis is approved.

**Important:** This command may write to `../bng-metric-backend/integration-tests/` after approval. It must not modify any file in `../bng-metric-frontend/` or in this repository.
