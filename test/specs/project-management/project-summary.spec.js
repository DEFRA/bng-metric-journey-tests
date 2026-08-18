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
import { uploadFileHref } from '@utils/upload-file-navigation.js'
import { CreateProjectFlow } from '@flows/project-management/create-project.flow.js'
import { UploadBaselineFileFlow } from '@flows/upload-baseline/upload-baseline-file.flow.js'
import { UploadPostInterventionFileFlow } from '@flows/upload-post-intervention/upload-post-intervention-file.flow.js'
import { ProjectDashboardPage } from '@pages/project-dashboard.page.js'

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

// The left-hand navigation labels its area entry "Area Habitats" while the
// section heading below it reads "Area habitats". Deliberately spelled out
// rather than reusing UNIT_TYPES, so the casing mismatch is visible here
// instead of surfacing as a confusing locator miss.
const NAV_ITEMS = ['Area Habitats', HEDGEROWS, WATERCOURSES]

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
const VIEW_ON_SITE_BASELINE = 'View on-site baseline'
const VIEW_ON_SITE_POST_INTERVENTION = 'View on-site post intervention'
const NOT_APPLICABLE = 'N/A'
const NET_PERCENTAGE_NOT_MET = '-100.00%'
// The ticket specifies the "Not met" status as having a red background; the
// GOV.UK red tag modifier is what paints it.
const RED_TAG_CLASS = /govuk-tag--red/

// 'Baseline - no hedgerows.gpkg' carries area habitats (including individual
// trees, which is what makes the treesTotal assertion below possible) and
// watercourses, but no hedgerow features. One upload therefore covers both the
// populated-section and the zero-unit-section rendering.
const NO_HEDGEROWS_FILE = 'Baseline - no hedgerows.gpkg'

// The counterpart fixture: the only shipped baseline that populates all three
// unit types at once (120 Habitats, 60 Urban Trees, 40 Hedgerows, 8 Rivers).
// It is what gives the *populated* Hedgerows section a real-data witness, which
// NO_HEDGEROWS_FILE by definition cannot.
const ALL_UNIT_TYPES_FILE = 'Baseline - all unit and intervention types.gpkg'

// BMD-852 post-intervention pairs. The all-types pair is the ticket's stated
// scenario — baseline *and* post-intervention data for every habitat type — and
// each of its six tiles carries a distinct non-round value, so a renamed or
// mixed-up backend field cannot pass unnoticed.
const ALL_UNIT_TYPES_PI_FILE =
  'Post-intervention - all unit and intervention types.gpkg'
// The only shipped pair that yields a real net *gain*: the baseline has no
// hedgerows at all, the post-intervention file does. Because the baseline is
// zero the backend's percentage is non-finite, which is what drives the "N/A"
// branch — see the zero-baseline describe below.
const HEDGEROWS_PI_FILE = 'Post-intervention - complete with hedgerows.gpkg'

// One real upload backs every read-only describe in this file. Uploading is the
// slowest and flakiest step we have, and concurrent uploads clobber the single
// pendingUploadId yar key, so the project is built once per worker and the file
// runs serially. See "Sharing uploads in read-only specs" in AGENTS.md.
async function buildBaselineOnlyProject(browser, file) {
  const context = await browser.newContext({
    storageState: STORAGE_STATE,
    baseURL: baseUrl
  })
  const page = await context.newPage()
  try {
    const { id, name } = await setupProject(
      new CreateProjectFlow(page),
      new ProjectDashboardPage(page),
      PROJECT_LABEL
    )
    await new UploadBaselineFileFlow(page).uploadFileAndWaitForSummary(id, file)
    return { id, name }
  } finally {
    await context.close()
  }
}

const getOrBuildProject = createProjectCache()

function getBaselineOnlyProject(browser) {
  return getOrBuildProject(NO_HEDGEROWS_FILE, () =>
    buildBaselineOnlyProject(browser, NO_HEDGEROWS_FILE)
  )
}

function getAllUnitTypesProject(browser) {
  return getOrBuildProject(ALL_UNIT_TYPES_FILE, () =>
    buildBaselineOnlyProject(browser, ALL_UNIT_TYPES_FILE)
  )
}

// BMD-852. Two uploads rather than one, so these are shared even harder than
// the baseline-only projects: one build per fixture pair, per worker.
async function buildPostInterventionProject(browser, baselineFile, piFile) {
  const context = await browser.newContext({
    storageState: STORAGE_STATE,
    baseURL: baseUrl
  })
  const page = await context.newPage()
  try {
    const { id, name } = await setupProject(
      new CreateProjectFlow(page),
      new ProjectDashboardPage(page),
      PROJECT_LABEL
    )
    await new UploadBaselineFileFlow(page).uploadFileAndWaitForSummary(
      id,
      baselineFile
    )
    await new UploadPostInterventionFileFlow(page).uploadFile(id, piFile)
    await page.waitForURL(
      new RegExp(`/projects/${id}/post-intervention-habitat-list`),
      { timeout: UPLOAD_TIMEOUT }
    )
    return { id, name }
  } finally {
    await context.close()
  }
}

function getPostInterventionProject(browser) {
  return getOrBuildProject(ALL_UNIT_TYPES_PI_FILE, () =>
    buildPostInterventionProject(
      browser,
      ALL_UNIT_TYPES_FILE,
      ALL_UNIT_TYPES_PI_FILE
    )
  )
}

function getGainProject(browser) {
  return getOrBuildProject(HEDGEROWS_PI_FILE, () =>
    buildPostInterventionProject(browser, NO_HEDGEROWS_FILE, HEDGEROWS_PI_FILE)
  )
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

    test(
      'summary renders the project caption, heading, navigation and all three unit-type sections',
      { tag: ['@smoke', '@happy-path'] },
      async ({ projectSummaryPage }) => {
        await projectSummaryPage.open(project.id)

        await expect(projectSummaryPage.heading).toBeVisible()
        await expect(projectSummaryPage.caption(project.name)).toBeVisible()
        await expect(projectSummaryPage.uploadFileButton).toBeVisible()
        await expect(projectSummaryPage.navigation).toBeVisible()
        // "Summary" is the current page: rendered bold, as a <strong> carrying
        // aria-current, rather than as one of the (still inert) siblings.
        await expect(projectSummaryPage.currentNavItem).toHaveAttribute(
          'aria-current',
          'page'
        )

        for (const label of UNIT_TYPES) {
          await expect(projectSummaryPage.sectionHeading(label)).toBeVisible()
        }
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

        for (const label of UNIT_TYPES) {
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

      test('a unit type with no features shows N/A, zero units and no status tag', async ({
        projectSummaryPage
      }) => {
        await projectSummaryPage.open(project.id)

        // The fixture has no Hedgerows layer, so hedgerowsTotal is absent from
        // the backend payload and normaliseUnits floors it to 0.
        expect(
          await projectSummaryPage.tileValue(HEDGEROWS, TILE_NET_PERCENTAGE)
        ).toBe(NOT_APPLICABLE)
        expect(
          await projectSummaryPage.tileValue(HEDGEROWS, TILE_BASELINE)
        ).toBe(ZERO_UNITS)
        // Guards the explicit negative-zero branch: -0 must render as 0.00.
        expect(
          await projectSummaryPage.tileValue(HEDGEROWS, TILE_NET_UNIT_CHANGE)
        ).toBe(ZERO_UNITS)
        await expect(projectSummaryPage.statusTag(HEDGEROWS)).toHaveCount(0)
      })

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
        project = await getPostInterventionProject(browser)
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
            section.getByRole('heading', {
              name: TILE_POST_INTERVENTION_WITH_PI,
              exact: true
            })
          ).toBeVisible()
          await expect(
            section.getByRole('heading', {
              name: TILE_POST_INTERVENTION,
              exact: true
            })
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
        project = await getGainProject(browser)
      })

      // The baseline has no hedgerows and the post-intervention file does, so
      // the hedgerow percentage is computed against zero and comes back
      // non-finite. This is the only route to the "N/A" branch that a real
      // upload can take — the frontend unit test reaches it with a fabricated
      // payload (controller.test.js), nothing else renders it.
      test('a habitat type gained from a zero baseline shows N/A and no status tag', async ({
        projectSummaryPage
      }) => {
        await projectSummaryPage.open(project.id)

        expect(
          await projectSummaryPage.tileValue(HEDGEROWS, TILE_BASELINE)
        ).toBe(ZERO_UNITS)
        expect(
          await projectSummaryPage.tileValue(HEDGEROWS, TILE_NET_PERCENTAGE)
        ).toBe(NOT_APPLICABLE)
        await expect(projectSummaryPage.statusTag(HEDGEROWS)).toHaveCount(0)
      })

      // Documents a real oddity rather than an intended design: the units did
      // go up, and the page says so in the net-unit-change tile, but the
      // percentage tile reads "N/A" and no "Met" tag appears. See "Known
      // deviations" in test/flows/project-management/project-summary.flow.md.
      test('the gain is still reported in the net unit change tile', async ({
        projectSummaryPage
      }) => {
        await projectSummaryPage.open(project.id)

        expect(
          await projectSummaryPage.tileUnits(
            HEDGEROWS,
            TILE_POST_INTERVENTION_WITH_PI
          )
        ).toBeGreaterThan(0)
        expect(
          await projectSummaryPage.tileUnits(HEDGEROWS, TILE_NET_UNIT_CHANGE)
        ).toBeGreaterThan(0)
      })

      // Unblock: needs a fixture pair whose post-intervention units exceed the
      // baseline by more than the 10% net-gain target
      // (NET_GAIN_TARGET_PERCENTAGE in the frontend's project-summary
      // controller), for a habitat type whose baseline is greater than zero —
      // a zero baseline yields "N/A", as the test above shows. No shipped
      // fixture pair does this: every combination tried is a net loss, and the
      // only gain available is from a zero baseline. Once such a fixture
      // exists, assert a green `govuk-tag--green` "Met" tag and a positive
      // percentage. Until then the green branch is covered only by the
      // frontend's `percentageSummary` unit test, which is a pure function.
      test.skip('a net gain above the 10% target shows a green "Met" tag', async () => {})
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

      // BMD-870 explicitly scopes out the trading-rules clickthrough, the
      // area/hedgerow/watercourse drill-downs and the project-details link;
      // they render as text with no href. Pinning that is what makes the
      // follow-up tickets visible — when one lands, this test fails and is
      // replaced by a navigation assertion rather than the deferred state
      // quietly persisting.
      test('sections deferred to later tickets render as text rather than links', async ({
        projectSummaryPage
      }) => {
        await projectSummaryPage.open(project.id)

        for (const label of UNIT_TYPES) {
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

          await expect(
            projectSummaryPage.viewOnSiteBaselineText(label)
          ).toBeVisible()
          await expect(
            projectSummaryPage
              .unitSection(label)
              .getByRole('link', { name: VIEW_ON_SITE_BASELINE })
          ).toHaveCount(0)
        }

        await expect(projectSummaryPage.projectDetailsHeading).toBeVisible()
        await expect(projectSummaryPage.projectDetailsBody).toBeVisible()
        await expect(projectSummaryPage.projectDetailsLink).toHaveCount(0)
        await expect(
          projectSummaryPage.navigation.getByRole('link')
        ).toHaveCount(0)
        for (const label of NAV_ITEMS) {
          await expect(projectSummaryPage.navItem(label)).toBeVisible()
        }
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
        // chooser, where the user still has to pick the file type. All three
        // sections carry one, and the ticket treats each as its own entry
        // point.
        for (const label of UNIT_TYPES) {
          await expect(
            projectSummaryPage.uploadPostInterventionLink(label)
          ).toHaveAttribute('href', expectedHref)
        }

        // One click stands for all three — the href is the same value from the
        // same controller variable, so what is left to prove is that following
        // one of them really lands on the selection page.
        await projectSummaryPage.uploadPostInterventionLink(HEDGEROWS).click()

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
