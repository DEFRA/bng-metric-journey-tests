---
name: pr-review
description: Reviews pull request changes. Use when asked to review a PR, review code changes, or give feedback on a pull request.
---

When reviewing a PR:

1. Run `git diff main...HEAD` to see all changes on this branch
2. Write a review following this format:

## Overview

One sentence summarising what the PR does.

## Code Quality

- Comments on correctness, style, and conventions
- Note anything that looks wrong or inconsistent

## Issues

- List any bugs, risks, or problems that should be fixed before merging
- If none, write "None identified"

## Suggestions

- Optional improvements — things that are not blocking but worth considering
- If none, write "None"
