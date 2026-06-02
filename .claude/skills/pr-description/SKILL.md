---
name: pr-description
description: Writes pull request descriptions. Use when creating a PR, writing a PR, or when the user asks to summarize changes for a pull request.
---

When writing a PR description:

1. Run `git diff main...HEAD` to see all changes on this branch
2. Write a description following this format:

## What

One sentence explaining what this PR does.

## Why

Brief context on why this change is needed

## Changes

- Bullet points of specific changes made
- Group related changes together
- Mention any files deleted or renamed

3. After outputting the description, ask:

   > "Approve this description? On approval I'll commit all staged changes, push the branch, and create the PR."

4. On approval:
   - Stage any unstaged changes that belong to this PR (`git add` specific files — do not use `git add .` or `git add -A`)
   - Commit using the PR title as the commit message (first line) followed by a blank line and the full description body
   - Push the branch with `git push -u origin HEAD`
   - Create the PR using `gh pr create` with the approved title and description body
   - Return the PR URL
