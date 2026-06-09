---
name: pr-review
description: Reviews pull request changes. Use when asked to review a PR, review code changes, or give feedback on a pull request.
---

When reviewing a PR, follow all steps below in order.

## Step 1 — Gather the diff

Run all three commands to capture every change on this branch — committed, staged, and unstaged:

- `git diff main...HEAD` — committed changes ahead of main
- `git diff --cached` — staged changes not yet committed
- `git diff` — unstaged working tree changes

Combine all three outputs as the full diff to review. If a file appears in multiple outputs, treat the union as the full change to that file.

## Step 2 — Write the review

Output the review in this format:

### Overview

One sentence summarising what the PR does.

### Code Quality

- Comments on correctness, style, and conventions
- Note anything that looks wrong or inconsistent with the codebase patterns

### Issues

- List any bugs, risks, or problems that should be fixed before merging
- If none, write "None identified"

### Suggestions

- Optional improvements — not blocking but worth considering
- If none, write "None"

### Duplication

Scan the diff for duplication at two levels:

**String/value duplication** — any string literal or number that appears 4 or more times across the diff. For each:

- Quote the duplicated value and the count
- Suggest the constant name to extract it to (e.g. `const HABITAT_TYPE_COL = 'Habitat type'`)
- Note which file(s) and approximate lines it appears on

**Logic/pattern duplication** — any block of 3+ lines that repeats with only minor variation (e.g. the same sequence of `expect(...).toHaveAttribute(...)` calls, the same `page.goto` + assertion setup). For each:

- Describe the pattern in one sentence
- Show a concrete before/after: the duplicated lines, then the extracted helper function or constant that replaces them
- Classify as: `const` (simple value), `helper function` (reusable async function), or `page object method` (belongs in a POM class)

If no duplication is found, write "None identified."

## Step 3 — Ask before implementing

After the review output, ask:

> "Would you like me to implement any of the duplication reductions above? I can apply them one at a time or all at once — just say which. Once you're happy with the code, run `/pr-description` to commit and push."

## Step 4 — Implement on request

When the user asks you to implement a reduction:

**For constant extraction:**

1. Add the constant at the top of the file, grouped with other constants, in SCREAMING_SNAKE_CASE
2. Replace all occurrences of the literal with the constant
3. Do not change any other code

**For helper function extraction:**

1. Write the helper as a named `async function` (not an arrow function) directly above the `test.describe` block that uses it
2. Keep the function focused — one responsibility, no more than ~20 lines
3. Use descriptive parameter names that make the call site readable without needing to look at the implementation
4. Replace the duplicated blocks with calls to the helper
5. Do not change any other code

**For page object method extraction:**

1. Add the method to the relevant POM class in `test/pages/`
2. Use camelCase, prefix action methods with a verb (`click`, `select`, `fill`)
3. Replace the duplicated locator chains with calls to the POM method
4. Do not change any other code

**Rules for all implementations:**

- One change at a time unless the user says "all at once"
- Do not rename variables, restructure tests, or add abstractions beyond what was agreed
- Do not add comments explaining the extraction — the name of the constant or function is the documentation
- After each change, confirm what was done in one sentence
