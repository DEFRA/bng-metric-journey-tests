# Discovery Rotation

`/discover-journey-tests` analyses **one flow per run**. Running it over every flow at once
does not work: there isn't enough context for that many flows, so the later ones get a
shallow pass, and the combined approval table is too big to review properly. Instead, the
flows are split into the groups below, and one or two groups are covered each sweep
(roughly fortnightly), so every flow is revisited about every 6–8 weeks.

## How to run a group

1. Do the pre-flight once (pull images, full suite green).
2. Optional: run `/analyse-user-flow <flow>` for each flow in the group first. Discover
   infers edge cases from the flow doc, so rules added since the doc was last refreshed
   are invisible to it (its drift check only catches `[PLANNED]` steps that are now live).
3. Run `/discover-journey-tests <flow>` for each flow in the group, one run per flow,
   back to back in the same session. Flows in a group share helpers and fixtures, so the
   later runs reuse what the first one read.
4. `/discover-journey-tests` sets the group's **Last discovered** date itself, to the date
   of its most recent run on any flow in the group.

Pick the next group by what changed most in the frontend/backend since its last run, not
strictly in table order.

## Groups

| Group           | Flows                                                                                                                                                                                                                                                                                                                                                                                              | Why together                                                                                                | Last discovered |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------- |
| Area            | [area-baseline](project-management/area-baseline.flow.md), [area-post-intervention](project-management/area-post-intervention.flow.md), [area-summary](project-management/area-summary.flow.md), [area-trading-summary](project-management/area-trading-summary.flow.md)                                                                                                                           | One unit type end to end; shared area fixtures                                                              | —               |
| Hedgerows       | [hedgerows-baseline](project-management/hedgerows-baseline.flow.md), [hedgerows-post-intervention](project-management/hedgerows-post-intervention.flow.md), [hedgerows-summary](project-management/hedgerows-summary.flow.md), [hedgerows-trading-summary](project-management/hedgerows-trading-summary.flow.md)                                                                                   | One unit type end to end; shared hedgerow fixtures                                                          | —               |
| Watercourses    | [watercourses-baseline](project-management/watercourses-baseline.flow.md), [watercourses-post-intervention](project-management/watercourses-post-intervention.flow.md), [watercourses-summary](project-management/watercourses-summary.flow.md), [watercourses-trading-summary](project-management/watercourses-trading-summary.flow.md)                                                           | One unit type end to end; shared watercourse fixtures                                                       | —               |
| Project-level   | [create-project](project-management/create-project.flow.md), [project-dashboard](project-management/project-dashboard.flow.md), [project-details](project-management/project-details.flow.md), [change-project-name](project-management/change-project-name.flow.md), [project-summary](project-management/project-summary.flow.md), [project-reports](project-management/project-reports.flow.md) | Project lifecycle and the pages that sit above the unit types                                               | —               |
| Uploads         | [choose-upload-type](upload-file/choose-upload-type.flow.md), [upload-baseline-file](upload-baseline/upload-baseline-file.flow.md), [upload-post-intervention-file](upload-post-intervention/upload-post-intervention-file.flow.md)                                                                                                                                                                | Shared upload entry point and backend error catalogue; discover's Step 3b (error codes vs fixtures) applies | —               |
| Habitat details | [habitat-details](habitat-details/habitat-details.flow.md), [post-intervention-habitat-details](habitat-details/post-intervention-habitat-details.flow.md)                                                                                                                                                                                                                                         | Baseline and post-intervention variants of the same detail page                                             | —               |
| Authentication  | [defra-id-login](authentication/defra-id-login.flow.md), [sign-out](authentication/sign-out.flow.md), [access-denied](authentication/access-denied.flow.md), [session-expired](authentication/session-expired.flow.md)                                                                                                                                                                             | One sign-in/session lifecycle; several scenarios are stub-only                                              | —               |

## Not in the rotation

- [capture-happy-path](happy-path/capture-happy-path.flow.md) — a local-only UCD screenshot
  export, not a regression journey.
- `*.ac.md` files — AC-coverage companions, not flow docs; no command reads them.

`/analyse-user-flow` places a new flow doc in a group (or renames/removes it here) as part
of its approval; `/discover-journey-tests` adds any flow it finds missing. A flow doc added
or removed by hand still needs this table — and the **Journey Status** table in
[README.md](README.md) — updated manually.
