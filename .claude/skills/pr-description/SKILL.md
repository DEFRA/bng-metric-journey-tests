---
name: pr-description
description: Writes pull request descriptions. Use when creating a PR, writing a PR, or when the user asks to summarize changes for a pull request.
---

When writing a PR description:

1. Run all three commands to capture every change on this branch — committed, staged, and unstaged:

   - `git diff main...HEAD` — committed changes ahead of main
   - `git diff --cached` — staged changes not yet committed
   - `git diff` — unstaged working tree changes

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

   > "Approve this description? On approval I'll stage and commit locally, then say **push** when ready."

4. On approval — commit locally only (do NOT push yet):

   - Stage any unstaged changes that belong to this PR (`git add` specific files — do not use `git add .` or `git add -A`)
   - Commit using the PR title as the commit message (first line) followed by a blank line and the full description body
   - Confirm with: "Committed locally. Say **push** when ready."

5. When the user says "push":
   - Push the branch with `git push -u origin HEAD`
   - If a PR already exists for this branch, update it with `gh api` PATCH; otherwise create it with `gh pr create`
   - Return the PR URL
