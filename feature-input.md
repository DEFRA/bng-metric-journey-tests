# Feature Input

Fill in this template and tell the agent **"New feature input given"**. The agent will run a coverage-gap analysis before writing any test code.

---

## Feature title

BNG-214: Change project name

## Journey

test/flows/change-project-name.flow.md

## What it does

An authenticated user can change the name of an existing project from the project task list. They navigate to a form pre-filled with the current name, update it, and are redirected back to the task list on success.

## Acceptance criteria

1. An authenticated user can view the change project name form, which is pre-filled with the current project name.
2. Submitting a valid new name updates the project and redirects the user to the project task list.
3. Submitting an empty name displays the error "Enter a project name".
4. Submitting a name longer than 1,000 characters displays the error "Project name must be 1000 characters or fewer".
5. Submitting a name containing control characters displays the error "Project name must only contain valid characters".
6. An unauthenticated user attempting to access the form is redirected to sign-in.

## Notes

- Uses the same `projectNameSchema` validation as the create project name flow.
- The form `id` parameter must be a valid UUID — an invalid UUID returns a 400 before reaching the controller.
- A project not found (backend returns 404) throws a `Boom.notFound` — currently out of scope for E2E.
