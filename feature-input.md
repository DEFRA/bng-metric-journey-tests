# Feature Input

Fill in this template, then run `/validate-ac-automated` to check coverage and get recommendations, or `/validate-ac-manual` to run ACs in a browser and capture evidence.

---

## Feature title

BNG-XXX: Change project name

## Journey

test/flows/project-management/change-project-name.flow.md

## What it does

An authenticated user with the BNG completer role can change the name of an existing project from the task list. The form is pre-populated with the current name. On success the user is returned to the project task list. Validation prevents empty, too-long, and invalid names.

## Acceptance criteria

1. Authenticated user with BNG completer role can view the change project name form, pre-populated with the current project name
2. Valid name update redirects the user to the project task list
3. Submitting an empty name shows "Enter a project name" error
4. Submitting a name over 1000 characters shows "Project name must be 1000 characters or fewer" error
5. Submitting a name with control characters shows "Project name must only contain valid characters" error
6. Unauthenticated user visiting `/change-project-name/{id}` is redirected to sign-in
7. Authenticated user without BNG completer role is redirected to `/auth/forbidden`

## Notes

- Routes: `GET /change-project-name/{id}` and `POST /change-project-name/{id}`
- `{id}` is a UUID — the route param is validated
- Backend endpoints: `GET /projects/{id}` (fetch current name), `PATCH /projects/{id}` (update name)
