# Project Details User Flow

## Overview

The authenticated user views and updates the project's details: its name, who completed the survey and when, the planning permission applicant, the local planning authority, and the planning application's reference and type. BMD-849 replaced the BMD-276 form (which also asked for development type and NSIPs, and had no project name): the page now sits in the project's left-hand navigation, as a "Project details" item just before "Reports" on every page that shows the navigation, and it keeps that navigation itself. Save and Cancel return to the page the user followed the "Project details" link from, which the link carries as `returnUrl`. All fields are checked together on Save, and a problem with any of them saves none of them. The project summary's "View project details" section is still text with no link.

## Steps

### Step 1 — View project details `[IMPLEMENTED]`

- **Route:** `GET /project-details/{projectId}?returnUrl={path}`
- **Template:** `src/server/project-details/index.njk`
- **Auth required:** Yes — active session + an approved (status 3) `bng completer` role (pre-method; redirects to `/auth/forbidden` otherwise)
- **Backend endpoint:** `GET /projects/{id}` (the name, `project.details`, and the documents the navigation is built from) and `GET /reference/local-planning-authorities` (the LPA list — `{ name, reference }` for each current English LPA, ordered by name; memoised for the life of the frontend process)
- **Description:** Left navigation with "Project details" current, heading "Project details", the help text "Enter the details for the project. You do not need to add them all straight away, but you will need to complete all of these details before you can export your metric.", then, in order: Project name (pre-filled), Survey completed by, Survey date (day/month/year), Planning permission applicant name, Local planning authority (select, placeholder "Choose local planning authority"; option values are Planning Data references), Planning application reference (optional), Planning application type (optional). A "Save" button and a "Cancel" link to `returnUrl`. Each input has a `maxlength`: name 1000, survey completed by 255, day 2, month 2, year 4, applicant 255, reference 50, type 100. A record saved before BMD-1012 (free-text `localPlanningAuthority`, no reference) shows "Previously saved local planning authority: {name}. Choose an authority from the list to update it." above the select.
- **`returnUrl`:** a same-site path; anything else (missing, absolute, protocol-relative) falls back to `/projects/{projectId}/project-summary`
- **On error:** 400 for a non-UUIDv4 id; `Boom.notFound` (404) if the project doesn't exist or isn't visible; `Boom.badGateway` (502) if the backend or the LPA list is unreachable

---

### Step 2 — Save project details `[IMPLEMENTED]`

- **Route:** `POST /project-details/{projectId}`
- **Backend endpoint:** `PATCH /projects/{id}/details` with `name` beside the details. The backend writes the name to `project.name` and merges the details into `project.details` in one UPDATE, so either all of it is saved or none of it is. Every field is sent: a blank one as `null`, which clears its saved value.
- **Validation (all fields at once, errors listed in field order):**
  - Project name — required once trimmed ("Enter a project name"), max 1000, valid characters
  - Survey completed by, applicant name — max 255; reference — max 50; type — max 100; each trimmed, valid characters ("… must only contain valid characters")
  - Survey date — all blank saves `null`; some blank: "Survey date must include a {part}" / "… include {parts}"; not digits: "Survey date must only include numbers"; not a calendar date or a year not 4 digits: "Survey date must be a real date"; after today (UK): "Survey date must be today or in the past". Only the boxes at fault are highlighted.
  - Local planning authority — must match `^E600\d{5}$`; the backend's 400 for an unknown reference is shown as "Select a local planning authority from the list", and nothing is saved
- **On success:** 302 to `returnUrl` (or the project summary). No success message. The `updated_at` trigger moves the project to the top of the dashboard.
- **On error:** 200, the form again with a "There is a problem" summary (focused) linking to each field, inline errors, every value as entered, and the same `returnUrl`

---

### Cancel `[IMPLEMENTED]`

- A link to `returnUrl`; nothing is posted or saved.
