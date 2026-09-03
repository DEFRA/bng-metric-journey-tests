import { test, expect } from '@fixtures'
import {
  STORAGE_STATE,
  NO_PROJECTS_STORAGE_STATE,
  skipInE2e,
  baseUrl
} from '@utils/env.js'
import {
  describeRoleEnforcement,
  describeUnauthenticatedAccess
} from '@utils/access-checks.js'
import { setupProject } from '@utils/project-helpers.js'
import { createProjectCache } from '@utils/shared-project.js'
import {
  buildPostInterventionProject,
  getAllUnitTypesPostInterventionProject,
  getAllUnitTypesProject,
  getAreaGainProject,
  getBaselineOnlyProject,
  getHedgerowGainProject,
  getNoHedgerowsPostInterventionProject,
  getNoWatercoursesPostInterventionProject,
  getNoWatercoursesProject,
  getTargetMetProject,
  getWatercourseGainProject
} from '@utils/summary-projects.js'
import { uploadFileHref } from '@utils/upload-file-navigation.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const PROJECT_LABEL = 'Project summary test'
const UPLOAD_TIMEOUT = 120_000
const HTTP_BAD_REQUEST = 400
const HTTP_NOT_FOUND = 404
const VALID_UUID_V4 = 'aaaaaaaa-bbbb-4ccc-bddd-eeeeeeeeeeee'
const UNKNOWN_UUID_V4 = 'aaaaaaaa-bbbb-4ccc-bddd-ffffffffffff'

const AREA_HABITATS = 'Area habitats'
const HEDGEROWS = 'Hedgerows'
const WATERCOURSES = 'Watercourses'
const UNIT_TYPES = [AREA_HABITATS, HEDGEROWS, WATERCOURSES]

// BMD-854 made the unit-type sections conditional on the project having data
// for that type. `Baseline - no hedgerows.gpkg` has 50 habitats, 25 urban trees
// and 3 rivers but an EMPTY Hedgerows layer, so every describe built on
// `getBaselineOnlyProject` sees these two sections and no Hedgerows one.
const BASELINE_ONLY_UNIT_TYPES = [AREA_HABITATS, WATERCOURSES]

// BMD-854 also removed the old casing mismatch: the navigation used to label
// its area entry "Area Habitats" while the section heading read "Area
// habitats". `buildUnitTypeNavigation` now shares the section's constant, so
// both read "Area habitats" — which is why the nav assertions below reuse the
// section labels directly rather than keeping a separate NAV_ITEMS list.

const ZERO_UNITS = '0.00 units'
const UNITS_2DP = /^\d+\.\d{2} units$/

const TILE_BASELINE = 'On-site baseline'
const TILE_POST_INTERVENTION = 'On-site post intervention'
// BMD-852: the same tile is headed differently once post-intervention data
// exists — "post-intervention" gains a hyphen. Tiles are looked up by their
// visible heading, so using the wrong one fails as a missing element rather
// than a wrong value. See "Known deviations" in the flow doc.
const TILE_POST_INTERVENTION_WITH_PI = 'On-site post-intervention'
const TILE_NET_UNIT_CHANGE = 'Total on-site net unit change'
const TILE_NET_PERCENTAGE = 'Total on-site net percentage change'
const TILE_TRADING_RULES = 'Trading Rules'

const VIEW_TRADING_RULES = 'View trading rules'
const VIEW_ON_SITE_POST_INTERVENTION = 'View on-site post intervention'
// BMD-897 (frontend PR#238, 2026-08-25): a unit type present ONLY in the
// post-intervention document has no baseline to divide by, so its percentage
// tile reads this literal rather than the non-finite "N/A" — and its baseline
// tile drops its action line entirely.
const POST_INTERVENTION_ONLY_PERCENTAGE = 'Not applicable'
const NET_PERCENTAGE_NOT_MET = '-100.00%'
// The ticket specifies the "Not met" status as having a red background; the
// GOV.UK red tag modifier is what paints it.
const RED_TAG_CLASS = /govuk-tag--red/
const GREEN_TAG_CLASS = /govuk-tag--green/

// 'Baseline - no hedgerows.gpkg' carries area habitats (including individual
// trees, which is what makes the treesTotal assertion below possible) and
// watercourses, but no hedgerow features. One upload therefore covers both the
// populated-section and the zero-unit-section rendering.
// NO_HEDGEROWS_FILE and its builder now live in @utils/summary-projects.js so
// the unit-type drill-down specs share this project rather than each paying for
// their own upload.

// The counterpart fixture: the only shipped baseline that populates all three
// unit types at once (120 Habitats, 60 Urban Trees, 40 Hedgerows, 8 Rivers).
// It is what gives the *populated* Hedgerows section a real-data witness, which
// NO_HEDGEROWS_FILE by definition cannot.

// BMD-852 post-intervention pairs. The all-types pair is the ticket's stated
// scenario — baseline *and* post-intervention data for every habitat type — and
// each of its six tiles carries a distinct non-round value, so a renamed or
// mixed-up backend field cannot pass unnoticed. It and the linear net-gain pair
// are built by @utils/summary-projects.js, which the unit-type drill-downs
// share: the same two uploads back both this file and hedgerows-summary.spec.js.
//
// The only shipped pair that yields a real net *gain*: the baseline has no
// hedgerows at all, the post-intervention file does. Because the baseline is
// zero the backend's percentage is non-finite, which is what drives the "N/A"
// branch — see the zero-baseline describe below.

// BMD-852 net-gain pairs, copied from bng-metric-harness
// example-files/permutations/. The harness generator prices each pair through
// the real bng-metric-engine and fails if it lands on the wrong side of the
// 10% target, so these labels cannot drift from the arithmetic.
//
// The area-gain pair used to be cached here too. BMD-854 moved it into
// @utils/summary-projects.js as `getAreaGainProject` so the area summary's
// zero-deficit test shares this file's build instead of uploading it twice.
//
// harness intervention/watercourse-enhanced-* — watercourses gain ~3.8%: a real
// gain that is still under the target, so the tag must stay red. This is the
// only fixture that pins the threshold at 10 rather than at 0.
const BELOW_TARGET_BASELINE_FILE =
  'Baseline - watercourse gain below target.gpkg'
const BELOW_TARGET_PI_FILE =
  'Post-intervention - watercourse gain below target.gpkg'

const NET_GAIN_TARGET_PERCENTAGE = 10

// One real upload backs every read-only describe in this file. Uploading is the
// slowest and flakiest step we have, and concurrent uploads clobber the single
// pendingUploadId yar key, so the project is built once per worker and the file
// runs serially. See "Sharing uploads in read-only specs" in AGENTS.md.
const getOrBuildProject = createProjectCache()

function getBelowTargetProject(browser) {
  return getOrBuildProject(BELOW_TARGET_PI_FILE, () =>
    buildPostInterventionProject(
      browser,
      BELOW_TARGET_BASELINE_FILE,
      BELOW_TARGET_PI_FILE
    )
  )
}

// Asserts the status tag matches the percentage the page actually rendered, so
// one helper proves both branches of the BMD-852 threshold rule.
async function expectStatusMatchesPercentage(projectSummaryPage, label) {
  const percentage = await projectSummaryPage.tileValue(
    label,
    TILE_NET_PERCENTAGE
  )
  expect(percentage).toMatch(/^-?\d+\.\d{2}%$/)

  const met = Number.parseFloat(percentage) >= NET_GAIN_TARGET_PERCENTAGE
  const tag = projectSummaryPage.statusTag(label)
  await expect(tag).toHaveText(met ? 'Met' : 'Not met')
  await expect(tag).toHaveClass(met ? GREEN_TAG_CLASS : RED_TAG_CLASS)

  return Number.parseFloat(percentage)
}

// Post-intervention sections source every figure from the backend. Asserting
// the three together is what makes a renamed or mixed-up field detectable: the
// net unit change has to equal post-intervention minus baseline for the *same*
// habitat type, which no single-field assertion can catch.
async function expectCoherentPostInterventionUnits(projectSummaryPage, label) {
  const baseline = await projectSummaryPage.tileUnits(label, TILE_BASELINE)
  const postIntervention = await projectSummaryPage.tileUnits(
    label,
    TILE_POST_INTERVENTION_WITH_PI
  )
  const netUnitChange = await projectSummaryPage.tileUnits(
    label,
    TILE_NET_UNIT_CHANGE
  )

  // BMD-852 AC1-3 specify the post-intervention total "to 15 significant
  // figures, 2 decimal places, rounded". Asserted on the rendered string —
  // the numeric checks below would pass just as happily on "161.264 units".
  expect(
    await projectSummaryPage.tileValue(label, TILE_POST_INTERVENTION_WITH_PI)
  ).toMatch(UNITS_2DP)

  expect(baseline).toBeGreaterThan(0)
  expect(postIntervention).toBeGreaterThan(0)
  // Both sides are rendered to 2dp, so the difference can be off by up to 0.01.
  expect(netUnitChange).toBeCloseTo(postIntervention - baseline, 1)
}

async function expectPopulatedUnitType(projectSummaryPage, label) {
  const tag = projectSummaryPage.statusTag(label)

  expect(
    await projectSummaryPage.tileUnits(label, TILE_BASELINE)
  ).toBeGreaterThan(0)
  expect(await projectSummaryPage.tileValue(label, TILE_NET_PERCENTAGE)).toBe(
    NET_PERCENTAGE_NOT_MET
  )
  await expect(tag).toBeVisible()
  await expect(tag).toHaveClass(RED_TAG_CLASS)
}

// BMD-898: a unit type with no features in either document disappears from the
// left navigation and the main page together. The unit types the project DOES
// have data for are asserted too — without that half, a blank or errored page
// would satisfy the absence checks on its own.
async function expectUnitTypeSuppressed(projectSummaryPage, absent, present) {
  for (const label of present) {
    await expect(projectSummaryPage.navItem(label)).toBeVisible()
    await expect(projectSummaryPage.sectionHeading(label)).toBeVisible()
  }

  await expect(projectSummaryPage.navItem(absent)).toHaveCount(0)
  await expect(
    projectSummaryPage.navigation.getByRole('link', { name: absent })
  ).toHaveCount(0)
  // The section region as well as its heading: `appUnitTypeSummary` renders no
  // <h2> when it is handed no headingHref, so a heading-only check could pass
  // while the section itself still rendered.
  await expect(projectSummaryPage.sectionHeading(absent)).toHaveCount(0)
  await expect(projectSummaryPage.unitSection(absent)).toHaveCount(0)
}

// BMD-897 AC1/AC2, the half of the section that goes quiet when a unit type has
// no baseline to compare against: a literal instead of a percentage, no status
// tag, and a baseline tile that loses its action line entirely. Two of the
// three are absences, so they are asserted with a count rather than by looking
// for different text.
//
// The ACs also enumerate the Trading Rules tile. It is deliberately not
// asserted here: `tradingRules` is an unbranched literal in `buildUnitSummary`,
// identical in every variant, and the deferred-elements describe below already
// witnesses it from real data. One witness per family, not one per variant.
async function expectPostInterventionOnlySuppressedTiles(
  projectSummaryPage,
  label
) {
  expect(await projectSummaryPage.tileValue(label, TILE_BASELINE)).toBe(
    ZERO_UNITS
  )
  expect(await projectSummaryPage.tileValue(label, TILE_NET_PERCENTAGE)).toBe(
    POST_INTERVENTION_ONLY_PERCENTAGE
  )
  await expect(projectSummaryPage.statusTag(label)).toHaveCount(0)
  await expect(projectSummaryPage.viewOnSiteBaselineText(label)).toHaveCount(0)
}

// The other half: the two tiles that do carry a figure.
//
// Note the tile heading. BMD-897 treats post-intervention-only as NOT a
// standard intervention, so this variant keeps the UNHYPHENATED "On-site post
// intervention" wording even though post-intervention data exists — reading the
// tile through it is what proves `postInterventionOnly` reached
// `buildPostInterventionSummary` at all. The hyphenated constant would fail
// here as a missing element rather than a wrong value.
//
// The upload link is what distinguishes this variant from the standard
// both-documents one, where the same tile renders inert text. "Upload entry
// points" below asserts the same link on a BASELINE-ONLY project, which reaches
// it through the absent-intervention branch instead; break the
// `postInterventionOnly` half of `hasStandardIntervention` and that test stays
// green while this state silently loses its only call to action.
async function expectPostInterventionOnlyGain(
  projectSummaryPage,
  label,
  projectId
) {
  const postIntervention = await projectSummaryPage.tileValue(
    label,
    TILE_POST_INTERVENTION
  )
  const netUnitChange = await projectSummaryPage.tileValue(
    label,
    TILE_NET_UNIT_CHANGE
  )

  // Asserted on the rendered strings. The ACs specify 2 decimal places, and the
  // numeric read below would accept "1.0642 units" just as happily.
  expect(postIntervention).toMatch(UNITS_2DP)
  expect(netUnitChange).toMatch(UNITS_2DP)
  // The ACs state this equality holds "by definition", the baseline being zero.
  // Asserting the two tiles against each other is what makes a mixed-up habitat
  // type detectable: each is a positive number on its own either way.
  expect(netUnitChange).toBe(postIntervention)
  expect(
    await projectSummaryPage.tileUnits(label, TILE_POST_INTERVENTION)
  ).toBeGreaterThan(0)

  const uploadLink = projectSummaryPage.uploadPostInterventionLink(label)
  await expect(uploadLink).toBeVisible()
  await expect(uploadLink).toHaveAttribute(
    'href',
    uploadFileHref(projectId, `/projects/${projectId}/project-summary`)
  )
}

test.describe('project-management', { tag: '@project-management' }, () => {
  // Serial mode keeps the shared upload above from racing the other uploads in
  // this file's worker.
  test.describe.configure({ mode: 'serial' })

  // ─── Page content ───────────────────────────────────────────────────────────

  test.describe('Project summary — page content', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    let project
    test.beforeAll(async ({ browser }) => {
      project = await getBaselineOnlyProject(browser)
    })

    // BMD-854 (frontend PR#237, 2026-08-25) made the unit-type sections
    // CONDITIONAL. `buildProjectSummary` filters on a `visible` flag: area
    // habitats always renders, hedgerows and watercourses only when
    // `projectHasHabitatData(project, type)` finds a non-empty array on the
    // baseline or the post-intervention document. The same condition drives
    // the left-hand navigation, so the nav is two to four items, not four.
    //
    // This fixture (`Baseline - no hedgerows.gpkg`) carries 50 habitats,
    // 25 urban trees and 3 rivers but an EMPTY Hedgerows layer, so it is the
    // witness for both branches at once — two sections present, one absent.
    // Before BMD-854 all three rendered unconditionally and the absent one
    // showed N/A / 0.00 units, which is why this test used to loop over all
    // three; that state is no longer reachable this way.
    test(
      'summary renders the caption, heading and navigation, with a unit-type section only where the project has data',
      { tag: ['@smoke', '@happy-path'] },
      async ({ projectSummaryPage }) => {
        await projectSummaryPage.open(project.id)

        await expect(projectSummaryPage.heading).toBeVisible()
        await expect(projectSummaryPage.caption(project.name)).toBeVisible()
        await expect(projectSummaryPage.uploadFileButton).toBeVisible()
        await expect(projectSummaryPage.navigation).toBeVisible()
        // "Summary" is the current page: rendered bold, as a <strong> carrying
        // aria-current, rather than as one of the sibling links.
        await expect(projectSummaryPage.currentNavItem).toHaveAttribute(
          'aria-current',
          'page'
        )

        for (const label of [AREA_HABITATS, WATERCOURSES]) {
          await expect(projectSummaryPage.sectionHeading(label)).toBeVisible()
          await expect(projectSummaryPage.navItem(label)).toBeVisible()
        }

        // The empty Hedgerows layer is dropped from both the page and the nav.
        await expect(projectSummaryPage.sectionHeading(HEDGEROWS)).toHaveCount(
          0
        )
        await expect(projectSummaryPage.navItem(HEDGEROWS)).toHaveCount(0)
      }
    )

    test(
      'page title is the summary heading',
      { tag: '@regression' },
      async ({ projectSummaryPage, page }) => {
        await projectSummaryPage.open(project.id)

        await expect(page).toHaveTitle(/^Summary - /)
      }
    )
  })

  // ─── Unit types absent from both documents (BMD-898) ─────────────────────────
  //
  // `projectHasHabitatData` is an OR across the baseline and post-intervention
  // documents, so a unit type is only suppressed when BOTH are empty for it.
  // Every other post-intervention project in this file drives that OR *true*:
  // they pair a linear-free baseline with a PI file that HAS the type, which
  // renders BMD-897's post-intervention-only variant rather than nothing. The
  // both-empty branch needs `Post-intervention - complete.gpkg`, the only
  // shipped PI fixture with neither a Hedgerows nor a Rivers layer.
  //
  // AC1 (baseline only, no hedgerows) is asserted in "page content" above,
  // which already owns that fixture. These three complete the set.
  //
  // Sole witnesses that the both-empty shape reaches the page from real
  // uploads. The frontend unit suite names all four cases explicitly
  // (../bng-metric-frontend/src/server/project-summary/controller.test.js:439)
  // but mocks the backend client and deletes the key from a hand-written
  // payload — it proves the rendering, never that an empty Hedgerows or Rivers
  // layer persists as an empty array. The backend cannot stand in either: its
  // only fixture (integration-tests/fixtures/baseline-complete.gpkg) carries 2
  // hedgerows and 1 river, and both persistence tests assert `length > 0`
  // (baseline-persistence.test.js:51, post-intervention-persistence.test.js:40).
  // Do not delete without adding an empty-layer fixture there first.

  test.describe(
    'Project summary — unit types absent from both documents',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('a baseline with no watercourses drops the Watercourses section and nav item', async ({
        projectSummaryPage,
        browser
      }) => {
        const project = await getNoWatercoursesProject(browser)
        await projectSummaryPage.open(project.id)

        // The mirror of the no-hedgerows case in "page content": the same rule
        // reached through the other habitat-type string. `buildUnitTypeNavigation`
        // and the controller each call `projectHasHabitatData` once per type, so
        // the hedgerow witness does not cover this call site.
        await expectUnitTypeSuppressed(projectSummaryPage, WATERCOURSES, [
          AREA_HABITATS,
          HEDGEROWS
        ])
      })

      test('hedgerows absent from both documents drops the section and nav item', async ({
        projectSummaryPage,
        browser
      }) => {
        const project = await getNoHedgerowsPostInterventionProject(browser)
        await projectSummaryPage.open(project.id)

        // The project really does carry post-intervention data — the tile
        // heading only gains its hyphen in that variant. Without this the test
        // would still pass against a baseline-only project, i.e. against AC1.
        await expect(
          projectSummaryPage.tileHeading(
            AREA_HABITATS,
            TILE_POST_INTERVENTION_WITH_PI
          )
        ).toBeVisible()

        // Watercourses survives on the baseline's 3 rivers even though the PI
        // file has none, which is the OR's baseline side asserted in passing.
        await expectUnitTypeSuppressed(projectSummaryPage, HEDGEROWS, [
          AREA_HABITATS,
          WATERCOURSES
        ])
      })

      test('watercourses absent from both documents drops the section and nav item', async ({
        projectSummaryPage,
        browser
      }) => {
        const project = await getNoWatercoursesPostInterventionProject(browser)
        await projectSummaryPage.open(project.id)

        await expect(
          projectSummaryPage.tileHeading(
            AREA_HABITATS,
            TILE_POST_INTERVENTION_WITH_PI
          )
        ).toBeVisible()

        // Hedgerows survives on the baseline's 16.
        await expectUnitTypeSuppressed(projectSummaryPage, WATERCOURSES, [
          AREA_HABITATS,
          HEDGEROWS
        ])
      })
    }
  )

  // ─── Unit figures ────────────────────────────────────────────────────────────
  //
  // This is the reason the file exists. The frontend unit suite
  // (../bng-metric-frontend/src/server/project-summary/controller.test.js) covers
  // every rendering branch here, but mocks the backend client and hands the
  // controller a hand-written `{ habitatsTotal, treesTotal, hedgerowsTotal,
  // watercoursesTotal }`. Backend integration
  // (../bng-metric-backend/integration-tests/baseline-persistence.test.js:81)
  // pins the stored totals but never renders. Neither proves the two halves
  // agree: `normaliseUnits` turns a missing field into 0, so renaming a total
  // backend-side would show 0.00 units on every tile with all of those tests
  // still green. These assertions are the only witness that the page reads the
  // units a real upload actually produced.

  test.describe(
    'Project summary — unit figures',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getBaselineOnlyProject(browser)
      })

      test('post-intervention is zero and net unit change negates the baseline for every unit type', async ({
        projectSummaryPage
      }) => {
        await projectSummaryPage.open(project.id)

        for (const label of BASELINE_ONLY_UNIT_TYPES) {
          const baseline = await projectSummaryPage.tileUnits(
            label,
            TILE_BASELINE
          )

          expect(
            await projectSummaryPage.tileValue(label, TILE_BASELINE)
          ).toMatch(UNITS_2DP)
          // Baseline-only project: post-intervention is hardcoded to zero.
          expect(
            await projectSummaryPage.tileValue(label, TILE_POST_INTERVENTION)
          ).toBe(ZERO_UNITS)
          // Asserted as the rendered string rather than a parsed number: with
          // no post-intervention data the net change is `-baseline`, and for a
          // unit type with no features that is JavaScript's -0. The controller
          // has an explicit guard turning it back into 0 so the user never sees
          // "-0.00 units", and comparing numbers would silently accept either.
          expect(
            await projectSummaryPage.tileValue(label, TILE_NET_UNIT_CHANGE)
          ).toBe(baseline === 0 ? ZERO_UNITS : `-${baseline.toFixed(2)} units`)
        }
      })

      test('a populated unit type shows -100.00% and a red "Not met" tag', async ({
        projectSummaryPage
      }) => {
        await projectSummaryPage.open(project.id)

        // Area habitats and watercourses both carry features in this fixture.
        // The red modifier is the "red background colour" the ticket asks for.
        // The component test proves the macro honours a `classes` value it is
        // handed; only this asserts the controller supplies the red one.
        for (const label of [AREA_HABITATS, WATERCOURSES]) {
          await expectPopulatedUnitType(projectSummaryPage, label)
        }
      })

      // REMOVED 2026-09-01: 'a unit type with no features shows N/A, zero units
      // and no status tag'. BMD-854 (frontend PR#237) made the sections
      // conditional, so a unit type with no features renders NO SECTION rather
      // than a section full of zeroes — the N/A / 0.00 / no-tag state this
      // asserted is unreachable through an empty unit type. The replacement
      // coverage is in "Project summary — page content", which asserts the
      // Hedgerows section and its nav item are both absent for this fixture.
      //
      // Do not restore this against a different fixture expecting it to pass.
      // The `-0 renders as 0.00` guard it also covered (unit-summary.js
      // `formatUnits`) survives in the frontend unit tests; nothing on this
      // page can reach it now, because a section needs features to render and
      // features carry units.

      test('the area habitats figure includes individual tree units, matching the habitat list', async ({
        projectSummaryPage,
        habitatListPage,
        page
      }) => {
        await projectSummaryPage.open(project.id)
        const summaryAreaUnits = await projectSummaryPage.tileValue(
          AREA_HABITATS,
          TILE_BASELINE
        )

        await habitatListPage.open(project.id)
        const listAreaUnits =
          await habitatListPage.areaHabitatUnitsCell.innerText()

        // Both pages fold treesTotal into their area-habitats total (frontend
        // habitat-list-controller.js buildTotalUnits / project-summary
        // controller.js areaUnits). This equality is what pins treesTotal
        // reaching the summary: the backend integration suite asserts
        // habitatsTotal, hedgerowsTotal and watercoursesTotal but never
        // treesTotal, so dropping it would leave every other test green.
        //
        // The two formatters round to 2dp but cap at different significant
        // figures (7 on the habitat list, 15 here). That only diverges above
        // ~10^5 units, well beyond any fixture — if this ever fails on a large
        // file, check the formatter before assuming a data bug.
        expect(summaryAreaUnits).toBe(`${listAreaUnits.trim()} units`)

        // The fixture's trees are listed as their own rows, so the total above
        // is not just parcels.
        await expect(habitatListPage.treeRows.first()).toBeVisible()
      })
    }
  )

  // ─── Populated hedgerows ─────────────────────────────────────────────────────

  test.describe(
    'Project summary — populated hedgerows',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getAllUnitTypesProject(browser)
      })

      // Sole witness that `hedgerowsTotal` reaches the page from a real upload.
      // Every other test in this file runs on NO_HEDGEROWS_FILE, where the
      // hedgerow tiles legitimately read 0.00 units — so renaming the field
      // backend-side would render 0.00 with all of them still green. Backend
      // integration (baseline-persistence.test.js:82) pins the stored total but
      // never renders, and the frontend unit suite renders a hand-written
      // total. Do not delete without moving the assertion onto another test
      // that uploads a hedgerow-bearing baseline.
      test('a hedgerow-bearing baseline renders its units, -100.00% and a red "Not met" tag', async ({
        projectSummaryPage
      }) => {
        await projectSummaryPage.open(project.id)

        await expectPopulatedUnitType(projectSummaryPage, HEDGEROWS)

        const baseline = await projectSummaryPage.tileUnits(
          HEDGEROWS,
          TILE_BASELINE
        )
        // Post-intervention stays zero and the net change negates the baseline,
        // as it does for the other two unit types.
        expect(
          await projectSummaryPage.tileValue(HEDGEROWS, TILE_POST_INTERVENTION)
        ).toBe(ZERO_UNITS)
        expect(
          await projectSummaryPage.tileValue(HEDGEROWS, TILE_NET_UNIT_CHANGE)
        ).toBe(`-${baseline.toFixed(2)} units`)
      })
    }
  )

  // ─── Post-intervention variant (BMD-852) ─────────────────────────────────────
  //
  // BMD-852 widened the guard so a project carrying both documents renders here
  // instead of redirecting to the task list, and switched every figure in these
  // sections over to backend-supplied values: `habitatsNetUnitChange`,
  // `habitatsNetUnitChangePercentage` and their hedgerow / watercourse
  // counterparts (backend src/validation/project-shared-schemas.js:102-121).
  //
  // The frontend computes none of them, and `formatOptionalUnits` renders any
  // non-finite value as "N/A", so a renamed field would blank the page rather
  // than fail loudly. The frontend unit tests cover every branch here but mock
  // the backend client; the backend integration test asserts the stored values
  // against the same engine call that produced them
  // (post-intervention-persistence.test.js:179). Neither witnesses the wiring.

  test.describe(
    'Project summary — post-intervention variant',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getAllUnitTypesPostInterventionProject(browser)
      })

      test(
        'a project with both documents renders the summary rather than redirecting',
        { tag: ['@smoke', '@happy-path'] },
        async ({ projectSummaryPage, page }) => {
          await projectSummaryPage.open(project.id)

          // Before BMD-852 this project was bounced to the task list.
          await expect(page).toHaveURL(
            new RegExp(`/projects/${project.id}/project-summary`)
          )
          await expect(projectSummaryPage.heading).toBeVisible()
          // The header upload button stays available even once both files exist.
          await expect(projectSummaryPage.uploadFileButton).toBeVisible()
          for (const label of UNIT_TYPES) {
            await expect(projectSummaryPage.sectionHeading(label)).toBeVisible()
          }
        }
      )

      test('every unit type shows backend baseline, post-intervention and net unit values that agree', async ({
        projectSummaryPage
      }) => {
        await projectSummaryPage.open(project.id)

        for (const label of UNIT_TYPES) {
          await expectCoherentPostInterventionUnits(projectSummaryPage, label)
        }
      })

      test('a net loss shows the backend percentage and a red "Not met" tag', async ({
        projectSummaryPage
      }) => {
        await projectSummaryPage.open(project.id)

        for (const label of UNIT_TYPES) {
          const percentage = await projectSummaryPage.tileValue(
            label,
            TILE_NET_PERCENTAGE
          )
          // Every habitat type in this fixture pair loses units, so each shows a
          // negative percentage well below the 10% target.
          expect(percentage).toMatch(/^-\d+\.\d{2}%$/)
          expect(Number.parseFloat(percentage)).toBeLessThan(0)

          const tag = projectSummaryPage.statusTag(label)
          await expect(tag).toBeVisible()
          await expect(tag).toHaveClass(RED_TAG_CLASS)
        }
      })

      test('the post-intervention tile is re-headed and its upload link becomes inert text', async ({
        projectSummaryPage
      }) => {
        await projectSummaryPage.open(project.id)

        for (const label of UNIT_TYPES) {
          const section = projectSummaryPage.unitSection(label)
          // The heading gains a hyphen once post-intervention data exists.
          await expect(
            projectSummaryPage.tileHeading(
              label,
              TILE_POST_INTERVENTION_WITH_PI
            )
          ).toBeVisible()
          await expect(
            projectSummaryPage.tileHeading(label, TILE_POST_INTERVENTION)
          ).toHaveCount(0)

          // The upload link is replaced by inert text — there is nothing left to
          // upload for this habitat type.
          await expect(
            section.getByText(VIEW_ON_SITE_POST_INTERVENTION, { exact: true })
          ).toBeVisible()
          await expect(
            projectSummaryPage.uploadPostInterventionLink(label)
          ).toHaveCount(0)
        }
      })
    }
  )

  // ─── Post-intervention against a zero-unit baseline (BMD-852) ────────────────

  test.describe(
    'Project summary — post-intervention with no baseline units',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getHedgerowGainProject(browser)
      })

      // The baseline has no hedgerows and the post-intervention file does, so
      // this is the post-intervention-ONLY case. Until BMD-897 the percentage
      // was computed against zero, came back non-finite and rendered "N/A";
      // BMD-897 gave the state its own branch and its own wording, because
      // there is no baseline to express a change against. This is still the
      // only route a real upload can take to it — the frontend unit test
      // reaches it with a fabricated payload (controller.test.js).
      test('a habitat type gained from a zero baseline shows "Not applicable" and no status tag', async ({
        projectSummaryPage
      }) => {
        await projectSummaryPage.open(project.id)

        await expectPostInterventionOnlySuppressedTiles(
          projectSummaryPage,
          HEDGEROWS
        )
      })

      // Documents a real oddity rather than an intended design: the units did
      // go up, and the page says so in the net-unit-change tile, but the
      // percentage tile reads "Not applicable" and no "Met" tag appears. See
      // "Known deviations" in
      // test/flows/project-management/project-summary.flow.md.
      test('the gain is still reported in the net unit change tile, above an upload link', async ({
        projectSummaryPage
      }) => {
        await projectSummaryPage.open(project.id)

        await expectPostInterventionOnlyGain(
          projectSummaryPage,
          HEDGEROWS,
          project.id
        )
      })

      // The mirror of the two tests above for the other linear unit type, and
      // the ONLY project-summary witness for it. `buildProjectSummary` calls
      // `hasPostInterventionOnlyHabitat` once per unit type, each with its own
      // habitat-type string, so the hedgerow tests above do not cover this call
      // site — point it at the wrong type and both still pass.
      //
      // Nothing else covers it either. The frontend unit suite parameterises
      // both types
      // (../bng-metric-frontend/src/server/project-summary/controller.test.js:501)
      // but mocks the backend client and hand-writes the payload, so it proves
      // the rendering and never that a real watercourse-bearing PI file over a
      // watercourse-free baseline produces this shape. The watercourses
      // drill-down (watercourses-summary.spec.js:129) renders the variant from
      // real data, but through a different controller and a page with no
      // section headings. The backend cannot stand in at all: its only fixture
      // (integration-tests/fixtures/baseline-complete.gpkg) carries rivers, and
      // both persistence tests assert `length > 0`
      // (baseline-persistence.test.js:51, post-intervention-persistence.test.js:40).
      //
      // Do not delete without moving these assertions onto another
      // project-summary test built on getWatercourseGainProject.
      test('watercourses gained from a zero baseline render the same variant', async ({
        projectSummaryPage,
        browser
      }) => {
        // 'Baseline - no watercourses.gpkg' + 'Post-intervention - complete
        // with watercourses.gpkg'. watercourses-summary.spec.js needs the same
        // pair, and @utils/summary-projects.js caches it per worker, so whichever
        // of the two runs first pays for the uploads and the other reuses them —
        // the suite spends one build either way, not two.
        const watercourseProject = await getWatercourseGainProject(browser)
        await projectSummaryPage.open(watercourseProject.id)

        await expectPostInterventionOnlySuppressedTiles(
          projectSummaryPage,
          WATERCOURSES
        )
        await expectPostInterventionOnlyGain(
          projectSummaryPage,
          WATERCOURSES,
          watercourseProject.id
        )
      })
    }
  )

  // ─── Net gain meets the target (BMD-852) ─────────────────────────────────────
  //
  // The green "Met" state is the headline of BMD-852's AC1-3 and, until the
  // harness net-gain fixtures were sourced, had no end-to-end witness at all —
  // only `percentageSummary` unit tests, which are a pure function, and a
  // controller test handed a fabricated payload. These render it from real
  // uploads.
  //
  // Two projects cover all three habitat types: the area pair gains on areas
  // only; the linear pair gains on hedgerows *and* watercourses at once.

  test.describe(
    'Project summary — net gain meets the target',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('area habitats above the target show a green "Met" tag', async ({
        projectSummaryPage,
        browser
      }) => {
        const project = await getAreaGainProject(browser)
        await projectSummaryPage.open(project.id)

        const percentage = await expectStatusMatchesPercentage(
          projectSummaryPage,
          AREA_HABITATS
        )
        expect(percentage).toBeGreaterThanOrEqual(NET_GAIN_TARGET_PERCENTAGE)
        await expectCoherentPostInterventionUnits(
          projectSummaryPage,
          AREA_HABITATS
        )
      })

      test('hedgerows and watercourses above the target show a green "Met" tag', async ({
        projectSummaryPage,
        browser
      }) => {
        const project = await getTargetMetProject(browser)
        await projectSummaryPage.open(project.id)

        for (const label of [HEDGEROWS, WATERCOURSES]) {
          const percentage = await expectStatusMatchesPercentage(
            projectSummaryPage,
            label
          )
          expect(percentage).toBeGreaterThanOrEqual(NET_GAIN_TARGET_PERCENTAGE)
          await expectCoherentPostInterventionUnits(projectSummaryPage, label)
        }
      })

      // The threshold is 10%, not 0. Every other "Not met" case in this file is
      // a net *loss*, so without this one an implementation that flipped the
      // tag on any positive change would pass the whole suite.
      test('a positive gain below the target still shows a red "Not met" tag', async ({
        projectSummaryPage,
        browser
      }) => {
        const project = await getBelowTargetProject(browser)
        await projectSummaryPage.open(project.id)

        const percentage = await expectStatusMatchesPercentage(
          projectSummaryPage,
          WATERCOURSES
        )
        expect(percentage).toBeGreaterThan(0)
        expect(percentage).toBeLessThan(NET_GAIN_TARGET_PERCENTAGE)
      })
    }
  )

  // ─── Deferred elements ───────────────────────────────────────────────────────

  test.describe(
    'Project summary — deferred elements',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getBaselineOnlyProject(browser)
      })

      // BMD-870 scoped out the trading-rules clickthrough, the drill-down
      // links and the project-details link; all rendered as text with no href.
      // The original test pinned all of them together and noted that "when one
      // lands, this test fails and is replaced by a navigation assertion rather
      // than the deferred state quietly persisting". BMD-854 and BMD-857 landed
      // the drill-downs on 2026-08-25/27, so that is exactly what happened —
      // the two halves are now separate tests.
      test('elements still deferred to later tickets render as text rather than links', async ({
        projectSummaryPage
      }) => {
        await projectSummaryPage.open(project.id)

        for (const label of BASELINE_ONLY_UNIT_TYPES) {
          // Asserting the copy *is there* as well as unlinked: a bare
          // `toHaveCount(0)` on the link passes just as happily when the text
          // has disappeared altogether. Reading it through `tileValue` anchors
          // it to the "Trading Rules" tile heading, which nothing else asserts.
          expect(
            await projectSummaryPage.tileValue(label, TILE_TRADING_RULES)
          ).toBe(VIEW_TRADING_RULES)
          await expect(
            projectSummaryPage
              .unitSection(label)
              .getByRole('link', { name: VIEW_TRADING_RULES })
          ).toHaveCount(0)
        }

        await expect(projectSummaryPage.projectDetailsHeading).toBeVisible()
        await expect(projectSummaryPage.projectDetailsBody).toBeVisible()
        await expect(projectSummaryPage.projectDetailsLink).toHaveCount(0)
      })

      // The other half of the split above: what BMD-854 (nav + section
      // headings) and BMD-857 (area baseline tile) turned into real links.
      // Every one of these was a `toHaveCount(0)` assertion before.
      test('the drill-down navigation and headings are links', async ({
        projectSummaryPage
      }) => {
        await projectSummaryPage.open(project.id)

        // Nav: the current page stays a <strong>, its siblings are links.
        await expect(projectSummaryPage.navItem(AREA_HABITATS)).toBeVisible()
        await expect(
          projectSummaryPage.navigation.getByRole('link', {
            name: AREA_HABITATS
          })
        ).toHaveAttribute('href', `/projects/${project.id}/area-summary`)
        await expect(
          projectSummaryPage.navigation.getByRole('link', {
            name: WATERCOURSES
          })
        ).toHaveAttribute(
          'href',
          `/projects/${project.id}/watercourses-summary`
        )

        // Section headings became links to the same drill-down pages.
        await expect(
          projectSummaryPage.sectionHeadingLink(AREA_HABITATS)
        ).toHaveAttribute('href', `/projects/${project.id}/area-summary`)
        await expect(
          projectSummaryPage.sectionHeadingLink(WATERCOURSES)
        ).toHaveAttribute(
          'href',
          `/projects/${project.id}/watercourses-summary`
        )

        // BMD-857 linked the area baseline tile; BMD-859/861 did the same for
        // the linear types, so every baseline tile is now a link — each with
        // its own unit type in the wording. The inert-text assertion that used
        // to live in the deferred test above moved here when that landed.
        await expect(
          projectSummaryPage.viewOnSiteAreaBaselineLink(AREA_HABITATS)
        ).toHaveAttribute('href', `/projects/${project.id}/area-baseline`)
        await expect(
          projectSummaryPage.viewOnSiteWatercoursesBaselineLink(WATERCOURSES)
        ).toHaveAttribute(
          'href',
          `/projects/${project.id}/watercourses-baseline`
        )
      })

      // BMD-857 AC2. Sole witness that this route into the area baseline
      // works: the assertions above prove the href is RENDERED, and
      // `area-baseline/controller.test.js` proves the destination renders
      // against mocked data — but until this test nothing had followed the
      // link. area-summary.spec.js:312 closed the same gap for the other two
      // entry points. Do not delete without moving the click onto another test
      // that reaches the area baseline from the project summary.
      test('the area habitats baseline tile opens the area baseline page', async ({
        page,
        projectSummaryPage,
        areaBaselinePage
      }) => {
        await projectSummaryPage.open(project.id)
        await projectSummaryPage
          .viewOnSiteAreaBaselineLink(AREA_HABITATS)
          .click()

        await expect(page).toHaveURL(
          new RegExp(`/projects/${project.id}/area-baseline`)
        )
        await expect(areaBaselinePage.heading).toBeVisible()
        await expect(areaBaselinePage.detailsTable).toBeVisible()
      })
    }
  )

  // ─── Upload entry points ─────────────────────────────────────────────────────

  test.describe(
    'Project summary — upload entry points',
    { tag: ['@regression', '@happy-path'] },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getBaselineOnlyProject(browser)
      })

      test('"Upload file" opens the file-type selection page, whose Back returns to the summary', async ({
        projectSummaryPage,
        uploadFilePage,
        page
      }) => {
        const summaryUrl = `/projects/${project.id}/project-summary`
        await projectSummaryPage.open(project.id)

        await expect(projectSummaryPage.uploadFileButton).toHaveAttribute(
          'href',
          uploadFileHref(project.id, summaryUrl)
        )
        await projectSummaryPage.uploadFileButton.click()

        await expect(uploadFilePage.heading).toBeVisible()
        // The returnUrl round-trip is what BMD-870 added: Back and Cancel come
        // back here rather than defaulting to the task list.
        await uploadFilePage.assertReturnLinks(summaryUrl)

        await uploadFilePage.backLink.click()
        await expect(page).toHaveURL(new RegExp(summaryUrl))
      })

      test('every in-section post-intervention link points at the same selection page', async ({
        projectSummaryPage,
        uploadFilePage,
        page
      }) => {
        await projectSummaryPage.open(project.id)
        const expectedHref = uploadFileHref(
          project.id,
          `/projects/${project.id}/project-summary`
        )

        // The links are worded for post-intervention but resolve to the shared
        // chooser, where the user still has to pick the file type. Every
        // rendered section carries one, and the ticket treats each as its own
        // entry point.
        for (const label of BASELINE_ONLY_UNIT_TYPES) {
          await expect(
            projectSummaryPage.uploadPostInterventionLink(label)
          ).toHaveAttribute('href', expectedHref)
        }

        // One click stands for the rest — the href is the same value from the
        // same controller variable, so what is left to prove is that following
        // one of them really lands on the selection page. Was HEDGEROWS until
        // BMD-854 stopped rendering that section for this fixture.
        await projectSummaryPage
          .uploadPostInterventionLink(WATERCOURSES)
          .click()

        await expect(page).toHaveURL(new RegExp(expectedHref.split('?')[0]))
        await expect(uploadFilePage.heading).toBeVisible()
      })
    }
  )

  // ─── Guard redirect ──────────────────────────────────────────────────────────

  test.describe(
    'Project summary — guard redirect',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // The both-documents case needs a real baseline *and* post-intervention
      // upload, so it is asserted in
      // test/specs/upload-post-intervention/upload-post-intervention.spec.js,
      // which already pays for both.
      test('a project with no baseline is redirected to the task list', async ({
        createProjectFlow,
        projectDashboardPage,
        projectSummaryPage,
        page
      }) => {
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )

        await projectSummaryPage.open(id)

        await expect(page).toHaveURL(new RegExp(`/add-project-details/${id}`))
      })
    }
  )

  // ─── Error state ─────────────────────────────────────────────────────────────

  test.describe('Project summary — error state', { tag: '@regression' }, () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    test('unknown project UUID returns the 404 error page', async ({
      projectSummaryPage,
      page
    }) => {
      const response = await projectSummaryPage.open(UNKNOWN_UUID_V4)

      // Unlike the task list, which catches the backend 404 and re-renders
      // itself with `error: true`, the summary throws Boom.notFound and lands
      // on the global error page.
      expect(response.status()).toBe(HTTP_NOT_FOUND)
      await expect(page.getByRole('heading', { name: '404' })).toBeVisible()
      await expect(projectSummaryPage.heading).toBeHidden()
    })

    // Unblock: needs a way to force a non-404 backend failure (a fault-injection
    // hook or a stubbed backend). Same blocker as the equivalent placeholders on
    // the project dashboard and the upload-file selection page. Once available,
    // drive the request with the backend returning 500 and assert the global
    // error page renders 502 without leaking project data.
    test.skip('backend failure renders the 502 error page', async () => {})
  })

  // ─── Cross-user visibility ───────────────────────────────────────────────────

  test.describe(
    'Project summary — cross-user visibility',
    { tag: '@regression' },
    () => {
      test.skip(skipInE2e(NO_PROJECTS_STORAGE_STATE), E2E_SKIP_REASON)

      test("a project's summary is not visible to a different user via direct URL", async ({
        browser
      }) => {
        test.setTimeout(UPLOAD_TIMEOUT + 60_000)

        const { id, name } = await getBaselineOnlyProject(browser)

        const otherContext = await browser.newContext({
          storageState: NO_PROJECTS_STORAGE_STATE,
          baseURL: baseUrl
        })
        try {
          const otherPage = await otherContext.newPage()
          const response = await otherPage.goto(
            `/projects/${id}/project-summary`
          )

          expect(response.status()).toBe(HTTP_NOT_FOUND)
          await expect(otherPage.getByText(name)).toBeHidden()
        } finally {
          await otherContext.close()
        }
      })
    }
  )

  // ─── Route parameter validation ──────────────────────────────────────────────

  test.describe(
    'Project summary — route parameter validation',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('non-UUID id path param returns 400', async ({ page }) => {
        const response = await page.goto('/projects/not-a-uuid/project-summary')

        expect(response.status()).toBe(HTTP_BAD_REQUEST)
      })
    }
  )

  // The route validates `{id}` as a uuidv4, and Hapi runs validation before the
  // role pre-handler, so the role check must be driven with a real v4 id.
  describeRoleEnforcement('Project summary', 'project-summary', {
    smoke: true,
    projectId: VALID_UUID_V4
  })
  describeUnauthenticatedAccess('Project summary', 'project-summary')
})
