# Project Details User Flow

## Overview

The authenticated user views and updates a project's details: its name and six supplementary
attributes. BMD-849 (frontend PR#514 / backend PR#642, 2026-11-19) rebuilt the page that
BMD-276 introduced:

- **Entry:** a **"Project details"** item in the left navigation, just before Reports, on every
  page that shows the navigation (project summary, the area, hedgerow and watercourse summaries
  and their Baseline, Post intervention and Trading rules pages, and Reports). The link carries
  the page it was followed from as `returnUrl`. The page is still reachable by URL. The project
  summary's "View project details" section is still unlinked, which is out of scope.
- **Save and Cancel** both return to `returnUrl`. A missing or off-site one (anything but a
  same-site path) falls back to the project summary. A project with no baseline is passed on
  from the summary to `/upload-file` (BMD-1076).
- **Removed:** the Back link, "Save and continue", and the Development type and NSIPs radios.
  Values already saved for those two are left in place.
- Only the project name is mandatory. The other fields become mandatory at final submission,
  which is a later story.

## Steps

### Step 1 — View the project details form `[IMPLEMENTED]`

- **Route:** `GET /project-details/{projectId}?returnUrl={path}` (`returnUrl` optional)
- **Template:** `src/server/project-details/index.njk`
- **Auth required:** Yes. An active session and an approved (status 3) `bng completer` role are
  checked before the handler, and anyone else is redirected to `/auth/forbidden`.
- **Backend endpoints:**
  - `GET /projects/{id}` for the name and `project.details`.
  - `GET /reference/local-planning-authorities` for the `{ name, reference }` of each current
    English authority, ordered by name. It is fetched once and memoised for the life of the
    frontend process. The stack's list has 308 authorities (`bng.local_planning_authorities`).
- **Description:**
  - The left navigation, labelled with the page heading, shows **Project details** as the
    current item (`aria-current="page"`, not a link).
  - H1 **"Project details"**, then the help text: "Enter the details for the project. You do
    not need to add them all straight away, but you will need to complete all of these details
    before you can export your metric."
  - The fields, in this order, each filled from the saved value or empty:
    - **Project name**: text, `maxlength` 1000.
    - **Survey completed by** (`surveyCompleters`): text, 255.
    - **Survey date** (`surveyCompletionDate`): a GOV.UK date input with Day, Month and Year,
      `maxlength` 2, 2 and 4. A saved date fills each box as stored, `DD/MM/YYYY`, so a month
      of 6 shows "06".
    - **Planning permission applicant name** (`applicant`): text, 255.
    - **Local planning authority** (`localPlanningAuthorityReference`): a select with
      "Choose local planning authority" (empty value) first, then one option per authority. The
      option's text is the name and its value is the Planning Data reference. The saved
      reference is selected.
    - **Planning application reference (optional)**: text, 50.
    - **Planning application type (optional)**: text, 100.
  - A **Save** button and a **Cancel** link to `returnUrl`. A hidden `returnUrl` field carries it
    through the POST.
  - A record saved before BMD-1012 (free-text `localPlanningAuthority`, no reference) shows
    "Previously saved local planning authority: {name}. Choose an authority from the list to
    update it." above the select, which stays on the default option.
- **Validation:** none on load. `projectId` must be a UUIDv4 (400 otherwise).
- **On success:** renders the form.
- **On error:** 404 if the project does not exist or is not the user's. 502 if the backend or
  the LPA list is unreachable, empty or malformed.

---

### Step 2 — Change values on the form (display only) `[IMPLEMENTED]`

- Typing, amending or clearing a box changes only that box. The browser stops typing at each
  `maxlength`. Choosing an authority, or the default option, changes only the select.
- Nothing is validated until Save, and nothing is saved until Save.

---

### Step 3 — Save the project details `[IMPLEMENTED]`

- **Route:** `POST /project-details/{projectId}`
- **Template:** `src/server/project-details/index.njk` (re-rendered on a refusal)
- **Auth required:** Yes, as Step 1. CSRF crumb required (403 without).
- **Backend endpoint:** `PATCH /projects/{id}/details` with the name and the details in one
  write (backend PR#642). The details are merged into `project.details` with a jsonb `||`
  merge. A field sent as `null` clears the stored value. The `updated_at` trigger sets the
  project's Last modified, so it moves to the top of the Project dashboard.
- **Validation** (frontend `validation.js`; every field is checked at once, and a problem with
  any of them saves none of them). The errors are listed in field order, each linking to its
  field, and the wording is interim except the project name's:
  - **Project name:** blank after trimming gives "Enter a project name". Over 1000 gives
    "Project name must be 1000 characters or fewer".
  - **Text fields:** each is trimmed, and blank is saved as `null`.
    - Over its limit: "<Field> must be {max} characters or fewer".
    - An invalid character (a control character such as a tab, DEL, or half of a UTF-16
      surrogate pair): "<Field> must only contain valid characters".
  - **Survey date:** all three boxes blank is saved as `null`. Otherwise:

    | Problem                                            | Message                                                    | Highlighted           |
    | -------------------------------------------------- | ---------------------------------------------------------- | --------------------- |
    | One part missing                                   | "Survey date must include a {part}"                        | the missing box       |
    | Two parts missing                                  | "Survey date must include {parts}" (e.g. "month and year") | the missing boxes     |
    | Not digits                                         | "Survey date must only include numbers"                    | the non-numeric boxes |
    | Not a calendar date, or a year that isn't 4 digits | "Survey date must be a real date"                          | —                     |
    | Later than today in the UK                         | "Survey date must be today or in the past"                 | —                     |

    The date is saved as `DD/MM/YYYY`.

  - **Local planning authority:** the default option saves `null`, clearing the name and the
    reference. A reference that does not match `^E600\d{5}$`, or one the backend no longer
    holds (its 400), is refused with "Select a local planning authority from the list".
- **On success:** 302 to `returnUrl` (Step 1), with no success message. The new name shows
  wherever the project name does.
- **On error:** re-renders with a "There is a problem" GOV.UK error summary, which takes focus,
  and an inline error above each field, which is outlined in red. Everything entered is kept,
  and nothing is saved.

## Journey coverage

`test/specs/project-management/project-details.spec.js`:

- **Page content:** a project with only its name saved (AC2), including the authority options
  from the backend list (AC6).
- **Real link:** following the nav link from a real uploaded project's Hedgerows
  post-intervention page, with the current item shown and Cancel returning there (AC1, AC9).
- **Save and refill:** saving every field trimmed and seeing them pre-filled, then
  overwritten (AC3, AC8).
- **Save round trip:** saving from Hedgerows post-intervention, back there under the new name,
  with the project top of the dashboard (AC8).
- **Clearing:** blank fields and the default authority clear every saved value (AC7, AC8).
- **Combined refusal:** a blank name, an invalid character and a partial date (AC10).
- **Unknown authority:** the backend's 400 for an authority it no longer holds (AC10).
- **Access:** role, unauthenticated, 400, not-found, and cross-user 404.

Typing and `maxlength` (AC4, AC5) and each date rule are left to the frontend controller and
`validation.js` tests.
