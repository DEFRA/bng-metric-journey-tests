# Upload Post-Intervention — Acceptance Criteria

Mirror of the `upload-baseline` acceptance criteria, adapted to the post-intervention
flow (routes, session keys, backend path, page copy). Each section corresponds to one
workshop title and is combined from the linked baseline Jira ticket(s), then reconciled
against the **live implementation** (this is a regression suite for shipped behaviour).

**Conventions**

- `PI-<TITLE>-<n>` — acceptance criterion ref.
- Coverage markers: ✅ covered · 🟡 partial · ❌ gap — snapshot at authoring time;
  the authoritative gap analysis is produced per title by `/validate-ac-automated`.
- Flow reference: [upload-post-intervention-file.flow.md](upload-post-intervention-file.flow.md).

---

## 1. Trigger

**Source (baseline):** BMD-247 — "2.20 Project Task List [Skeleton Page Layout]"
(superseded by BMD-410 content change; title change BMD-455).

**Entry point:** the "On-site post intervention habitats" task on the project task list
page, `GET /add-project-details/{id}` — shared with baseline. Clicking the task launches
the post-intervention upload journey.

**Precondition:** signed-in, approved BNG Completer, with ≥1 project, viewing that
project's task list.

| Ref       | Acceptance criterion                                                                                                                                              | Coverage                                                                                                                          |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| PI-TRIG-1 | The task list shows a task titled "On-site post intervention habitats".                                                                                           | ✅                                                                                                                                |
| PI-TRIG-2 | Before upload, the task links to `/projects/{id}/upload-post-intervention-file`.                                                                                  | ✅ href asserted                                                                                                                  |
| PI-TRIG-3 | Clicking the task navigates to the post-intervention upload form (starts the journey).                                                                            | ✅ [project-task-list.spec.js](../../specs/project-management/project-task-list.spec.js) — "task item navigation"                 |
| PI-TRIG-4 | Before upload, the task status is "Not yet started" (blue tag).                                                                                                   | ✅ row-scoped assertion in the "page content" test                                                                                |
| PI-TRIG-5 | After a successful upload, the task shows "Completed" and links to `/projects/{id}/post-intervention-habitat-list`.                                               | ❌ gap — verified end-to-end via the **Happy Path** title; not a standalone Trigger test                                          |
| PI-TRIG-6 | Shared page guards apply: unauthenticated → sign-in; no BNG Completer role → `/auth/forbidden`; non-UUID id → 400; unknown project UUID hides the task-list body. | ✅ covered at page level ([project-task-list.spec.js](../../specs/project-management/project-task-list.spec.js)); not re-mirrored |

**Implemented for this title:** PI-TRIG-3 — a click-navigation test on the post-intervention
task row (mirrors the baseline row test) — plus a row-scoped "Not yet started" assertion for
PI-TRIG-4, both in
[project-task-list.spec.js](../../specs/project-management/project-task-list.spec.js).
PI-TRIG-5 is realised by the Happy Path upload and is asserted there, not duplicated here.

**Footnote (provenance):** BMD-247 AC3/AC6 specified a grey "Cannot start yet" state for
the post-intervention task until baseline completion. Post-intervention development has since
progressed and the live app does not gate the task — it is always an active "Not yet started"
link. The gating is treated as superseded and is intentionally **not** an AC.
