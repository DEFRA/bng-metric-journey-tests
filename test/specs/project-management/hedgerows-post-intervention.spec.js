import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { uploadFileHref } from '@utils/upload-file-navigation.js'
import {
  getAllUnitTypesPostInterventionProject,
  getHedgerowInterventionTypesProject,
  getLinearInterventionTypesProject
} from '@utils/summary-projects.js'
import {
  AREA_HABITATS,
  BASELINE_NAV_CHILD,
  HEDGEROWS,
  POST_INTERVENTION_NAV_CHILD,
  SUMMARY,
  VIEW_ON_SITE_HEDGEROWS_BASELINE,
  VIEW_ON_SITE_POST_INTERVENTION,
  WATERCOURSES
} from '@utils/unit-type-labels.js'

// The hedgerows post-intervention page (BMD-860) —
// `/projects/{id}/hedgerows-post-intervention`. See
// test/flows/project-management/hedgerows-post-intervention.flow.md.
//
// `hedgerows-post-intervention/controller.test.js` already covers this page's
// markup in 15 tests, all with `wreck` mocked and four hand-built hedgerows.
// Everything here is scoped to what that cannot reach: real backend fields,
// hrefs that actually resolve, and the client-side tab component.

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
// The shared-build upload budget, applied to the whole file below. It has to
// sit on `describe.configure` rather than on a test: the build runs in
// `beforeAll`, so a `test.setTimeout()` in a test body comes too late to
// extend it.
const SHARED_BUILD_TEST_TIMEOUT = 180_000

const PAGE_PATH = 'hedgerows-post-intervention'

const TILE_NET_PERCENTAGE = 'Total on-site net percentage change'
const TILE_TRADING_RULES = 'Trading Rules'
const TILE_BASELINE = 'On-site baseline'
const TILE_POST_INTERVENTION = 'On-site post-intervention'
const TILE_NET_UNIT_CHANGE = 'Total on-site net unit change'

// The five tiles AC5 enumerates, in rendered order. The post-intervention
// heading is the HYPHENATED spelling — `buildPostInterventionSummary` picks it
// for a standard intervention, and the unhyphenated one only for the
// post-intervention-only shape, which this page's fixtures never reach.
const TILES = [
  TILE_NET_PERCENTAGE,
  TILE_TRADING_RULES,
  TILE_BASELINE,
  TILE_POST_INTERVENTION,
  TILE_NET_UNIT_CHANGE
]

// The three tiles whose values come from the same backend fields on the
// hedgerows summary, so the two pages must render identical strings.
const SHARED_TILES = [
  TILE_BASELINE,
  TILE_POST_INTERVENTION,
  TILE_NET_UNIT_CHANGE
]

const RETAINED = 'Retained'
const ENHANCED = 'Enhanced'
const CREATED = 'Created'
const ALL_TABS = [RETAINED, ENHANCED, CREATED]

const UNITS_2DP = /^-?\d+\.\d{2} units$/

// ── BMD-998 grid expectations ───────────────────────────────────────────────

// Grid cells carry the bare number; the tiles above them append " units".
const GRID_UNITS_2DP = /^-?\d+\.\d{2}$/
// Kilometres with no space before the suffix — the linear pages' formatter.
const KILOMETRES = /^\d+(\.\d+)?km$/
// "{label} ({score})". The score is REQUIRED, not optional: the builder drops
// it only for a non-finite multiplier, which no calculated row carries, and an
// optional group would let a regression that dropped every multiplier pass.
const LABEL_AND_SCORE = /^[^()]+ \(-?\d+(\.\d+)?\)$/
const YEARS = /^\d+ years?$/
// "{n} year(s) ({multiplier})" — the Final time to target shape.
const YEARS_AND_SCORE = /^\d+ years? \(-?\d+(\.\d+)?\)$/
const FIXED_STRATEGIC_SIGNIFICANCE = 'Low (1)'

// Column sets from `buildColumns` in
// common/helpers/post-intervention-habitat-grid.js. Retained carries Condition;
// Enhanced and Created swap it for the target/time-to-target block. Headings
// render in GOV.UK sentence case, where the ticket's AC4 table title-cases
// "Standard Difficulty".
const RETAINED_COLUMNS = [
  'Ref',
  'Units',
  'Size',
  'Habitat type',
  'Distinctiveness',
  'Condition',
  'Strategic significance'
]
const TARGET_COLUMNS = [
  'Ref',
  'Units',
  'Size',
  'Habitat type',
  'Distinctiveness',
  'Strategic significance',
  'Target condition',
  'Standard time to target',
  'Advance',
  'Delay',
  'Final time to target',
  'Standard difficulty'
]

// The refs `Post-intervention - created linear features.gpkg` carries per
// intervention type, in the ascending order AC7 requires. Pinned rather than
// counted loosely: a partial render is exactly the failure a `> 0` check would
// wave through. Its other 5 hedgerows are Lost, which the backend drops at
// import (BMD-531/534), so they reach no tab.
const RETAINED_REFS = [
  'HG004',
  'HG007',
  'HG008',
  'HG012',
  'HG015',
  'HG016',
  'HG017'
]
const CREATED_REFS = ['HG005', 'HG010', 'HG013', 'HG018']
// The same file's Enhanced refs — used only to click one (AC10b); their VALUES
// are uncalculated, see the Enhanced grid test.
const ENHANCED_ON_GRID_REF = 'HG006'

// `Post-intervention - all unit and intervention types.gpkg`, whose Enhanced
// hedgerows are the only ones that can witness AC4b's column values.
const ENHANCED_REFS = [
  'HG011',
  'HG012',
  'HG018',
  'HG026',
  'HG030',
  'HG031',
  'HG032',
  'HG034',
  'HG040'
]
const ENHANCED_CALCULATED_REF = 'HG018'

const detailsHrefPattern = (projectId) =>
  new RegExp(
    `/post-intervention-habitat-details\\?featureId=[^&]+&projectId=${projectId}$`
  )

async function expectColumn(grid, label, heading, pattern) {
  const values = await grid.columnValues(label, heading)
  // Length-checked as well as matched — a column that returned no cells at all
  // would satisfy the loop vacuously.
  expect(values.length, `${label} ${heading} cells`).toBeGreaterThan(0)
  for (const value of values) {
    expect(value, `${label} ${heading} "${value}"`).toMatch(pattern)
  }
}

const sizeValues = async (grid, label) =>
  (await grid.columnValues(label, 'Size')).map((value) =>
    Number(value.replace('km', ''))
  )

/**
 * AC5. The totals row is summed SERVER-SIDE from the rendered features
 * (`sumFinite`), so comparing it back against those rows is what proves the
 * sum is of THIS tab's hedgerows and not of every hedgerow on the project.
 *
 * Compared numerically with a tolerance rather than as strings: each row's
 * Units is already rounded to 2 dp, so a sum of rounded values can differ from
 * the rounded sum by up to half a penny per row.
 */
async function expectTotalsRow(grid, label) {
  const sum = (values) => values.reduce((total, value) => total + value, 0)

  await expect(await grid.totalsCell(label, 'Ref')).toHaveText('Total')
  const totalUnits = await (await grid.totalsCell(label, 'Units')).innerText()
  const totalSize = await (await grid.totalsCell(label, 'Size')).innerText()
  expect(totalUnits.trim()).toMatch(GRID_UNITS_2DP)
  expect(totalSize.trim()).toMatch(KILOMETRES)

  const rowUnits = (await grid.columnValues(label, 'Units')).map(Number)
  expect(Number(totalUnits), `${label} Units total`).toBeCloseTo(
    sum(rowUnits),
    1
  )
  expect(
    Number(totalSize.replace('km', '')),
    `${label} Size total`
  ).toBeCloseTo(sum(await sizeValues(grid, label)), 3)

  // Every non-numeric column stays empty in the totals row.
  await expect(await grid.totalsCell(label, 'Habitat type')).toHaveText('')
  await expect(
    await grid.totalsCell(label, 'Strategic significance')
  ).toHaveText('')
}

// Deliberately a pattern rather than VIEW_ON_SITE_HEDGEROWS_POST_INTERVENTION:
// AC5 writes the wording it wants removed as "post-intervention" while the app
// spells it "post intervention", so an exact match against either one alone
// would pass while the other spelling sat on the page.
const NO_PI_SELF_LINK = /View on-site hedgerows post[- ]intervention/i

async function expectTabSelected(hedgerowsPage, label) {
  await expect(hedgerowsPage.tab(label)).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(hedgerowsPage.panelHeading(label)).toBeVisible()
}

async function expectTabNotSelected(hedgerowsPage, label) {
  await expect(hedgerowsPage.tab(label)).toHaveAttribute(
    'aria-selected',
    'false'
  )
  await expect(hedgerowsPage.panelHeading(label)).toBeHidden()
}

test.describe('project-management', { tag: '@project-management' }, () => {
  // Uploads are the slowest step we own and concurrent ones clobber the shared
  // `pendingUploadId` yar key, so the file runs in one worker and each shared
  // project is built once. The timeout is the shared-build upload budget: this
  // file owns the only fixture pairing nothing else builds, so a cold
  // `beforeAll` here always pays create + two uploads, which overruns the
  // config's 60s default.
  test.describe.configure({
    mode: 'serial',
    timeout: SHARED_BUILD_TEST_TIMEOUT
  })

  // ─── Page content (BMD-860 AC3, AC4, AC5) ────────────────────────────────────

  test.describe('Hedgerows post-intervention — page content', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    let project
    test.beforeAll(async ({ browser }) => {
      project = await getHedgerowInterventionTypesProject(browser)
    })

    test(
      'renders the header, project name and upload action from real backend data',
      { tag: ['@smoke', '@happy-path'] },
      async ({ hedgerowsPostInterventionPage }) => {
        await hedgerowsPostInterventionPage.open(project.id)

        await expect(hedgerowsPostInterventionPage.heading).toBeVisible()
        await expect(
          hedgerowsPostInterventionPage.caption(project.name)
        ).toBeVisible()
        await expect(hedgerowsPostInterventionPage.resultsHeading).toBeVisible()
        await expect(hedgerowsPostInterventionPage.detailsHeading).toBeVisible()

        // The upload button's returnUrl is built by THIS controller for this
        // page. The hedgerows summary asserting its own copy proves nothing
        // here — the value is chosen per caller, so each page needs its own
        // witness.
        await expect(
          hedgerowsPostInterventionPage.uploadFileButton
        ).toHaveAttribute(
          'href',
          uploadFileHref(project.id, `/projects/${project.id}/${PAGE_PATH}`)
        )
      }
    )

    test('renders the five results tiles with no post-intervention self-link', async ({
      hedgerowsPostInterventionPage
    }) => {
      await hedgerowsPostInterventionPage.open(project.id)

      await expect(hedgerowsPostInterventionPage.tileHeadings()).toHaveText(
        TILES
      )

      // Reads `postIntervention.units.hedgerowsTotal` and
      // `baseline.units.hedgerowsTotal` — different backend fields from the
      // area page's habitatsTotal + treesTotal. The frontend unit tests mock
      // wreck, so nothing else proves these fields are really emitted.
      expect(
        await hedgerowsPostInterventionPage.tileValue(TILE_BASELINE)
      ).toMatch(UNITS_2DP)
      expect(
        await hedgerowsPostInterventionPage.tileValue(TILE_POST_INTERVENTION)
      ).toMatch(UNITS_2DP)

      // AC5's exception. The baseline tile keeps its link while the
      // post-intervention tile has NO action line at all: the controller
      // passes `interventionAction: null`, which `resolveInterventionAction`
      // treats differently from `undefined` (which would fall back to the
      // shared inert "View on-site post intervention" default). A mock that
      // passes neither renders identically, so only the real controller
      // distinguishes them.
      const section = hedgerowsPostInterventionPage.unitSection()
      await expect(section.getByText(NO_PI_SELF_LINK)).toHaveCount(0)
      await expect(
        section.getByText(VIEW_ON_SITE_POST_INTERVENTION, { exact: true })
      ).toHaveCount(0)
      await expect(
        section.getByRole('link', { name: VIEW_ON_SITE_HEDGEROWS_BASELINE })
      ).toBeVisible()
    })

    // AC5: "the same set of tiles as shown on the Project Summary page and the
    // Hedgerows Unit Summary page". Both pages read `hedgerowsTotal` through
    // the same formatter, so the rendered strings must match exactly — a
    // mismatch means one of them has been re-pointed at a different backend
    // field. Compared nowhere else.
    test('the results tiles agree with the hedgerows summary page', async ({
      hedgerowsPostInterventionPage,
      hedgerowsSummaryPage
    }) => {
      await hedgerowsSummaryPage.open(project.id)
      const fromSummary = {}
      for (const tile of SHARED_TILES) {
        fromSummary[tile] = await hedgerowsSummaryPage.tileValue(tile)
      }

      await hedgerowsPostInterventionPage.open(project.id)
      for (const tile of SHARED_TILES) {
        expect(await hedgerowsPostInterventionPage.tileValue(tile), tile).toBe(
          fromSummary[tile]
        )
      }
    })

    test('Post-intervention is current and the nav lists every unit type', async ({
      hedgerowsPostInterventionPage
    }) => {
      await hedgerowsPostInterventionPage.open(project.id)

      // AC3: the current item is a nested child under Hedgerows — the only
      // page in the service with this nav shape. Current means bold text
      // rather than a link: markCurrent deletes the href, so the item is a
      // <strong> with nothing to click.
      const current = hedgerowsPostInterventionPage.navItem(
        POST_INTERVENTION_NAV_CHILD
      )
      await expect(current).toHaveAttribute('aria-current', 'page')
      await expect(
        hedgerowsPostInterventionPage.navLink(POST_INTERVENTION_NAV_CHILD)
      ).toHaveCount(0)

      // The Baseline sibling renders because this fixture's BASELINE has
      // hedgerows; `buildSectionChildren` gates it on that, independently of
      // the post-intervention data driving the page.
      await expect(
        hedgerowsPostInterventionPage.navLink(BASELINE_NAV_CHILD)
      ).toHaveAttribute('href', `/projects/${project.id}/hedgerows-baseline`)

      // Hedgerows keeps its own link while its child is current — asserting
      // the href rather than counting, because the locator is nav-wide and
      // strict mode would fail if a second section were expanded too. That is
      // what still proves Area habitats collapsed here.
      await expect(
        hedgerowsPostInterventionPage.navLink(HEDGEROWS)
      ).toHaveAttribute('href', `/projects/${project.id}/hedgerows-summary`)
      await expect(hedgerowsPostInterventionPage.navLink(SUMMARY)).toBeVisible()
      await expect(
        hedgerowsPostInterventionPage.navLink(AREA_HABITATS)
      ).toBeVisible()
      // This fixture's baseline has rivers, so the conditional Watercourses
      // item renders. hedgerows-baseline.spec.js witnesses the other side of
      // the same condition, where an empty layer drops the item entirely.
      await expect(
        hedgerowsPostInterventionPage.navLink(WATERCOURSES)
      ).toBeVisible()
    })
  })

  // ─── Intervention type tabs (BMD-860 AC6, AC7) ───────────────────────────────
  //
  // Sole witness in any suite for the tab behaviour, for two separate reasons:
  //
  //  - Tab VISIBILITY runs each feature's raw `retentionCategory` through
  //    `interventionDisplay`, which strips a leading "N. " list prefix. The
  //    backend normalises the value to pick an engine calculation but never
  //    writes it back (see the header of
  //    post-intervention-habitat-details/retention.js), so the document keeps
  //    whatever the GeoPackage carried. `controller.test.js:303` hands the
  //    filter already-shaped values; only a real upload proves a surveyed file
  //    lands in the right tab.
  //  - Tab SWITCHING is the GOV.UK Tabs component — client-side JavaScript.
  //    The frontend unit tests parse markup with cheerio and never run it.
  //
  // Do not delete either test without adding a replacement that uploads a
  // hedgerow file carrying more than one retention category.

  test.describe(
    'Hedgerows post-intervention — intervention type tabs',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getHedgerowInterventionTypesProject(browser)
      })

      test(
        'shows one tab per intervention type present, with the first selected on load',
        { tag: '@happy-path' },
        async ({ hedgerowsPostInterventionPage }) => {
          await hedgerowsPostInterventionPage.open(project.id)

          // Array form asserts the rendered ORDER as well as the labels, which
          // is what AC6's "the first visible tab, from Retained, Enhanced,
          // Created" rule rests on. Order comes from INTERVENTION_TAB_ORDER,
          // not from the data.
          await expect(hedgerowsPostInterventionPage.tabs).toHaveText(ALL_TABS)

          await expectTabSelected(hedgerowsPostInterventionPage, RETAINED)

          for (const label of [ENHANCED, CREATED]) {
            await expectTabNotSelected(hedgerowsPostInterventionPage, label)
            // AC6's "additional visible tabs are links", asserted on the DOM
            // rather than the accessibility tree: role="tab" REPLACES the
            // implicit link role, so getByRole('link') can never match one.
            await expect(
              hedgerowsPostInterventionPage.tab(label)
            ).toHaveAttribute(
              'href',
              hedgerowsPostInterventionPage.tabHref(label)
            )
          }
        }
      )

      test(
        'clicking a tab selects it, moves focus and reveals its panel',
        { tag: '@happy-path' },
        async ({ hedgerowsPostInterventionPage }) => {
          await hedgerowsPostInterventionPage.open(project.id)

          await hedgerowsPostInterventionPage.tab(ENHANCED).click()

          // AC7. Selection is asserted through aria-selected, not through the
          // label ceasing to be a link: the GOV.UK component keeps every tab
          // an <a>, which withdrew that AC bullet (ticket comment 2026-09-09).
          await expectTabSelected(hedgerowsPostInterventionPage, ENHANCED)
          await expect(
            hedgerowsPostInterventionPage.tab(ENHANCED)
          ).toBeFocused()

          await expectTabNotSelected(hedgerowsPostInterventionPage, RETAINED)

          // BMD-998 AC3. Selecting Created is the only way its subheading is
          // ever asserted VISIBLE: every other test in this file sees that
          // heading hidden (an unselected panel) or absent (the two-tab
          // fixture below), and neither proves it renders when the tab is
          // chosen.
          await hedgerowsPostInterventionPage.tab(CREATED).click()
          await expectTabSelected(hedgerowsPostInterventionPage, CREATED)
          await expectTabNotSelected(hedgerowsPostInterventionPage, ENHANCED)
        }
      )
    }
  )

  test.describe(
    'Hedgerows post-intervention — project with no created hedgerows',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // Hedgerows are Retained, Enhanced and Lost — the backend drops Lost at
      // import (BMD-531/534), so the page renders exactly two tabs. The cache
      // in @utils/summary-projects.js is module state, so this pairing is free
      // whenever project-summary.spec.js has already built it in the same
      // worker — always in CI (workers: 1), never when this file runs alone.
      let project
      test.beforeAll(async ({ browser }) => {
        project = await getAllUnitTypesPostInterventionProject(browser)
      })

      // The other half of AC6's condition. `visibleInterventionTabs` filters
      // per label, so the positive case above does not prove the negative one:
      // render every tab unconditionally and that test still passes.
      test('omits the Created tab entirely', async ({
        hedgerowsPostInterventionPage
      }) => {
        await hedgerowsPostInterventionPage.open(project.id)

        await expect(hedgerowsPostInterventionPage.tabs).toHaveText([
          RETAINED,
          ENHANCED
        ])
        await expect(hedgerowsPostInterventionPage.tab(CREATED)).toHaveCount(0)
        await expect(
          hedgerowsPostInterventionPage.panelHeading(CREATED)
        ).toHaveCount(0)
        // Still the first visible tab that is selected, which is the rule AC6
        // states — not "Retained" by name.
        await expectTabSelected(hedgerowsPostInterventionPage, RETAINED)
      })
    }
  )

  // ─── Navigation wiring (BMD-860 AC2a, AC2b, AC8, AC9a, AC9b) ─────────────────

  test.describe(
    'Hedgerows post-intervention — navigation wiring',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getHedgerowInterventionTypesProject(browser)
      })

      // AC2a and AC2b. Two separate view-model paths that happen to share a
      // target: the nav child comes from `buildSectionChildren`, the tile link
      // from `hedgerowsInterventionAction`. `hedgerows-summary/controller.test.js:140`
      // proves both are rendered against mocked data; only this proves they
      // resolve — and that they render at all, which needs a project with real
      // post-intervention data (without it the tile offers the upload link
      // instead).
      test(
        'both hedgerows summary triggers open this page',
        { tag: '@happy-path' },
        async ({
          page,
          hedgerowsSummaryPage,
          hedgerowsPostInterventionPage
        }) => {
          const target = `/projects/${project.id}/${PAGE_PATH}`

          await hedgerowsSummaryPage.open(project.id)
          const interventionLink = hedgerowsSummaryPage.interventionLink()
          await expect(interventionLink).toHaveAttribute('href', target)
          await interventionLink.click()
          await expect(page).toHaveURL(new RegExp(target))
          await expect(hedgerowsPostInterventionPage.heading).toBeVisible()

          // Route two: the left nav's Post-intervention child.
          await hedgerowsSummaryPage.open(project.id)
          await hedgerowsSummaryPage
            .navLink(POST_INTERVENTION_NAV_CHILD)
            .click()
          await expect(page).toHaveURL(new RegExp(target))
          await expect(hedgerowsPostInterventionPage.heading).toBeVisible()
        }
      )

      // AC8. The unit test asserts the upload href is in the markup; only a
      // real navigation shows that following it resolves and that Back/Cancel
      // come back HERE rather than defaulting to the task list.
      test(
        '"Upload file" opens the file-type selection page, whose Back returns here',
        { tag: '@happy-path' },
        async ({ page, hedgerowsPostInterventionPage, uploadFilePage }) => {
          const target = `/projects/${project.id}/${PAGE_PATH}`
          await hedgerowsPostInterventionPage.open(project.id)

          await hedgerowsPostInterventionPage.uploadFileButton.click()

          await expect(uploadFilePage.heading).toBeVisible()
          await uploadFilePage.assertReturnLinks(target)

          await uploadFilePage.backLink.click()
          await expect(page).toHaveURL(new RegExp(target))
        }
      )

      // AC9a and AC9b. There is no back link on this page — the left nav is
      // the only way out, which is what makes following every one of its links
      // worth the click. `unit-type-navigation.test.js` proves the builder as
      // a pure function; what it cannot show is that the five hrefs resolve.
      test(
        'each left-navigation link opens its target page',
        { tag: '@happy-path' },
        async ({
          page,
          hedgerowsPostInterventionPage,
          projectSummaryPage,
          areaSummaryPage,
          hedgerowsSummaryPage,
          hedgerowsBaselinePage,
          watercoursesSummaryPage
        }) => {
          const destinations = [
            [SUMMARY, 'project-summary', projectSummaryPage.heading],
            [AREA_HABITATS, 'area-summary', areaSummaryPage.heading],
            [HEDGEROWS, 'hedgerows-summary', hedgerowsSummaryPage.heading],
            [
              BASELINE_NAV_CHILD,
              'hedgerows-baseline',
              hedgerowsBaselinePage.heading
            ],
            [
              WATERCOURSES,
              'watercourses-summary',
              watercoursesSummaryPage.heading
            ]
          ]

          for (const [label, path, heading] of destinations) {
            await hedgerowsPostInterventionPage.open(project.id)
            const target = `/projects/${project.id}/${path}`

            await expect(
              hedgerowsPostInterventionPage.navLink(label)
            ).toHaveAttribute('href', target)
            await hedgerowsPostInterventionPage.navLink(label).click()

            await expect(page).toHaveURL(new RegExp(target))
            await expect(heading).toBeVisible()
          }
        }
      )
    }
  )

  // ─── Intervention type grids (BMD-998 AC1-AC10) ──────────────────────────────
  //
  // BMD-860 shipped the tab shell; BMD-998 shipped the grids inside it. Nothing
  // in any suite rendered those grids from real data before this describe.
  //
  // `hedgerows-post-intervention/controller.test.js:365-461` asserts the
  // columns, the rows, the totals and the `aria-sort="none"` headers in
  // markup — but with `wreck` mocked and hand-built hedgerow literals, so it
  // proves the grid renders `proposed.distinctivenessScore` IF it arrives,
  // never that a real import emits it. The backend integration suite is the
  // other half of the same gap: `post-intervention-persistence.test.js:154`
  // asserts `status` and a numeric `units` for Enhanced LINEAR features and
  // nothing else — no Retained or Created hedgerow, and none of the ten
  // `proposed.*` display fields these columns read.
  //
  // Sole witness, do not delete without a replacement: these tests are the only
  // place any suite proves a real uploaded hedgerow carries the fields this
  // grid renders. See the Backend coverage proposals in the BMD-998 analysis.

  test.describe(
    'Hedgerows post-intervention — intervention type grids',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // Two projects. The first is the grid fixture: several hedgerows in each
      // of the three tabs, which is what a totals row, a default ordering and a
      // re-sort all need. The second is free — `project-summary.spec.js` builds
      // it in the same module-scope cache — and is here for one row only, see
      // ENHANCED_CALCULATED_REF.
      let project
      let enhancedProject
      test.beforeAll(async ({ browser }) => {
        project = await getLinearInterventionTypesProject(browser)
        enhancedProject = await getAllUnitTypesPostInterventionProject(browser)
      })

      // AC4a, AC5, AC7 on the Retained grid — the only tab with a Condition
      // column and no target/time-to-target block.
      test(
        'the Retained grid lists every retained hedgerow with formatted values and a totals row',
        { tag: ['@smoke', '@happy-path'] },
        async ({ hedgerowsPostInterventionPage }) => {
          const grid = hedgerowsPostInterventionPage
          await grid.open(project.id)

          // Retained is the first visible tab, so it is selected on load.
          expect(await grid.columnHeadings(RETAINED)).toEqual(RETAINED_COLUMNS)
          await expect(grid.featureRows(RETAINED)).toHaveCount(
            RETAINED_REFS.length
          )

          // AC7: sorted by ref ascending server-side. Pinned to the expected
          // refs rather than "is this array sorted" — a partial render is
          // exactly the failure a self-comparison would wave through.
          expect(await grid.columnValues(RETAINED, 'Ref')).toEqual(
            RETAINED_REFS
          )
          // ...and no column highlighted until the user clicks one.
          expect(await grid.sortStates(RETAINED)).toEqual(
            RETAINED_COLUMNS.map(() => 'none')
          )

          // Across every row, not just the first: the formatters are applied
          // per cell, so a value only some features carry would slip past a
          // row-0 check.
          await expectColumn(grid, RETAINED, 'Units', GRID_UNITS_2DP)
          await expectColumn(grid, RETAINED, 'Size', KILOMETRES)
          await expectColumn(grid, RETAINED, 'Distinctiveness', LABEL_AND_SCORE)
          await expectColumn(grid, RETAINED, 'Condition', LABEL_AND_SCORE)

          // BMD-315 AC9 pins this to Low (1) for MVS regardless of what the
          // GeoPackage carried — the engine hardcodes the multiplier to 1.
          expect(
            new Set(await grid.columnValues(RETAINED, 'Strategic significance'))
          ).toEqual(new Set([FIXED_STRATEGIC_SIGNIFICANCE]))

          // AC4's Ref link. The unit test asserts this href against a mocked
          // featureId; only a real import proves the feature has one to put in
          // it — `buildRefCell` renders a plain text cell when it does not.
          await expect(
            grid.refLink(RETAINED, RETAINED_REFS[0])
          ).toHaveAttribute('href', detailsHrefPattern(project.id))

          await expectTotalsRow(grid, RETAINED)
        }
      )

      // AC4c, AC5, AC7 on the Created grid — the 12-column shape, with the
      // target and time-to-target block in place of Condition.
      test('the Created grid carries the target and time-to-target columns', async ({
        hedgerowsPostInterventionPage
      }) => {
        const grid = hedgerowsPostInterventionPage
        await grid.open(project.id)
        await grid.tab(CREATED).click()

        expect(await grid.columnHeadings(CREATED)).toEqual(TARGET_COLUMNS)
        expect(await grid.columnHeadings(CREATED)).not.toContain('Condition')
        await expect(grid.featureRows(CREATED)).toHaveCount(CREATED_REFS.length)
        expect(await grid.columnValues(CREATED, 'Ref')).toEqual(CREATED_REFS)
        expect(await grid.sortStates(CREATED)).toEqual(
          TARGET_COLUMNS.map(() => 'none')
        )

        await expectColumn(grid, CREATED, 'Units', GRID_UNITS_2DP)
        await expectColumn(grid, CREATED, 'Size', KILOMETRES)
        await expectColumn(grid, CREATED, 'Target condition', LABEL_AND_SCORE)
        await expectColumn(
          grid,
          CREATED,
          'Standard difficulty',
          LABEL_AND_SCORE
        )

        // The three columns the FRONTEND formats (`formatYears`), so the
        // singular/plural rule is its own to keep. `Final time to target` is
        // deliberately not swept: the backend sends that cell pre-formatted
        // with a hardcoded plural, so a one-year value reads "1 years" — raised
        // during the BMD-998 manual validation (2026-09-14) and accepted by the
        // ticket owner as out of scope. It is still asserted for shape below.
        await expectColumn(grid, CREATED, 'Standard time to target', YEARS)
        await expectColumn(grid, CREATED, 'Advance', YEARS)
        await expectColumn(grid, CREATED, 'Delay', YEARS)
        await expectColumn(
          grid,
          CREATED,
          'Final time to target',
          YEARS_AND_SCORE
        )

        await expectTotalsRow(grid, CREATED)
      })

      // AC4b, AC5 on the Enhanced grid — on the OTHER project.
      //
      // This pairing's two Enhanced hedgerows do not improve on their baseline
      // condition (HG006 Good -> Good, HG009 Moderate -> Poor), so the engine
      // calculates no units for either and their Units, Distinctiveness and
      // whole target/time block render empty — the case BMD-998's AC
      // preconditions exclude ("units were successfully calculated on import").
      // HG018 in the all-unit-types fixture is the only Enhanced hedgerow in
      // any shipped fixture with a real uplift (Poor -> Moderate), so it is the
      // only row that can witness AC4b's column VALUES.
      test('the Enhanced grid carries the same columns, populated on a calculated row', async ({
        hedgerowsPostInterventionPage
      }) => {
        const grid = hedgerowsPostInterventionPage
        await grid.open(enhancedProject.id)
        await grid.tab(ENHANCED).click()

        expect(await grid.columnHeadings(ENHANCED)).toEqual(TARGET_COLUMNS)
        expect(await grid.columnHeadings(ENHANCED)).not.toContain('Condition')
        await expect(grid.featureRows(ENHANCED)).toHaveCount(
          ENHANCED_REFS.length
        )
        expect(await grid.columnValues(ENHANCED, 'Ref')).toEqual(ENHANCED_REFS)

        const cells = await grid.rowValues(ENHANCED, ENHANCED_CALCULATED_REF)
        const row = Object.fromEntries(
          TARGET_COLUMNS.map((column, index) => [column, cells[index]])
        )
        expect(row.Units).toMatch(GRID_UNITS_2DP)
        expect(row.Size).toMatch(KILOMETRES)
        expect(row.Distinctiveness).toMatch(LABEL_AND_SCORE)
        expect(row['Strategic significance']).toBe(FIXED_STRATEGIC_SIGNIFICANCE)
        expect(row['Target condition']).toMatch(LABEL_AND_SCORE)
        expect(row['Standard time to target']).toMatch(YEARS)
        expect(row.Advance).toMatch(YEARS)
        expect(row.Delay).toMatch(YEARS)
        expect(row['Final time to target']).toMatch(YEARS_AND_SCORE)
        expect(row['Standard difficulty']).toMatch(LABEL_AND_SCORE)

        await expectTotalsRow(grid, ENHANCED)
      })

      // AC8 and AC9. The `aria-sort` toggle itself is MOJ's own component
      // behaviour, already witnessed by real clicks in
      // habitat-list-upload.spec.js:342 and hedgerows-baseline.spec.js:217. Two
      // things here are not:
      //
      //  - the RESULTING ROW ORDER on THIS grid, which depends on the
      //    `data-sort-value` attributes `post-intervention-habitat-grid.js`
      //    writes — a different builder from the baseline page's; and
      //  - that `createAll(SortableTable)` binds a table sitting inside a
      //    `display:none` GOV.UK tab panel at all. Every other sortable table
      //    in the service is visible on load. No other suite can see this: the
      //    frontend unit tests parse markup with cheerio and never run the
      //    client-side JS.
      test(
        'clicking a column heading re-orders a tab grid ascending, then descending',
        { tag: '@happy-path' },
        async ({ hedgerowsPostInterventionPage }) => {
          const grid = hedgerowsPostInterventionPage
          await grid.open(project.id)

          const sizeHeader = grid
            .columnHeaders(RETAINED)
            .nth(RETAINED_COLUMNS.indexOf('Size'))
          const sortButton = grid.sortButton(RETAINED, 'Size')

          await sortButton.click()
          await expect(sizeHeader).toHaveAttribute('aria-sort', 'ascending')
          const ascending = await sizeValues(grid, RETAINED)
          expect(ascending).toHaveLength(RETAINED_REFS.length)
          expect(ascending).toEqual([...ascending].sort((a, b) => a - b))

          await sortButton.click()
          await expect(sizeHeader).toHaveAttribute('aria-sort', 'descending')
          const descending = await sizeValues(grid, RETAINED)
          expect(descending).toEqual([...descending].sort((a, b) => b - a))

          // Only the clicked column is highlighted — MOJ clears the rest.
          const states = await grid.sortStates(RETAINED)
          expect(states.filter((state) => state !== 'none')).toEqual([
            'descending'
          ])
        }
      )

      // AC6. The unit suite asserts the pane is in the markup with the right
      // aria-label; what it cannot see is whether the pane ever actually
      // overflows, which is the whole point of the requirement. Run on a
      // twelve-column grid — the seven-column Retained one is the narrow case,
      // and `hedgerows-baseline.spec.js:195` already witnesses that width on
      // its own page.
      test('a twelve-column grid sits in a pane that overflows horizontally', async ({
        hedgerowsPostInterventionPage
      }) => {
        const grid = hedgerowsPostInterventionPage
        await grid.open(project.id)
        await grid.tab(CREATED).click()

        const { scrollWidth, clientWidth, scrollLeft } =
          await grid.scrollPaneToEnd(CREATED)

        expect(scrollWidth).toBeGreaterThan(clientWidth)
        // It moved, so the overflow is scrollable rather than clipped.
        expect(scrollLeft).toBeGreaterThan(0)
      })

      // AC10a, AC10b, AC10c. `post-intervention-habitat-details.spec.js` reaches
      // these same detail pages from the DEPRECATED post-intervention habitat
      // list's Hedgerows tab, which is a different page with different Ref
      // cells; nothing witnesses the trip from this grid. Asserted once per
      // intervention type because the AC enumerates three destinations and the
      // detail page's own layout differs between them.
      test(
        'clicking a habitat reference opens that hedgerow on the post-intervention details page',
        { tag: '@happy-path' },
        async ({
          page,
          hedgerowsPostInterventionPage,
          postInterventionHabitatDetailsPage
        }) => {
          const grid = hedgerowsPostInterventionPage

          for (const [label, reference] of [
            [RETAINED, RETAINED_REFS[0]],
            [ENHANCED, ENHANCED_ON_GRID_REF],
            [CREATED, CREATED_REFS[0]]
          ]) {
            await grid.open(project.id)
            if (label !== RETAINED) {
              await grid.tab(label).click()
            }

            await grid.refLink(label, reference).click()

            await expect(page).toHaveURL(detailsHrefPattern(project.id))
            await expect(
              postInterventionHabitatDetailsPage.viewOnlyHeading
            ).toBeVisible()
            // The ref identifies WHICH hedgerow was opened — without it the
            // assertions above pass on any of the three.
            await expect(
              page.getByText(reference, { exact: true }).first()
            ).toBeVisible()
          }
        }
      )
    }
  )
})
