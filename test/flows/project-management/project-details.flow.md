# Project Details User Flow

## Overview

The authenticated user enters or updates supplementary project attributes (Local Planning Authority, survey completer(s), survey completion date, development type, NSIPs classification, applicant) via a form that the project task list linked to. **BMD-1043 (frontend PR#352) removed the task list, and no page links to this form now** — the project summary's "View project details" section has no link — so it is reachable only by URL (open question raised with the team, 2026-10-07). Values persist against the project and pre-fill on return visits; resubmitting updates the same record rather than creating a new one. Note: unlike the baseline/post-intervention task items, the task list's "Project Details" status is hardcoded to "Not yet started" and does not flip to "Completed" once details are saved (`src/server/projects/task-list.njk`).

## Steps

### Step 1 — View project details form `[IMPLEMENTED]`

- **Route:** `GET /project-details/{projectId}`
- **Template:** `src/server/project-details/index.njk`
- **Auth required:** Yes — active session + an approved (status 3) `bng completer` role (pre-method; redirects to `/auth/forbidden` otherwise)
- **Backend endpoint:** `GET /projects/{id}` (fetches the full project; the handler reads `project.details` off the response — no dedicated `GET /projects/{id}/details` call from this route) and `GET /reference/local-planning-authorities` (the LPA list — `{ name, reference }` for each current English LPA, ordered by name; fetched once and memoised for the life of the frontend process, `src/server/common/services/local-planning-authorities.js`)
- **Description:** Renders the form with a back link to the project summary (`/projects/{projectId}/project-summary`; BMD-1043 — it was the removed task list), the project name as a caption, and six fields pre-filled from any previously saved `project.details` values: Local Planning Authority (GOV.UK select `localPlanningAuthorityReference`: a "Select a Local Planning Authority" placeholder with an empty value, selected by default, then one option per LPA with the Planning Data reference as the value and the LPA name as the text; the saved reference is pre-selected), Survey completer(s) (text), Survey completion date (GOV.UK three-part date input: day/month/year), Development type (radios: Small site / Large site), NSIPs (radios: Yes / No — hint "National Significant Infrastructure Project"), Applicant (text). A "Save and continue" button submits the form. A record saved before BMD-1012 (free-text `localPlanningAuthority`, no reference) shows "Previously saved Local Planning Authority: {name}. Select an authority from the list to update it." above the select, which stays on the placeholder.
- **Validation:** None (display-only) — see Step 2 for the schema applied on submit
- **On success:** Renders the form
- **On error:** `Boom.notFound` (404) if the project doesn't exist or isn't visible to the user; `Boom.badGateway` if the backend is unreachable or returns a non-2xx status, or if the LPA list is unreachable, empty or malformed

---

### Step 2 — Submit project details `[IMPLEMENTED]`

- **Route:** `POST /project-details/{projectId}`
- **Template:** `src/server/project-details/index.njk`
- **Auth required:** Yes — same as Step 1
- **Backend endpoint:** `PATCH /projects/{id}/details` — payload is merged into the stored `project.details` via a jsonb `||` merge (`persist-project.js`): omitted keys are left untouched, but a field explicitly sent as `null` overwrites the stored value. Resubmitting the form updates the same record, not create-only.
- **Description:** User submits the six fields listed in Step 1.
- **Validation:**
  - `localPlanningAuthorityReference` — optional; must match `^E600\d{5}$` (error "Select a Local Planning Authority from the list"); the placeholder's empty value normalises to `null`. The backend resolves the reference against its LPA table and saves both `localPlanningAuthority` (the canonical name) and `localPlanningAuthorityReference`; an unknown reference returns 400, which the frontend re-renders as the same error. Because the form always posts the field, saving with the placeholder selected clears both — including a legacy free-text name, even when only another field was edited
  - `surveyCompleters` — string, trimmed, optional, max 500 chars; empty string normalises to `null`
  - `surveyCompletionDate` — posted as three separate day/month/year fields, combined server-side into `DD/MM/YYYY`; all three empty → saves as `null` (valid); some but not all present → error "Survey completion date must include a day/month/year" naming the missing part(s); combined value isn't a real calendar date → error "Survey completion date must be a real date"
  - `developmentType` — optional; must be exactly `"Small site"` or `"Large site"` if provided; empty normalises to `null`
  - `nsips` — optional; must be exactly `"Yes"` or `"No"` if provided; empty normalises to `null`
  - `applicant` — string, trimmed, optional, max 500 chars; empty normalises to `null`
- **On success:** Redirects to `/projects/{projectId}/project-summary` (the project summary; BMD-1043 — it was the removed task list) — 302
- **On error:** Re-renders the form with a GOV.UK error summary and inline field error(s); previously-typed values (including invalid ones) are preserved rather than cleared. A date-fieldset error highlights only the invalid day/month/year sub-field(s) via `govuk-input--error`.
