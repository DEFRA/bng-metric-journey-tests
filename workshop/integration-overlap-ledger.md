# Integration ↔ Journey Test Overlap — Ledger

Workshop goal: remove journey tests from `bng-metric-journey-tests` that are sufficiently
covered by backend integration tests in `bng-metric-backend/integration-tests/`.

## Verdict key

| Verdict | Meaning                                                                                                                       | Action                            |
| ------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **A**   | True duplicate — asserts a backend rule only; no rendering/wiring/copy proven that another journey test doesn't already prove | delete                            |
| **B**   | Redundant variant — one of N enumerated cases of a single rule                                                                | keep 1 representative, delete N−1 |
| **C**   | Overlapping but not redundant — proves rendering/copy/wiring the other suite cannot see                                       | keep                              |
| **D**   | No overlap — pure frontend                                                                                                    | keep                              |

Guardrails: delete only against a _verified_ counterpart test (file:line recorded);
never delete the last journey test exercising an endpoint.

---

## Chunk 1 — `upload-baseline` (53 collected tests, 4 files)

### Structural finding that governs this chunk

`integration-tests/postgis-validate-baseline-layers.test.js` (33 tests) does **not**
run the upload pipeline. It imports `validateGeoPackageLayersPostgis()` and calls it
directly with **synthetic GeoJSON** built from coordinate constants
(`integration-tests/postgis-validate-baseline-layers.test.js:1-120`). It proves the
topology _rules_ against a real PostGIS, but never exercises
upload → cdp-uploader → S3 → GeoPackage parse → validate → persist.

Consequence: it substitutes for a journey test's **rule** assertion, but not for its
**parse-path** assertion. Journey tests whose fixture defect is _structural_ (layer
names, columns, geometry column type, duplicate refs) have no integration counterpart
at all. Journey tests whose fixture defect is _topological_ (self-intersection,
outside-redline, area sums) do.

### Provenance of the asserted strings

The decisive question for every error-page test was where the asserted copy lives:

| Assertion style                                                             | Source                                                                                                                                                                                       | Already unit-tested at                                                                                           |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Multi-error summary text (`'…not entirely within the redline boundary'`)    | **backend** `src/validation/geopackage/postgis/error-builders.js` — frontend renders `err.message` verbatim, split on `': '` (`bng-metric-frontend/src/server/error-file/controller.js:114`) | `bng-metric-backend/src/validation/geopackage/postgis/error-builders.test.js`                                    |
| Single-error page copy (`'This hedgerow is outside the red line boundary'`) | **frontend** `src/server/error-file/single-error-copy.js`                                                                                                                                    | `bng-metric-frontend/src/server/error-file/single-error-copy.test.js` — 21 tests covering **all 20** error codes |

So the single-error journey tests duplicate a _frontend unit test_, not an integration
test — a real duplication, but not the one this workshop set out to find. Recorded here
because the remedy (delete the redundant variants) is the same.

---

### Ledger — `upload-baseline-file.spec.js` (7)

| #   | Test                                                     | Verdict | Evidence / reason                                                              |
| --- | -------------------------------------------------------- | ------- | ------------------------------------------------------------------------------ |
| 1   | form display — heading, caption, input, Continue, Cancel | D       | pure frontend render                                                           |
| 2   | Back link → upload type selection page                   | D       | frontend navigation (BMD-850)                                                  |
| 3   | Cancel link → upload type selection page                 | D       | frontend navigation                                                            |
| 4   | Continue with no file → required-file error              | D       | client-side JS validation, no HTTP                                             |
| 5   | non-.gpkg selected → wrong-extension error               | D       | client-side JS validation, no HTTP                                             |
| 6   | role enforcement → `/auth/forbidden`                     | D       | frontend redirect; backend RBAC (`defra-id-rbac.test.js`) is a different layer |
| 7   | unauthenticated → sign-in                                | D       | frontend auth wiring                                                           |

### Ledger — `error-file.spec.js` (2)

| #   | Test                                                         | Verdict | Evidence / reason                                               |
| --- | ------------------------------------------------------------ | ------- | --------------------------------------------------------------- |
| 8   | direct nav without session → generic message + Back to start | D       | frontend session branch; **the generic-variant representative** |
| 9   | unauthenticated → sign-in                                    | D       | frontend auth wiring                                            |

### Ledger — `upload-received.spec.js` (2)

| #   | Test             | Verdict | Evidence / reason |
| --- | ---------------- | ------- | ----------------- |
| 10  | role enforcement | D       | frontend          |
| 11  | unauthenticated  | D       | frontend          |

### Ledger — `upload-baseline.spec.js` (42)

#### Keep — anchors and frontend-only behaviour

| #   | Test                                                                 | Verdict | Evidence / reason                                                                                                                                                                         |
| --- | -------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12  | happy path → habitat list + task list Completed                      | C       | the wiring anchor for the whole domain; must survive                                                                                                                                      |
| 13  | re-upload discards PI data, resets task list row                     | C       | `baseline-persistence.test.js` AC4 proves the _data_ removal; the task-list row reset is frontend-rendered and pinned deliberately. Costs 3 uploads — restructure candidate, not a delete |
| 14  | upload-received without pending upload → redirect to form            | D       | frontend session (`pendingUploadId`)                                                                                                                                                      |
| 15  | cross-user upload reaches misleading catch-all                       | C       | integration proves 404-on-write; the _point_ is the frontend does not propagate it                                                                                                        |
| 16  | non-GeoPackage → flash error on upload form                          | C       | distinct frontend branch (flash + redirect to form, **not** `/error-file`)                                                                                                                |
| 17  | content errors → multi-error summary on error-file                   | C       | **multi-error grouped layout representative**                                                                                                                                             |
| 20  | parcel < 1 m² names parcel and area                                  | C       | renders `details.sample` per-parcel (`Feature Ref X — ~0.7 sq m`) — the only test of that rendering shape                                                                                 |
| 21  | SLIVERS suppressed when AREA_PARCELS_OUTSIDE_REDLINE present         | C       | frontend `visibleErrors` de-duplication (PR#160), not a backend rule                                                                                                                      |
| 22  | High distinctiveness → distinctiveness single-error page             | C       | **single-error standard-variant representative** (@smoke); asserts PR#175 furniture removal                                                                                               |
| 23  | habitats layer with incorrect geometry → "Zero area habitat parcels" | C       | GeoPackage **parse** path — no postgis counterpart (synthetic geometry)                                                                                                                   |
| 24  | habitats layer with missing column → "baseline mismatch"             | C       | parse path — no counterpart                                                                                                                                                               |
| 25  | duplicate habitat refs → catch-all single-error                      | C       | parse path; `DUPLICATE_HABITAT_REF` absent from postgis suite                                                                                                                             |

#### Delete — B (redundant variants of one rule/shape)

| #   | Test                                            | Verdict  | Verified counterpart                                                                                                                               |
| --- | ----------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 18  | 0.32 m² gap accepted → habitat list             | B        | `postgis-validate-baseline-layers.test.js` → _"accepts a small gap left between the parcels and the redline"_; the persistence half duplicates #12 |
| 19  | parcels not tiling redline → area-sum rejection | B        | same file → _"detects area sum mismatch"_; placeholder variant also covered by #38                                                                 |
| 26  | redline outside England (multi-error)           | B        | same file → _"detects redline outside England"_; placeholder variant also covered by #37                                                           |
| 27  | self-intersecting redline                       | **keep** | retained as the redline-level geometric representative                                                                                             |
| 28  | self-intersecting (bowtie) parcel               | B        | same file → _"detects invalid area habitat geometry"_                                                                                              |
| 29  | hedgerow outside redline                        | B        | same file → _"detects hedgerows outside the redline"_ + boundary-tolerance tests                                                                   |
| 30  | watercourse outside redline                     | B        | same file → _"detects watercourses outside the redline"_ + tolerance tests                                                                         |
| 31  | tree outside redline                            | B        | same file → _"detects trees outside the redline"_ + tolerance tests                                                                                |

Summary strings for #26–31 are backend-owned and already asserted in
`error-builders.test.js`; the frontend renders them verbatim.

#### `SINGLE_ERROR_CASES` (12) — keep 4 layout representatives, delete 8

All 12 duplicate `bng-metric-frontend/src/server/error-file/single-error-copy.test.js`.
Retain one per rendered variant to prove the resolver is wired into the page.

| #   | Test                                           | Verdict  | Reason                                                                     |
| --- | ---------------------------------------------- | -------- | -------------------------------------------------------------------------- |
| 32  | missing redline boundary                       | **keep** | standard-variant representative; carries `assertNavigation` (BMD-405 AC13) |
| 33  | multiple redline boundaries                    | B        | standard variant, covered by #32 + unit test                               |
| 34  | file without habitat parcels                   | B        | standard variant                                                           |
| 35  | wrong column names → Natural England catch-all | **keep** | catch-all representative + parse-path fixture                              |
| 36  | self-intersecting redline alone                | B        | standard variant                                                           |
| 37  | self-intersecting parcel alone                 | **keep** | personalised (ref-interpolated H1) representative                          |
| 38  | overlapping parcels alone                      | B        | personalised variant, covered by #37                                       |
| 39  | hedgerow outside alone                         | B        | personalised variant                                                       |
| 40  | watercourse outside alone                      | B        | personalised variant                                                       |
| 41  | redline outside England alone                  | **keep** | placeholder-variant representative                                         |
| 42  | area sum mismatch alone                        | B        | placeholder variant, covered by #41                                        |
| 43  | parcel outside redline alone                   | B        | personalised variant                                                       |

#### Skipped placeholders — A (delete outright, zero coverage loss)

These wait on fixtures that do not exist. The behaviour each would prove is **already
fully covered** by frontend unit tests, so building the fixtures would buy nothing.

| #   | Skipped test                      | Verdict | Already covered at                                                                                              |
| --- | --------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| 44  | sliver geometry alone             | A       | `single-error-copy.test.js` — `SLIVERS_OUTSIDE_REDLINE`                                                         |
| 45  | parcel below minimum area alone   | A       | `single-error-copy.test.js` — `AREA_PARCELS_TOO_SMALL`                                                          |
| 46  | IGGI outside alone                | A       | `single-error-copy.test.js` — `IGGIS_OUTSIDE_REDLINE`                                                           |
| 47  | tree outside alone                | A       | `single-error-copy.test.js` — `TREES_OUTSIDE_REDLINE`                                                           |
| 48  | redline area too large alone      | A       | `single-error-copy.test.js` — `REDLINE_AREA_TOO_LARGE`                                                          |
| 49  | overlap without both feature refs | A       | `single-error-copy.test.js:137-143` — asserts the exact `'Some parcels in this file are overlapping…'` fallback |
| 50  | truncated "… and N more" sample   | A       | `controller.test.js:127-131` and `:334` — asserts the `(and 1 more)` tail                                       |

#### Skipped placeholders — keep

| #   | Skipped test                | Verdict | Reason                                                           |
| --- | --------------------------- | ------- | ---------------------------------------------------------------- |
| 51  | CDP Uploader rejection      | keep    | no integration coverage of the `rejected` status branch          |
| 52  | upload check timeout (120s) | keep    | frontend-only `MAX_WAIT_SECONDS` branch, uncovered anywhere      |
| 53  | irreplaceable habitat       | keep    | feature not built — placeholder for future work, not a duplicate |

---

### Chunk 1 outcome

| Verdict                           | Count  |
| --------------------------------- | ------ |
| A — delete (skipped placeholders) | 7      |
| B — delete (redundant variants)   | 15     |
| C / D / keep                      | 31     |
| **Total examined**                | **53** |

**22 tests removed — 15 of them executing.** All 15 executing deletions are
upload-driven (each polls the uploader up to 120s), so this is the domain's most
expensive tranche. The 7 skipped deletions also retire 7 fixture-engineering tasks
that were queued against already-covered behaviour.

Applied: `RUN_MODE=github npx playwright test --list test/specs/upload-baseline/`
reports **31 tests in 4 files** (was 53).

### Fixtures

15 `.gpkg` fixtures (9.1 MB) became unreferenced and were removed with `git rm`
(recoverable from history if a deleted test is ever restored).

Two fixtures were **already** orphaned before this chunk and were left in place as
out of scope — flag if they are also dead:

- `Baseline - watercourse ref WC3.gpkg`
- `Post-intervention - created area habitat.gpkg`

### Carried forward

- **#13 re-upload test** (kept) costs 3 uploads / ~360s worst case. Best restructure
  candidate in the domain — 2 uploads would prove the same thing.
- **Chunks 2–4 should check frontend unit tests as well as backend integration tests.**
  The largest duplication found here was against
  `bng-metric-frontend/src/server/error-file/single-error-copy.test.js`, not against
  the backend suite the workshop was scoped around.

---

## The coverage floor (added after chunk 1, applies to every chunk)

Frontend unit tests mock the backend HTTP client (`wreck`). **They cannot catch
backend contract drift**: if the backend renames a field, the unit tests keep passing
against stale mocks and the page breaks in production. Backend integration tests, in
turn, never render anything.

So journey tests are the only place the two halves meet, and the workshop's floor is:

> For every data family the page renders, at least one journey test must render it
> **from real uploaded data**.

Verdicts A and B are subject to this floor — a test that is the last real-data witness
for a family is kept regardless of how thoroughly the rule beneath it is covered
elsewhere. Where deleting a group would breach the floor, the options in order are:
(1) keep one anchor, (2) close the gap in backend integration first via
`/verify-integration-coverage`, then delete. Never (3) delete and accept the gap.

### Mapping is not detection

Added after chunk 1's retrospective breach (`GPKG_RLB_TOO_MANY_POLYGONS`, below). Before
deleting a journey test on the strength of a unit-test counterpart, check **where that
unit test's input comes from**:

| Unit test is handed…                             | It proves…                   | Still needs a real-data witness for… |
| ------------------------------------------------ | ---------------------------- | ------------------------------------ |
| a fabricated object (`{ code: 'X', message }`)   | the mapping/rendering of `X` | **that `X` is ever emitted**         |
| real service output, or the code path under test | both                         | —                                    |

Nearly every frontend copy/formatter unit test is the first kind. "A unit test asserts
this string" is not "a unit test proves this code path runs" — so for each error code or
computed field, confirm _something_ covers the detection side before deleting the last
journey test that exercises it end to end.

This check runs **before** each chunk's deletions from chunk 3 onward, not
retrospectively.

---

## Chunk 2 — `habitat-list-upload.spec.js` (46 collected tests, 1 file)

### Finding

The counterpart here is **not** the backend. It is
`bng-metric-frontend/src/server/baseline-habitat-list/controller.test.js` — **74 unit
tests** that boot the real Hapi server, mock only `wreck`, and assert against fully
rendered Nunjucks markup. They are component tests of the same page, and they cover
the summary cells, "No data" states, per-tab column headers, row fields, tree rows,
Site-vs-Area split, and the default `aria-sort` markup.

Two things they cannot cover, which is what the surviving journey tests are for:

1. **Real backend data.** See the coverage floor above.
2. **Client-side sorting.** The table is `data-module="moj-sortable-table"` — the MoJ
   Frontend component sorts in the browser. The server only emits `data-sort-value`,
   which the unit tests assert as markup; only a real click proves those values drive
   the component correctly.

### Outcome — conservative cut

| Group                         |  Tests | Delete | Keep                                                  |
| ----------------------------- | -----: | -----: | ----------------------------------------------------- |
| Summary units                 |      3 |      0 | all three — one per habitatSizes family               |
| no-hedgerows: "No data"/trees |      5 |      2 | hedgerow "No data", Site-vs-Area, tree rows           |
| no-watercourses "No data"     |      2 |      1 | watercourse "No data"                                 |
| Area tab                      |     11 |      4 | data row, status, totals, 3 sort clicks, ref-link nav |
| Hedgerows tab                 |     12 |      8 | empty state, data row, totals, ref-link nav           |
| Watercourses tab              |     11 |      9 | data row, ref-link nav                                |
| Watercourses empty state      |      1 |      0 | keep                                                  |
| GIS trees (skipped)           |      1 |      0 | placeholder                                           |
| **Total**                     | **46** | **24** | **22**                                                |

Applied: `--list` reports **22 tests in 1 file** (was 46).

Two `"…km"`/`"…ha"` suffix assertions were **folded into** the neighbouring data-row
tests rather than deleted outright, so the formatting is still asserted against real
data without paying for a separate tab switch.

### Coverage-floor audit (all 22 keeps)

| Data family rendered from the backend  | Real-data witness that survives               |
| -------------------------------------- | --------------------------------------------- |
| `habitatSizes.areaHabitats`            | summary — area habitat size                   |
| `habitatSizes.hedgerows` (present)     | summary — hedgerow size                       |
| `habitatSizes.hedgerows` (absent)      | no-hedgerows — hedgerow "No data"             |
| `habitatSizes.watercourses` (present)  | summary — watercourse size                    |
| `habitatSizes.watercourses` (absent)   | no-watercourses — watercourse "No data"       |
| `habitatSizes.site` vs `.areaHabitats` | no-hedgerows — Site smaller than Area         |
| `trees[]`                              | no-hedgerows — trees listed as own rows       |
| `units.habitatsTotal`                  | summary — area units 2dp                      |
| `units.hedgerowsTotal`                 | summary — hedgerow units 2dp                  |
| `units.watercoursesTotal`              | summary — watercourse units 2dp               |
| `habitats[]` row fields                | area tab — data row + status column           |
| `hedgerows[]` row fields               | hedgerows tab — data row                      |
| `watercourses[]` row fields            | watercourses tab — data row                   |
| area totals row                        | area tab — totals row                         |
| hedgerow totals row                    | hedgerows tab — totals row                    |
| `featureId` → habitat-details route    | ref-link nav ×3 (area, hedgerow, watercourse) |
| empty tab panels                       | hedgerows + watercourses empty state          |
| `data-sort-value` → MoJ component      | area tab — 3 sort clicks                      |

No family lost its last real-data witness.

### Deviation from the approved plan

The proposed conservative cut said it would still drop both extra fixture uploads. It
does **not** — the audit showed that would leave the no-hedgerows and no-watercourses
`habitatSizes` shapes unverified end to end (backend integration pins habitatSizes only
for a _complete_ file). Both uploads are retained with one anchor test each, and the
rationale is recorded in-file so a later pass doesn't undo it.

**Follow-up worth doing:** add no-hedgerows / no-watercourses fixtures to
`bng-metric-backend/integration-tests/baseline.test.js` via `/verify-integration-coverage`.
That would pin the shape at the backend and make these two anchors genuinely optional.

---

## Chunk 1 — retrospective coverage-floor audit

Chunk 1 was cut before the coverage floor existed, so it was re-audited against it.
One breach found and reverted; the rest hold.

### Breach found and fixed — `GPKG_RLB_TOO_MANY_POLYGONS`

The deleted test _"multiple redline boundaries shows the 'multiple red line boundaries'
page"_ (fixture `Baseline - three rlb polygons.gpkg`) was the **only test anywhere** —
in any of the four suites — proving the backend rejects a GeoPackage carrying more than
one red line boundary polygon.

| Suite                       | Coverage of `GPKG_RLB_TOO_MANY_POLYGONS`                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| Backend unit                | **none** — no test references the code                                                      |
| Backend integration         | **none** — fixtures ship `baseline-no-rlb.gpkg` (the _missing_ case) but no >1-polygon file |
| Backend PostGIS integration | **none** — the check lives in the parse layer, not PostGIS                                  |
| Frontend unit               | copy only (`single-error-copy.test.js:45`), given a hand-written error object               |
| Journey                     | this test — **deleted in chunk 1**                                                          |

The check is raised in `src/validation/geopackage/geopackage-internals-validate-features.js:141`.
Test and fixture **restored**; the case now carries a do-not-delete comment naming the
gap. `upload-baseline` is back to **32 tests**.

### Near-miss that held — `NO_HABITAT_AREAS`

Deleting _"file without habitat parcels"_ looked like the same mistake, but is not.
`NO_HABITAT_AREAS` has two emission sites and both stay covered:

- PostGIS SQL path → `postgis-validate-baseline-layers.test.js:348`
- Parse-layer path (`geopackage-internals-validate-features.js:292`) → still witnessed by
  the surviving journey test _"rejects a habitats layer with incorrect geometry"_, which
  asserts that path's exact message, `'Zero area habitat parcels in GeoPackage'`.

### Accepted risk — non-area outside-redline gates

Deleting the hedgerow / watercourse / tree outside-redline uploads leaves no end-to-end
witness that a **real GeoPackage** with an escaping linear or point feature produces its
error code. Judged acceptable, not restored, because:

- the rules are covered in PostGIS integration for all four layer types, including the
  boundary-tolerance cases (5 cm passes, 50 cm flags, exactly-on-edge passes);
- the parse path for hedgerow / watercourse / tree layers is exercised by the surviving
  happy-path upload, which reads and persists all three;
- only the junction of the two is unwitnessed, and both sides are independently pinned.

Revisit if a defect ever escapes there — it would be the first evidence the junction
matters.

### Contract families — surviving witnesses (32 tests)

| Family                                             | Real-data witness                            |
| -------------------------------------------------- | -------------------------------------------- |
| `valid: true` → habitat list + persisted task list | happy path                                   |
| baseline replacement discards post-intervention    | re-upload test                               |
| multi-error grouped layout                         | structural validation errors (parcel-level)  |
| multi-error, redline-level block                   | self-intersecting redline                    |
| `details.sample` per-parcel rendering              | parcel below minimum area                    |
| sliver suppression (frontend de-dup)               | SLIVERS_OUTSIDE_REDLINE suppression          |
| single-error standard variant                      | missing redline boundary (+ link navigation) |
| single-error personalised variant                  | self-intersecting parcel alone               |
| single-error placeholder variant                   | redline outside England alone                |
| single-error catch-all variant                     | wrong column names                           |
| single-error distinctiveness variant               | high distinctiveness habitat                 |
| GeoPackage parse — bad geometry column             | habitats layer with incorrect geometry       |
| GeoPackage parse — missing column                  | habitats layer with a missing column         |
| GeoPackage parse — duplicate refs                  | duplicate habitat references                 |
| GeoPackage parse — multiple RLB polygons           | **restored** multiple redline boundaries     |
| non-GeoPackage → flash + redirect to form          | format error                                 |
| empty errors array → generic page                  | error-file page display                      |
| session without `pendingUploadId` → redirect       | upload-received no pending upload            |
| cross-user persist denial                          | cross-user access                            |

No family is left without a witness.

---

## Chunk 3 — `upload-post-intervention` (21 collected tests, 3 files)

### Outcome: 1 deletion out of 21 — the chunk is almost entirely justified coverage

The detection check (see "Mapping is not detection") was run **before** classification
this time, and it protected almost the whole domain.

### Finding 1 — the `GPKG_RLB_*` family has zero backend coverage

Four structural checks on the Red Line Boundary layer, all raised in
`src/validation/geopackage/geopackage-internals-validate-features.js`:

| Code                           | Backend unit | Backend integration | PostGIS | Only witness       |
| ------------------------------ | ------------ | ------------------- | ------- | ------------------ |
| `GPKG_RLB_NO_GEOMETRY_COLUMN`  | none         | none                | n/a     | journey (PI)       |
| `GPKG_RLB_UNREADABLE_GEOMETRY` | none         | none                | n/a     | journey (PI)       |
| `GPKG_RLB_NO_POLYGON`          | none         | loose¹              | n/a     | journey (baseline) |
| `GPKG_RLB_TOO_MANY_POLYGONS`   | none         | none                | n/a     | journey (baseline) |

¹ `baseline.test.js` asserts a `/red line bound/i` **message** match against
`baseline-no-rlb.gpkg`; it never references the code.

All journey tests touching this family are floor-protected and kept. This is the
workshop's most useful byproduct so far: a whole validation family whose only tests
live in the browser suite.

### Finding 2 — the two PI upload routes have no frontend unit tests at all

`src/server/upload-post-intervention-file/` and `src/server/post-intervention-upload-received/`
contain **no `.test.js` files**. The 9 form-display / navigation / client-validation /
role / unauthenticated journey tests across those two routes are the only coverage of
them anywhere. All kept.

### Finding 3 — the error-file page is shared between both flows

`src/server/error-file/controller.js` selects the flow from the `validationUploadType`
session key; both flows render through the same resolver and template. So PI does not
need its own witness for each single-error variant — only for the fact that PI errors
reach the shared page under the PI key, which the surviving "structural validation
errors" test provides.

### Ledger

| Group                                          | Tests | Verdict   | Reason                                                                                                |
| ---------------------------------------------- | ----: | --------- | ----------------------------------------------------------------------------------------------------- |
| Form display / navigation / client validation  |     5 | D         | no unit tests exist for these routes                                                                  |
| Role + unauthenticated (both PI routes)        |     4 | D         | frontend auth wiring, no unit tests                                                                   |
| Happy path                                     |     1 | C         | PI wiring anchor                                                                                      |
| No pending upload → redirect                   |     1 | D         | PI session branch                                                                                     |
| Format error + focus movement                  |     1 | D         | browser-only focus behaviour (a11y)                                                                   |
| Structural validation errors → PI error page   |     1 | C         | PI multi-error witness + proves the shared page keys off PI                                           |
| RLB no geometry column                         |     1 | **floor** | sole detection witness for `GPKG_RLB_NO_GEOMETRY_COLUMN`                                              |
| RLB multiple geometry columns                  |     1 | **floor** | sole detection witness                                                                                |
| RLB wrong geometry type                        |     1 | **floor** | sole detection witness                                                                                |
| Advance + delay both set                       |     1 | **floor** | `advance-delay-check.test.js` covers the rule on hand-built layers; no real-`.gpkg` witness elsewhere |
| Cross-user access                              |     1 | C         | PI persist path's ownership check is not integration-tested                                           |
| High distinctiveness single-error page         |     1 | **floor** | sole witness of PI variant propagation — see below                                                    |
| CDP uploader rejection / upload timeout (skip) |     2 | keep      | no coverage elsewhere                                                                                 |

### The proposed deletion, withdrawn

"High distinctiveness habitat shows the distinctiveness single-error page" was proposed
for deletion on the grounds that `distinctiveness-check.js` is shared by both flows, so
the surviving baseline journey test already witnesses it. **That was wrong**, and the
test's own in-file comment says why: the check is _parameterised by flow_
(`checkHabitatDistinctiveness(layers, variant)`), and the post-intervention variant reads
the **Proposed\*** columns rather than the Baseline ones.

Tracing the chain:

| Step                                                       | Covered by                                                            |
| ---------------------------------------------------------- | --------------------------------------------------------------------- |
| PI variant reads `Proposed*` columns                       | `distinctiveness-check.test.js:335` (hand-built layers)               |
| the check is wired into `validateGeoPackageLayers`         | `index.wire.test.js`                                                  |
| **the PI route passes `variant: 'postIntervention'`**      | **nothing** — no backend test references the variant at the call site |
| a real PI `.gpkg` with a High Proposed habitat is rejected | **this journey test only**                                            |

Wire the call site to `'baseline'` by mistake and every backend test still passes. The
journey test is the sole witness of the last two rows, so it is floor-protected and
**kept**.

Lesson for later chunks: a **shared module is not shared coverage** when it is
parameterised per flow. Check whether the parameter's propagation is tested, not just
the module.

### Chunk 3 outcome: 0 deletions of 21

Every test is either floor-protected, the sole coverage of a route with no unit tests,
or browser-only behaviour. The chunk's value is diagnostic rather than reductive — see
Finding 1.

---

## Chunk 4 — `habitat-details` (135 collected tests, 2 files)

### Outcome: 135 → 90, by **consolidation**, with zero assertions lost

This chunk was not a deletion pass. The baseline "content" describes were 54 tests that
each loaded the page and asserted **one label or value**; they were merged into panel
tests that assert everything the originals did on a single page load. Nothing was
dropped, so the coverage floor is satisfied by construction rather than by audit.

| Block                     | Before | After | Unit coverage behind it |
| ------------------------- | -----: | ----: | ----------------------- |
| watercourse content       |     24 |     6 | **none**                |
| area habitat content      |     16 |     5 | thorough                |
| hedgerow content          |     14 |     4 | partial                 |
| query-param validation ×2 |      8 |     2 | `featureId` cases only  |
| everything else           |     73 |    73 | —                       |

Verified: `PROFILE=@habitat-details npm run test:github` → **90 passed (2.5m)**, no
failures, no skips.

### Finding — the baseline watercourse detail page has no unit coverage at all

`bng-metric-frontend/src/server/baseline-habitat-details/controller.test.js` (54 tests)
has a `GET` describe (area) and a `GET (hedgerow strategy)` describe, but **no
watercourse GET describe** — all eight watercourse references in that file are
POST/redirect/encroachment-forwarding.

So the consolidated watercourse panel test is the sole witness for that entire page.
Its in-file comment says so and says keep it exhaustive. This inverts the intuition the
chunk started with: the biggest, most duplicated-looking block was the least covered.

### What was kept separate, and why

Merging is only safe where tests share a page load and assert render output. These
stayed as their own tests:

- **culvert narrowing** (watercourse) — client-side JS that mutates the form, so it
  cannot share a page load with the render assertions;
- **trading-rule guidance derivation** (area) — selects a different habitat type and
  compares before/after, an interaction rather than a render;
- **back/cancel navigation** (all three) — each keeps its BMD-878 comment explaining
  that it must reach the page via `page.goto()` (no Referer), so nobody "improves" it
  into a Referer-carrying click;
- **AC1 click-throughs** — they harvest the shared project ids and cover the
  arrived-from-the-list back-link branch.

### Left alone deliberately — the PI repeated link tests

~7 `"View baseline details"` / back-link tests recur across the retained / Enhanced /
Created variants. `viewBaselineHref` is built by two shared builders in
`post-intervention-habitat-details/view-only-shared.js` (lines 200 and 253), so one
witness per builder path would probably suffice — but establishing which view model
routes through which builder is more work than four cheap page loads justify, and this
workshop has already mis-credited a lower layer twice (chunk 1's
`GPKG_RLB_TOO_MANY_POLYGONS`, chunk 3's PI variant propagation). Not worth a third.

The post-intervention side was already well structured — its tests are panel-level
(_"renders the read-only page with every summary row"_), not one-assertion-per-field —
so there was little to gain there regardless.

---

## Chunk 5 — `habitat-list` remainder (34 collected tests, 2 files)

### Outcome: 34 → 33, one merge

`habitat-list.spec.js` (8) and `post-intervention-habitat-list.spec.js` (26).

### Finding — the PI habitat list is thinly unit-covered

`post-intervention-habitat-list/controller.test.js` has **8** tests, plus 13 in the
shared `habitat-list-controller.test.js` — against 74 for the baseline list. Its journey
tests carry computed behaviour nothing else witnesses: tree size bands and units, Lost
tree exclusion, the tree-inclusive Areas total vs tree-excluding Site size, per-layer
unit calculations and footer totals, BMD-722 summary population, BMD-845 retention
categories, BMD-531 status. All floor-protected.

### The intervention-type trio — shared rendering, per-layer data

The three BMD-845 tests (area / hedgerow / watercourse) look like enumerated variants:
`interventionDisplay` is imported once in `habitat-list-controller.js:10` and applied in
one row-builder at line 81, so all three render through identical code.

Kept anyway. The `retentionCategory` value they render is produced by **three separate
per-layer enrichment modules** in the backend (`enrich-post-intervention-area-habitat.js`,
`-hedgerow.js`, `-watercourse.js`), none of them covered by integration tests. Shared
rendering, per-layer data production — the same shape as chunk 3's PI variant
propagation, so a witness per layer is meaningful. BMD-534 also makes retention
categories a live area.

### The PI pairs were left unmerged

About nine tests pair up on a shared fixture and could be merged. They were not, because
`post-intervention-habitat-list.spec.js` already memoises its uploads per describe
(`createProjectCache` + `beforeAll`), so merging would save page loads only — and each
test maps to a distinct named AC (AC1, AC3, AC5, AC6, AC7) on its own fixture. Unlike
chunk 4's single-label tests, these are different computations, so merging would trade
AC-level pinpointing for about ten seconds. Bad trade.

### The one merge

`habitat-list.spec.js` had two tab-interaction tests, each running a full `setupProject`
to assert the same GOV.UK tabs component for a different tab. Merged into one test that
clicks each tab in turn and asserts all three `aria-selected` states each time, with
labelled assertions so a failure still names the clicked tab. Saves a project creation
and a page load.

---

## Workshop summary (chunks 1–5)

| Chunk | Domain                   |  Before |   After | Nature                         |
| ----- | ------------------------ | ------: | ------: | ------------------------------ |
| 1     | upload-baseline          |      53 |      32 | deletion (1 restored on audit) |
| 2     | habitat-list-upload      |      46 |      22 | deletion                       |
| 3     | upload-post-intervention |      21 |      21 | analysed; nothing removable    |
| 4     | habitat-details          |     135 |      90 | consolidation                  |
| 5     | habitat-list remainder   |      34 |      33 | analysed; one merge            |
| —     | **Total**                | **289** | **198** |                                |

Also removed: **14 `.gpkg` fixtures** (~7.8 MB net of the restored one).

All five domains verified green after their changes.

**Not examined**, by decision at the end of chunk 5: `project-management` (66 tests) and
`authentication` + `upload-file` (34). Project-management has the strongest backend
overlap of any domain — `projects.test.js`, `project-details.test.js` and `users.test.js`
cover the same CRUD, sort, 404/400 and cross-user paths — but its journey tests are
sub-second with no uploads, so the runtime payoff is near zero. `upload-file` is the
file-type selection page and has no backend route at all.

### Where the yield actually came from

Chunks 1, 2 and 4 (all upload-gated) account for essentially the whole reduction.
Chunks 3 and 5 produced one merge between them — both are domains whose journey tests
turned out to be the only coverage their behaviour has anywhere. That pattern is the
workshop's main result: **the tests that look most redundant are often the least
covered**, because a page nobody unit-tested is also a page nobody wrote unit tests for.

### Backend coverage gaps found (for the service team — not actioned here)

1. **`GPKG_RLB_*` family** — `GPKG_RLB_NO_GEOMETRY_COLUMN`, `GPKG_RLB_UNREADABLE_GEOMETRY`,
   `GPKG_RLB_NO_POLYGON`, `GPKG_RLB_TOO_MANY_POLYGONS` have no backend unit or
   integration coverage. Journey tests are their only home.
2. **PI variant propagation** — nothing asserts the post-intervention route passes
   `variant: 'postIntervention'` into `checkHabitatDistinctiveness`. Set it to
   `'baseline'` and every backend and frontend test still passes.
3. **`habitatSizes` shape for incomplete files** — backend integration pins the shape
   only for a _complete_ GeoPackage; the no-hedgerows / no-watercourses shapes that the
   frontend's "No data" branch depends on are witnessed only by journey tests.

### Method notes worth carrying forward

- **Mapping is not detection.** A unit test handed a fabricated object proves the
  mapping, never that the code path runs.
- **A shared module is not shared coverage** when it is parameterised per flow — check
  the parameter's propagation, not just the module.
- **Consolidation beats deletion** where tests are single-assertion variants sharing a
  page load: same runtime saving, no coverage question to get wrong.
