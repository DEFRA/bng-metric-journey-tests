# Feature Input

Fill in this template, then run `/validate-ac-automated` to check coverage and get recommendations, or `/validate-ac-manual` to run ACs in a browser and capture evidence.

---

## Feature title

As a user
I want to see a dashboard listing my previously saved projects
so that I can select a single project to view or create a new project

## Journey

test/flows/create-project.flow.md

## What it does

<!-- Observable user behaviour — no implementation detail. What does the user see and do? -->

## Acceptance criteria

Acceptance Criteria

Preconditions (GIVENs that apply to all acceptance criteria)

User has permissions to view the project dashboard

User has permissions to view all actions/CTAs on the page

Ref

AC Summary

GIVEN

WHEN

THEN

AC3

On Page Load:
User has saved projects

GIVEN the user has at least one saved project

WHEN the project dashboard page is loaded

THEN the following is displayed

Page Heading: “Projects”  
Changed by BMD-409

CTA: “Create New Project”  
Changed by BMD-409

Project table, with the following column headings:

“Project Name”

“Last Modified”

“Date Created”

AC4

On Page Load:
Default Sort Sequence

GIVEN the user has two or more saved projects

WHEN the project dashboard page is loaded

THEN the default sort sequence of the projects is:

Last modified, descending (most recent first)

Note: The sort uses the underlying timestamp - not the user-friendly “X days/months/years ago” text displayed to the user

AC5

On Page Load:
“Project Name” data

GIVEN the user has at least one saved project

WHEN the project dashboard page is loaded

THEN for each saved project (each row in the data table), the “Project Name” column contains the name of the project

AC6

On Page Load:
“Last modified” data column

GIVEN the user has at least one saved project

WHEN the project dashboard page is loaded

THEN for each saved project (each row in the data table)

The “Last modified” column contains the timestamp of the last modification of the project. Where there have been no updates since the project was created, this contains the last timestamp

Format: [Day] [Month name] at [Hour.Minute] [am/pm]
Where Hour = 12 hour format  
Example: 7 April 2026 at 2.40 pm

AC7

On Page Load:
“Created” data column

GIVEN the user has at least one saved project

WHEN the project dashboard page is loaded

THEN for each saved project (each row in the data table), the following is shown within the “Created” column

The date the project was created (i.e. when the user completed the process of selecting “Create Project”, and submitting a valid Project Name)

Format: [Day] [Month name] [YYYY]  
Example: 12 April 2025

## Notes

<!-- Optional: known exclusions, affected routes, design references, data requirements -->
