# Coverage Boundaries — Reference

Shared reference for `/discover-journey-tests` and `/validate-ac-automated`.

Before recommending a new journey test, decide whether it belongs in this suite at all.
This file is the rule for that decision. It exists because a journey test is the most
expensive test we own — an upload-backed one costs up to 120 s — so writing one that
another suite already covers is a real cost, and deleting one that nothing else covers
is a real risk.

---

## What each suite can and cannot see

| Suite                                                            | Entry point                      | Sees                                               | Blind to                                  |
| ---------------------------------------------------------------- | -------------------------------- | -------------------------------------------------- | ----------------------------------------- |
| Backend integration (`../bng-metric-backend/integration-tests/`) | `server.inject()` into Hapi      | routes → services → Postgres/PostGIS, S3, uploader | **everything the user sees**              |
| Frontend unit (`../bng-metric-frontend/src/**/*.test.js`)        | `createServer()`, `wreck` mocked | rendered Nunjucks markup, controller logic         | **whether the backend really sends that** |
| Journey (this repo)                                              | real browser                     | the whole chain, with real data                    | —                                         |

Two consequences that drive every decision below:

- **Integration tests never render.** They can substitute for a journey test's _rule_
  assertion, never for its rendering, wiring, or copy.
- **Frontend unit tests mock the backend client.** They cannot catch backend contract
  drift — rename a field and they keep passing against stale mocks while the page breaks.

Journey tests are the only place the two halves meet. That is what they are for.

---

## Step A — Is the outcome browser-observable?

If the success/error outcome has **no UI surface** — a DB trigger, an audit row, an async
side-effect — it is out of scope for a journey test. Do not recommend one.

Record it instead as a **backend coverage proposal** (see "Annotations" below). Do not
route it to `/verify-integration-coverage`; that command is **dormant** and must not
appear in any recommendation.

## Step B — Is the rule already covered outside this suite?

Search both sibling suites for the behaviour, and record file:line for whatever you find.
A matching test **name** is not evidence — open it.

Two traps, both of which have produced wrong answers before:

**Mapping is not detection.** Check where the counterpart test's input comes from:

| The test is handed…                              | It proves…                   | Still needs a journey witness for… |
| ------------------------------------------------ | ---------------------------- | ---------------------------------- |
| a fabricated object (`{ code: 'X', message }`)   | the mapping/rendering of `X` | **that `X` is ever emitted**       |
| real service output, or the code path under test | both                         | —                                  |

Nearly every frontend copy/formatter unit test is the first kind. "A unit test asserts
this string" is not "a unit test proves this code path runs."

**A shared module is not shared coverage** when it is parameterised per flow. If a check
is called as `doCheck(data, variant)`, a test of the module proves the variant's logic but
not that the caller passes the right variant. Check the propagation, not just the module.

Also note the inverse, which is common: a rule may be covered against **synthetic input**
(e.g. PostGIS validation tests built from coordinate literals) while nothing proves a real
uploaded file reaches it. That is not coverage of the parse path.

## Step C — Decide

| Situation                                                                                                     | Recommendation                           |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Not browser-observable (Step A)                                                                               | **Backend proposal** — no journey test   |
| Rule covered elsewhere **and** an existing journey test already witnesses this rendering shape with real data | **Skip** — name the sibling test         |
| Rule covered elsewhere but **no** journey test renders this shape from real data                              | **Write E2E** — it is the wiring witness |
| Rule not covered anywhere                                                                                     | **Write E2E** + backend proposal         |

The middle two rows are the important distinction. Covered-elsewhere alone never justifies
skipping: ask whether _this rendering shape_ already has a real-data witness.

---

## The coverage floor

Whatever else the analysis concludes, this must hold:

> For every data family the page renders, at least one journey test must render it
> **from real data** (a real upload, a real save, a real backend response).

"Data family" means a distinct thing the backend produces — a summary total, a row's
fields, an error code, a computed unit value, a status. Variants of one family
(three sort directions, twelve error codes sharing one layout) need one witness, not
twelve. Distinct families need one each, even when they render through identical code —
if the _data_ is produced by separate backend paths, each path needs its own witness.

Never recommend removing or skipping the last real-data witness for a family.

---

## Annotations (required)

Because `/verify-integration-coverage` is dormant, a gap found in a sibling suite cannot
be closed by writing there. Record it where the next reader will see it instead.

**When a journey test is the only witness for a behaviour**, add a comment on the test
saying so, naming what is missing and what would make the test redundant:

```js
// Sole witness for GPKG_RLB_TOO_MANY_POLYGONS. Raised in the parse layer
// (backend src/validation/geopackage/geopackage-internals-validate-features.js);
// no backend unit test and no integration fixture reference the code. Do not
// delete without adding a >1-polygon RLB fixture to
// ../bng-metric-backend/integration-tests/fixtures/ first.
```

Say **what would break if it were deleted**, not just "keep this" — the judgement should
be re-derivable rather than taken on trust.

**In the analysis output**, add a short **Backend coverage proposals** section listing each
gap: the behaviour, where it should live, and which journey test currently stands in for
it. This is the hand-off to the service team; it is not work this repo performs.
