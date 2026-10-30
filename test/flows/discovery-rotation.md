# Discovery Rotation

`/discover-journey-tests` analyses **one flow per run**. Running it over every flow at once
does not work: there isn't enough context for that many flows, so the later ones get a
shallow pass, and the combined approval table is too big to review properly. Instead, the
flows are split into the groups below, and one or two groups are covered each sweep
(roughly fortnightly), so every flow is revisited about every 6–8 weeks.

## How to run a group

1. Confirm the pre-flight (pull images, full suite green) on the first run. Later runs in
   the same session accept that confirmation.
2. Optional: run `/analyse-user-flow <flow>` for each flow in the group first. Discover
   infers edge cases from the flow doc, so rules added since the doc was last refreshed
   are invisible to it (its drift check only catches `[PLANNED]` steps that are now live).
3. Run `/discover-journey-tests <flow>` for each flow in the group, one run per flow,
   back to back in the same session. Flows in a group share helpers and fixtures, so the
   later runs reuse what the first one read.
4. `/discover-journey-tests` sets each flow's **Last discovered** date itself. A group is
   done when every one of its flows carries the sweep's date.

Pick the next group by the oldest **Last discovered** dates and by what changed most in the
frontend/backend since then, not strictly in table order.

## Groups

| Group           | Why together                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| Area            | One unit type end to end; shared area fixtures                                                              |
| Hedgerows       | One unit type end to end; shared hedgerow fixtures                                                          |
| Watercourses    | One unit type end to end; shared watercourse fixtures                                                       |
| Project-level   | Project lifecycle and the pages that sit above the unit types                                               |
| Uploads         | Shared upload entry point and backend error catalogue; discover's Step 3b (error codes vs fixtures) applies |
| Habitat details | Baseline and post-intervention variants of the same detail page                                             |
| Authentication  | One sign-in/session lifecycle; several scenarios are stub-only                                              |

## Flows

| Flow                                                                                            | Group           | Last discovered |
| ----------------------------------------------------------------------------------------------- | --------------- | --------------- |
| [area-baseline](project-management/area-baseline.flow.md)                                       | Area            | —               |
| [area-post-intervention](project-management/area-post-intervention.flow.md)                     | Area            | —               |
| [area-summary](project-management/area-summary.flow.md)                                         | Area            | —               |
| [area-trading-summary](project-management/area-trading-summary.flow.md)                         | Area            | —               |
| [hedgerows-baseline](project-management/hedgerows-baseline.flow.md)                             | Hedgerows       | —               |
| [hedgerows-post-intervention](project-management/hedgerows-post-intervention.flow.md)           | Hedgerows       | —               |
| [hedgerows-summary](project-management/hedgerows-summary.flow.md)                               | Hedgerows       | —               |
| [hedgerows-trading-summary](project-management/hedgerows-trading-summary.flow.md)               | Hedgerows       | —               |
| [watercourses-baseline](project-management/watercourses-baseline.flow.md)                       | Watercourses    | —               |
| [watercourses-post-intervention](project-management/watercourses-post-intervention.flow.md)     | Watercourses    | —               |
| [watercourses-summary](project-management/watercourses-summary.flow.md)                         | Watercourses    | —               |
| [watercourses-trading-summary](project-management/watercourses-trading-summary.flow.md)         | Watercourses    | —               |
| [create-project](project-management/create-project.flow.md)                                     | Project-level   | —               |
| [project-dashboard](project-management/project-dashboard.flow.md)                               | Project-level   | —               |
| [project-details](project-management/project-details.flow.md)                                   | Project-level   | —               |
| [change-project-name](project-management/change-project-name.flow.md)                           | Project-level   | —               |
| [project-summary](project-management/project-summary.flow.md)                                   | Project-level   | —               |
| [project-reports](project-management/project-reports.flow.md)                                   | Project-level   | —               |
| [choose-upload-type](upload-file/choose-upload-type.flow.md)                                    | Uploads         | —               |
| [upload-baseline-file](upload-baseline/upload-baseline-file.flow.md)                            | Uploads         | —               |
| [upload-post-intervention-file](upload-post-intervention/upload-post-intervention-file.flow.md) | Uploads         | —               |
| [habitat-details](habitat-details/habitat-details.flow.md)                                      | Habitat details | —               |
| [post-intervention-habitat-details](habitat-details/post-intervention-habitat-details.flow.md)  | Habitat details | —               |
| [defra-id-login](authentication/defra-id-login.flow.md)                                         | Authentication  | —               |
| [sign-out](authentication/sign-out.flow.md)                                                     | Authentication  | —               |
| [access-denied](authentication/access-denied.flow.md)                                           | Authentication  | —               |
| [session-expired](authentication/session-expired.flow.md)                                       | Authentication  | —               |

## Not in the rotation

- [capture-happy-path](happy-path/capture-happy-path.flow.md) — a local-only UCD screenshot
  export, not a regression journey.
- `*.ac.md` files — AC-coverage companions, not flow docs; no command reads them.

`/analyse-user-flow` adds a new flow doc to the **Flows** table (or renames/removes its row)
as part of its approval; `/discover-journey-tests` adds any flow it finds missing. A flow
doc added or removed by hand still needs this table — and the **Journey Status** table in
[README.md](README.md) — updated manually.
