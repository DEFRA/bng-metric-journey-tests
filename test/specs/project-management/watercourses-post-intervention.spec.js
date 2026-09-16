import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { uploadFileHref } from '@utils/upload-file-navigation.js'
import {
  getAllUnitTypesPostInterventionProject,
  getWatercourseInterventionTypesProject
} from '@utils/summary-projects.js'
import {
  AREA_HABITATS,
  BASELINE_NAV_CHILD,
  HEDGEROWS,
  POST_INTERVENTION_NAV_CHILD,
  SUMMARY,
  TILE_BASELINE,
  VIEW_ON_SITE_POST_INTERVENTION,
  VIEW_ON_SITE_WATERCOURSES_BASELINE,
  WATERCOURSES
} from '@utils/unit-type-labels.js'

// The watercourses post-intervention page (BMD-862) —
// `/projects/{id}/watercourses-post-intervention`. See
// test/flows/project-management/watercourses-post-intervention.flow.md.
//
// `watercourses-post-intervention/controller.test.js` already covers this
// page's markup in 13 tests, all with `wreck` mocked and four hand-built
// watercourses. Everything here is scoped to what that cannot reach: real
// backend fields, hrefs that actually resolve, and the client-side tab
// component.
//
// The hedgerow twin's tests do not stand in for any of it. Both pages come from
// `createHabitatPostInterventionController`, which takes the habitat key, the
// size reader and the `baselineUnits` selector as per-page config — so every
// one of those could be re-pointed at hedgerows with
// hedgerows-post-intervention.spec.js staying green.
//
// The grids inside the tabs are BMD-999, covered in the last describe below.
// BMD-862 shipped the tab shell; BMD-999 shipped the grids.

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
// The shared-build upload budget, applied to the whole file below. It has to
// sit on `describe.configure` rather than on a test: the build runs in
// `beforeAll`, so a `test.setTimeout()` in a test body comes too late to
// extend it.
const SHARED_BUILD_TEST_TIMEOUT = 180_000

const PAGE_PATH = 'watercourses-post-intervention'

const TILE_NET_PERCENTAGE = 'Total on-site net percentage change'
const TILE_TRADING_RULES = 'Trading Rules'
const TILE_POST_INTERVENTION = 'On-site post-intervention'
const TILE_NET_UNIT_CHANGE = 'Total on-site net unit change'

// The five tiles AC5 enumerates, in rendered order. The post-intervention
// heading is the HYPHENATED spelling — `buildPostInterventionSummary` picks it
// for a standard intervention, and the unhyphenated one only for the
// post-intervention-only shape, which this page's fixture never reaches.
const TILES = [
  TILE_NET_PERCENTAGE,
  TILE_TRADING_RULES,
  TILE_BASELINE,
  TILE_POST_INTERVENTION,
  TILE_NET_UNIT_CHANGE
]

// The three tiles whose values come from the same backend fields on the
// watercourses summary, so the two pages must render identical strings.
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

// AC5's exception, written as a pattern rather than as
// VIEW_ON_SITE_WATERCOURSES_POST_INTERVENTION: the AC spells the wording it
// wants removed "View on-site watercourse post-intervention" while the app
// spells it "View on-site watercourses post intervention", so an exact match
// against either one alone would pass while the other spelling sat on the page.
const NO_PI_SELF_LINK = /View on-site watercourses? post[- ]intervention/i

async function expectTabSelected(watercoursesPage, label) {
  await expect(watercoursesPage.tab(label)).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(watercoursesPage.panelHeading(label)).toBeVisible()
}

async function expectTabNotSelected(watercoursesPage, label) {
  await expect(watercoursesPage.tab(label)).toHaveAttribute(
    'aria-selected',
    'false'
  )
  await expect(watercoursesPage.panelHeading(label)).toBeHidden()
}

// The href half is asserted on the DOM rather than the accessibility tree:
// role="tab" REPLACES the implicit link role, so getByRole('link') can never
// match a tab.
async function expectTabsUnselectedAndLinked(watercoursesPage, labels) {
  for (const label of labels) {
    await expectTabNotSelected(watercoursesPage, label)
    await expect(
      watercoursesPage.tab(label),
      `${label} tab href`
    ).toHaveAttribute('href', watercoursesPage.tabHref(label))
  }
}

// ─── BMD-999 grid shapes ─────────────────────────────────────────────────────

// A grid cell's Units, which carries no " units" suffix — unlike the tiles above.
const GRID_UNITS_2DP = /^\d+\.\d{2}$/
// Size renders to 7 significant figures with the suffix jammed on, e.g. "0.4613278km".
const KILOMETRES = /^\d+(\.\d+)?km$/
// "{label} ({score})". The score is REQUIRED, not optional: the builder drops it
// only for a non-finite multiplier, which no calculated row carries, and an
// optional group would let a regression that dropped every multiplier pass.
const LABEL_AND_SCORE = /^[^()]+ \(-?\d+(\.\d+)?\)$/
const YEARS = /^\d+ years?$/
// "{n} year(s) ({multiplier})" — the Final time to target shape.
const YEARS_AND_SCORE = /^\d+ years? \(-?\d+(\.\d+)?\)$/
// Pinned to Low (1) for MVS (BMD-315 AC9) regardless of what the GeoPackage
// carried — the engine hardcodes the multiplier to 1.
const FIXED_STRATEGIC_SIGNIFICANCE = 'Low (1)'

// Column sets from `buildColumns` in
// common/helpers/post-intervention-habitat-grid.js, plus the two encroachment
// columns `buildWatercourseExtraColumns` adds for this unit type alone.
// Retained carries Condition; Enhanced and Created swap it for the target and
// time-to-target block. Headings render in GOV.UK sentence case, where the
// ticket's AC4 table title-cases "Watercourse Encroachment" and "Standard
// Difficulty".
const RETAINED_COLUMNS = [
  'Ref',
  'Units',
  'Size',
  'Habitat type',
  'Distinctiveness',
  'Condition',
  'Watercourse encroachment',
  'Riparian encroachment',
  'Strategic significance'
]
const TARGET_COLUMNS = [
  'Ref',
  'Units',
  'Size',
  'Habitat type',
  'Distinctiveness',
  'Watercourse encroachment',
  'Riparian encroachment',
  'Strategic significance',
  'Target condition',
  'Standard time to target',
  'Advance',
  'Delay',
  'Final time to target',
  'Standard difficulty'
]

// `Post-intervention - all unit and intervention types.gpkg`. Its other four
// watercourses are Lost, which the backend drops at import (BMD-531/534), so
// they reach no tab and it has no Created tab at all. Pinned rather than
// counted loosely: a partial render is exactly the failure a `> 0` check would
// wave through.
const MULTI_RETAINED_REFS = ['R003', 'R005']
const MULTI_ENHANCED_REFS = ['R007', 'R008']
// R008 is `Good -> Good`, so the engine calculates no units and its Units,
// Distinctiveness and whole target block render empty — the case the BMD-999
// preconditions exclude ("units were successfully calculated on import").
// R007 (`Fairly Poor -> Fairly Good`) is the only enhanced watercourse in any
// shipped fixture with a real uplift, so it is the only row that can witness
// AC4b's column VALUES.
const ENHANCED_CALCULATED_REF = 'R007'

// `Post-intervention - watercourses mixed retention.gpkg` — one watercourse per
// intervention type, and the only shipped pairing with a Created tab at all.
const MIX_RETAINED_REF = 'WC1'
const MIX_ENHANCED_REF = 'WC2'
const MIX_CREATED_REF = 'WC3'

const detailsHrefPattern = (projectId) =>
  new RegExp(
    `/post-intervention-habitat-details\\?featureId=[^&]+&projectId=${projectId}$`
  )

/** Parse a numeric column, dropping cells the engine left blank. */
const numbersIn = (values, strip = '') =>
  values
    .filter((value) => value.trim() !== '')
    .map((value) => Number(strip ? value.replace(strip, '') : value))
    .filter((value) => Number.isFinite(value))

const sum = (values) => values.reduce((total, value) => total + value, 0)

async function expectColumn(gridPage, label, heading, pattern) {
  const values = await gridPage.columnValues(label, heading)
  // Length-checked as well as matched — a column that returned no cells at all
  // would satisfy the loop vacuously.
  expect(values.length, `${label} ${heading} cells`).toBeGreaterThan(0)
  for (const value of values) {
    expect(value, `${label} ${heading} "${value}"`).toMatch(pattern)
  }
}

/**
 * AC5. The totals row is summed SERVER-SIDE from the rendered features
 * (`sumFinite`), so comparing it back against those rows is what proves the sum
 * is of THIS tab's watercourses and not of every watercourse on the project.
 *
 * Compared numerically with a tolerance rather than as strings: each row's Units
 * is already rounded to 2 dp, so a sum of rounded values can differ from the
 * rounded sum. Blank cells are dropped, matching `sumFinite`.
 */
async function expectTotalsRow(gridPage, label) {
  await expect(await gridPage.totalsCell(label, 'Ref')).toHaveText('Total')

  const totalUnits = (
    await (await gridPage.totalsCell(label, 'Units')).innerText()
  ).trim()
  const totalSize = (
    await (await gridPage.totalsCell(label, 'Size')).innerText()
  ).trim()
  expect(totalUnits, `${label} Units total`).toMatch(GRID_UNITS_2DP)
  expect(totalSize, `${label} Size total`).toMatch(KILOMETRES)

  expect(Number(totalUnits), `${label} Units total`).toBeCloseTo(
    sum(numbersIn(await gridPage.columnValues(label, 'Units'))),
    1
  )
  expect(
    Number(totalSize.replace('km', '')),
    `${label} Size total`
  ).toBeCloseTo(
    sum(numbersIn(await gridPage.columnValues(label, 'Size'), 'km')),
    3
  )

  // Every non-numeric column stays empty in the totals row.
  await expect(await gridPage.totalsCell(label, 'Habitat type')).toHaveText('')
  await expect(
    await gridPage.totalsCell(label, 'Strategic significance')
  ).toHaveText('')
}

test.describe('project-management', { tag: '@project-management' }, () => {
  // Uploads are the slowest step we own and concurrent ones clobber the shared
  // `pendingUploadId` yar key, so the file runs in one worker. The timeout is
  // the shared-build upload budget: a cold `beforeAll` here pays create + two
  // uploads, which overruns the config's 60s default.
  test.describe.configure({
    mode: 'serial',
    timeout: SHARED_BUILD_TEST_TIMEOUT
  })

  // ─── Page content (BMD-862 AC3, AC4, AC5) ───────────────────────────────────

  test.describe('Watercourses post-intervention — page content', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    let project
    test.beforeAll(async ({ browser }) => {
      project = await getWatercourseInterventionTypesProject(browser)
    })

    // AC4 and AC8's href half.
    test(
      'renders the header, project name and upload action from real backend data',
      { tag: ['@smoke', '@happy-path'] },
      async ({ watercoursesPostInterventionPage }) => {
        await watercoursesPostInterventionPage.open(project.id)

        await expect(watercoursesPostInterventionPage.heading).toBeVisible()
        await expect(
          watercoursesPostInterventionPage.caption(project.name)
        ).toBeVisible()
        await expect(
          watercoursesPostInterventionPage.resultsHeading
        ).toBeVisible()
        await expect(
          watercoursesPostInterventionPage.detailsHeading
        ).toBeVisible()

        // The upload button's returnUrl is built by THIS controller for this
        // page. The watercourses summary asserting its own copy proves nothing
        // here — the value is chosen per caller, so each page needs its own
        // witness.
        await expect(
          watercoursesPostInterventionPage.uploadFileButton
        ).toHaveAttribute(
          'href',
          uploadFileHref(project.id, `/projects/${project.id}/${PAGE_PATH}`)
        )
      }
    )

    // AC5.
    test('renders the five results tiles with no post-intervention self-link', async ({
      watercoursesPostInterventionPage
    }) => {
      await watercoursesPostInterventionPage.open(project.id)

      await expect(watercoursesPostInterventionPage.tileHeadings()).toHaveText(
        TILES
      )

      // Reads `postIntervention.units.watercoursesTotal` and
      // `baseline.units.watercoursesTotal` — different backend fields from the
      // hedgerow page's hedgerowsTotal and the area page's habitatsTotal +
      // treesTotal. The frontend unit tests mock wreck, so nothing else proves
      // these fields are really emitted.
      expect(
        await watercoursesPostInterventionPage.tileValue(TILE_BASELINE)
      ).toMatch(UNITS_2DP)
      expect(
        await watercoursesPostInterventionPage.tileValue(TILE_POST_INTERVENTION)
      ).toMatch(UNITS_2DP)

      // AC5's exception. The baseline tile keeps its link while the
      // post-intervention tile has NO action line at all: the controller
      // passes `interventionAction: null`, which `resolveInterventionAction`
      // treats differently from `undefined` (which would fall back to the
      // shared inert "View on-site post intervention" default). A mock that
      // passes neither renders identically, so only the real controller
      // distinguishes them.
      const section = watercoursesPostInterventionPage.unitSection()
      await expect(section.getByText(NO_PI_SELF_LINK)).toHaveCount(0)
      await expect(
        section.getByText(VIEW_ON_SITE_POST_INTERVENTION, { exact: true })
      ).toHaveCount(0)
      await expect(
        section.getByRole('link', { name: VIEW_ON_SITE_WATERCOURSES_BASELINE })
      ).toBeVisible()
    })

    // AC5: "the same set of tiles as shown on the Project Summary page and the
    // Watercourses Unit Summary page". Both pages read `watercoursesTotal`
    // through the same formatter, so the rendered strings must match exactly —
    // a mismatch means one of them has been re-pointed at a different backend
    // field. Compared nowhere else.
    test('the results tiles agree with the watercourses summary page', async ({
      watercoursesPostInterventionPage,
      watercoursesSummaryPage
    }) => {
      await watercoursesSummaryPage.open(project.id)
      const fromSummary = {}
      for (const tile of SHARED_TILES) {
        fromSummary[tile] = await watercoursesSummaryPage.tileValue(tile)
      }

      await watercoursesPostInterventionPage.open(project.id)
      for (const tile of SHARED_TILES) {
        expect(
          await watercoursesPostInterventionPage.tileValue(tile),
          tile
        ).toBe(fromSummary[tile])
      }
    })

    // AC3. The only shape in the service where the current nav item is a
    // Post-intervention child nested under WATERCOURSES.
    // `unit-type-navigation.test.js` proves the builder as a pure function and
    // `watercourses-post-intervention/controller.test.js:219` proves the markup
    // against a mocked payload; neither shows the conditional items surviving a
    // real import. Both conditions are live in this fixture: the baseline
    // carries WC1 (so the Baseline child renders) and two hedgerows (so the
    // Hedgerows item renders even though the post-intervention file has none).
    test('the left navigation marks this page current under Watercourses', async ({
      watercoursesPostInterventionPage
    }) => {
      await watercoursesPostInterventionPage.open(project.id)

      for (const item of [SUMMARY, AREA_HABITATS, HEDGEROWS, WATERCOURSES]) {
        await expect(
          watercoursesPostInterventionPage.navLink(item),
          `nav link "${item}"`
        ).toBeVisible()
      }

      await expect(
        watercoursesPostInterventionPage.navLink(BASELINE_NAV_CHILD)
      ).toHaveAttribute(
        'href',
        `/projects/${project.id}/watercourses-baseline-summary`
      )

      // "In bold, to indicate it is the current page" is a <strong
      // aria-current="page"> with no href — markCurrent deletes the href, so
      // there is nothing left to click.
      await expect(
        watercoursesPostInterventionPage.currentNavItem()
      ).toHaveText(POST_INTERVENTION_NAV_CHILD)
      await expect(
        watercoursesPostInterventionPage.navLink(POST_INTERVENTION_NAV_CHILD)
      ).toHaveCount(0)
    })
  })

  // ─── Intervention type tabs (BMD-862 AC6, AC7) ──────────────────────────────
  //
  // Sole witness in any suite for the WATERCOURSE tab behaviour, for three
  // separate reasons:
  //
  //  - Tab VISIBILITY runs each feature's raw `retentionCategory` through
  //    `interventionDisplay`, which strips a leading "N. " list prefix. The
  //    backend normalises the value to pick an engine calculation but never
  //    writes it back (see the header of
  //    post-intervention-habitat-details/retention.js), so the document keeps
  //    whatever the GeoPackage carried. `controller.test.js:248` hands the
  //    filter already-shaped values — one of them the literal '1. Enhanced' —
  //    so only a real upload proves a surveyed file lands in the right tab.
  //  - Tab SWITCHING is the GOV.UK Tabs component — client-side JavaScript.
  //    The frontend unit tests parse markup with cheerio and never run it.
  //  - `visibleInterventionTabs` is called per unit type with that unit type's
  //    own features, so the hedgerow tab tests in
  //    hedgerows-post-intervention.spec.js witness none of this.
  //
  // Do not delete without adding a replacement that uploads a watercourse file
  // carrying more than one retention category.

  test.describe(
    'Watercourses post-intervention — intervention type tabs',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getWatercourseInterventionTypesProject(browser)
      })

      // AC6.
      test(
        'shows one tab per intervention type present, with the first selected on load',
        { tag: '@happy-path' },
        async ({ watercoursesPostInterventionPage }) => {
          await watercoursesPostInterventionPage.open(project.id)

          // Array form asserts the rendered ORDER as well as the labels, which
          // is what AC6's "the first visible tab, from Retained, Enhanced,
          // Created" rule rests on. Order comes from INTERVENTION_TAB_ORDER,
          // not from the data — the fixture's WC1/WC2/WC3 are Retained,
          // Enhanced and Created respectively.
          await expect(watercoursesPostInterventionPage.tabs).toHaveText(
            ALL_TABS
          )

          await expectTabSelected(watercoursesPostInterventionPage, RETAINED)

          // AC6's "additional visible tabs are links".
          await expectTabsUnselectedAndLinked(
            watercoursesPostInterventionPage,
            [ENHANCED, CREATED]
          )
        }
      )

      // AC7.
      test(
        'clicking a tab selects it, moves focus and reveals its panel',
        { tag: '@happy-path' },
        async ({ watercoursesPostInterventionPage }) => {
          await watercoursesPostInterventionPage.open(project.id)

          await watercoursesPostInterventionPage.tab(ENHANCED).click()

          // Selection is asserted through aria-selected, not through the label
          // ceasing to be a link: the GOV.UK component keeps every tab an <a>.
          // The AC's "becomes text only (not a link)" bullet was withdrawn on
          // the hedgerow twin (BMD-860 ticket comment, 2026-09-09) for exactly
          // this reason; BMD-862 repeats the bullet but not the withdrawal.
          await expectTabSelected(watercoursesPostInterventionPage, ENHANCED)
          await expect(
            watercoursesPostInterventionPage.tab(ENHANCED)
          ).toBeFocused()

          await expectTabsUnselectedAndLinked(
            watercoursesPostInterventionPage,
            [RETAINED, CREATED]
          )

          // Selecting Created is the only way its subheading is ever asserted
          // VISIBLE: every other test in this file sees that heading hidden.
          await watercoursesPostInterventionPage.tab(CREATED).click()
          await expectTabSelected(watercoursesPostInterventionPage, CREATED)
          await expectTabNotSelected(watercoursesPostInterventionPage, ENHANCED)
        }
      )
    }
  )

  // ─── Navigation wiring (BMD-862 AC2a, AC2b, AC8, AC9) ───────────────────────

  test.describe(
    'Watercourses post-intervention — navigation wiring',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getWatercourseInterventionTypesProject(browser)
      })

      // AC2a and AC2b. Two separate view-model paths that happen to share a
      // target: the nav child comes from `buildSectionChildren`, the tile link
      // from `watercoursesInterventionAction`.
      // `watercourses-summary/controller.test.js:138,300` proves both are
      // rendered against mocked data, and watercourses-summary.spec.js:251
      // proves the tile link is VISIBLE on real data — but until this test
      // neither had been followed, and neither had its href checked against
      // real data.
      test(
        'both watercourses summary triggers open this page',
        { tag: '@happy-path' },
        async ({
          page,
          watercoursesSummaryPage,
          watercoursesPostInterventionPage
        }) => {
          const target = `/projects/${project.id}/${PAGE_PATH}`

          await watercoursesSummaryPage.open(project.id)
          const interventionLink = watercoursesSummaryPage.interventionLink()
          await expect(interventionLink).toHaveAttribute('href', target)
          await interventionLink.click()
          await expect(page).toHaveURL(new RegExp(target))
          await expect(watercoursesPostInterventionPage.heading).toBeVisible()

          // Route two: the left nav's Post-intervention child.
          await watercoursesSummaryPage.open(project.id)
          await watercoursesSummaryPage
            .navLink(POST_INTERVENTION_NAV_CHILD)
            .click()
          await expect(page).toHaveURL(new RegExp(target))
          await expect(watercoursesPostInterventionPage.heading).toBeVisible()
        }
      )

      // AC8. The unit test asserts the upload href is in the markup; only a
      // real navigation shows that following it resolves and that Back/Cancel
      // come back HERE rather than defaulting to the task list.
      test(
        '"Upload file" opens the file-type selection page, whose Back returns here',
        { tag: '@happy-path' },
        async ({ page, watercoursesPostInterventionPage, uploadFilePage }) => {
          const target = `/projects/${project.id}/${PAGE_PATH}`
          await watercoursesPostInterventionPage.open(project.id)

          await watercoursesPostInterventionPage.uploadFileButton.click()

          await expect(uploadFilePage.heading).toBeVisible()
          await uploadFilePage.assertReturnLinks(target)

          await uploadFilePage.backLink.click()
          await expect(page).toHaveURL(new RegExp(target))
        }
      )

      // AC9. There is no back link on this page — the left nav is the only way
      // out, which is what makes following every one of its links worth the
      // click. `unit-type-navigation.test.js` proves the builder as a pure
      // function; what it cannot show is that the five hrefs resolve.
      test(
        'each left-navigation link opens its target page',
        { tag: '@happy-path' },
        async ({
          page,
          watercoursesPostInterventionPage,
          projectSummaryPage,
          areaSummaryPage,
          hedgerowsSummaryPage,
          watercoursesSummaryPage,
          watercoursesBaselinePage
        }) => {
          const destinations = [
            [SUMMARY, 'project-summary', projectSummaryPage.heading],
            [AREA_HABITATS, 'area-summary', areaSummaryPage.heading],
            [HEDGEROWS, 'hedgerows-summary', hedgerowsSummaryPage.heading],
            [
              WATERCOURSES,
              'watercourses-summary',
              watercoursesSummaryPage.heading
            ],
            [
              BASELINE_NAV_CHILD,
              'watercourses-baseline-summary',
              watercoursesBaselinePage.heading
            ]
          ]

          for (const [label, path, heading] of destinations) {
            await watercoursesPostInterventionPage.open(project.id)
            const target = `/projects/${project.id}/${path}`

            await expect(
              watercoursesPostInterventionPage.navLink(label)
            ).toHaveAttribute('href', target)
            await watercoursesPostInterventionPage.navLink(label).click()

            await expect(page).toHaveURL(new RegExp(target))
            await expect(heading).toBeVisible()
          }
        }
      )
    }
  )

  // ─── Intervention type grids (BMD-999 AC4-AC10) ─────────────────────────────
  //
  // BMD-862 shipped the tab shell; BMD-999 shipped the grids inside it. Nothing
  // in any suite rendered a watercourse grid from real data before this
  // describe. AC1, AC2 and AC3 — the tab subheadings — are already asserted by
  // the intervention type tabs describe above, so they are not repeated here.
  //
  // `watercourses-post-intervention/controller.test.js:279-415` asserts the
  // columns, the rows, the totals and the `aria-sort="none"` headers in
  // markup — but with `wreck` mocked and hand-built watercourse literals
  // (`:28-56`), so it proves the grid renders `riparianEncroachmentMultiplier`
  // IF it arrives, never that a real import emits it. The backend is the other
  // half of the same gap: `post-intervention-persistence.test.js:154-177`
  // asserts `status` and a numeric `units` for Enhanced LINEAR features and
  // nothing else — no Retained or Created watercourse, and none of the display
  // fields these columns read.
  //
  // The neighbours do not stand in. The DEPRECATED post-intervention habitat
  // list renders watercourse units and a totals row from real data
  // (post-intervention-habitat-list.spec.js:826,845) but is built by
  // `createHabitatListController`, a different builder. The hedgerow twin
  // (hedgerows-post-intervention.spec.js:646) shares
  // `buildPostInterventionHabitatGrid`, but the factory takes
  // `buildExtraColumns` as per-page config and `buildWatercourseExtraColumns`
  // is watercourse-only.
  //
  // Sole witness, do not delete without a replacement: these are the only tests
  // in any suite where a real uploaded watercourse's encroachment fields reach
  // a rendered grid. See the Backend coverage proposals in the BMD-999 analysis.

  test.describe(
    'Watercourses post-intervention — intervention type grids',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // Two projects. `multiProject` is the grid fixture: several watercourses
      // in the Retained and Enhanced tabs, which is what a totals row worth
      // summing, a default ordering and a re-sort all need — and it is free,
      // project-summary.spec.js builds it in the same module-scope cache.
      // `mixProject` is this file's own, and the only shipped pairing with a
      // Created tab.
      let mixProject
      let multiProject
      test.beforeAll(async ({ browser }) => {
        mixProject = await getWatercourseInterventionTypesProject(browser)
        multiProject = await getAllUnitTypesPostInterventionProject(browser)
      })

      // AC4a, AC5, AC7 on the Retained grid — the only tab with a Condition
      // column and no target/time-to-target block.
      test(
        'the Retained grid lists every retained watercourse with formatted values and a totals row',
        { tag: '@happy-path' },
        async ({ watercoursesPostInterventionPage }) => {
          const grid = watercoursesPostInterventionPage
          await grid.open(multiProject.id)

          // Retained is the first visible tab, so it is selected on load.
          expect(await grid.columnHeadings(RETAINED)).toEqual(RETAINED_COLUMNS)
          await expect(grid.featureRows(RETAINED)).toHaveCount(
            MULTI_RETAINED_REFS.length
          )

          // AC7: sorted by ref ascending server-side, with no column
          // highlighted until the user clicks one.
          expect(await grid.columnValues(RETAINED, 'Ref')).toEqual(
            MULTI_RETAINED_REFS
          )
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
          // The watercourse-only pair. Nothing else in any suite renders these
          // from a real import.
          await expectColumn(
            grid,
            RETAINED,
            'Watercourse encroachment',
            LABEL_AND_SCORE
          )
          await expectColumn(
            grid,
            RETAINED,
            'Riparian encroachment',
            LABEL_AND_SCORE
          )
          expect(
            new Set(await grid.columnValues(RETAINED, 'Strategic significance'))
          ).toEqual(new Set([FIXED_STRATEGIC_SIGNIFICANCE]))

          // AC4's Ref link. The unit test asserts this href against a mocked
          // featureId; only a real import proves the feature has one to put in
          // it — `buildRefCell` renders a plain text cell when it does not.
          await expect(
            grid.refLink(RETAINED, MULTI_RETAINED_REFS[0])
          ).toHaveAttribute('href', detailsHrefPattern(multiProject.id))

          await expectTotalsRow(grid, RETAINED)
        }
      )

      // AC4b, AC5, AC6 on the Enhanced grid — the 14-column shape, with the
      // target and time-to-target block in place of Condition.
      test('the Enhanced grid carries the target columns and sits in a pane that overflows', async ({
        watercoursesPostInterventionPage
      }) => {
        const grid = watercoursesPostInterventionPage
        await grid.open(multiProject.id)
        await grid.tab(ENHANCED).click()

        expect(await grid.columnHeadings(ENHANCED)).toEqual(TARGET_COLUMNS)
        expect(await grid.columnHeadings(ENHANCED)).not.toContain('Condition')
        await expect(grid.featureRows(ENHANCED)).toHaveCount(
          MULTI_ENHANCED_REFS.length
        )
        expect(await grid.columnValues(ENHANCED, 'Ref')).toEqual(
          MULTI_ENHANCED_REFS
        )

        // Asserted on the one calculated row rather than swept across the
        // column: R008 has no condition uplift, so the engine calculates no
        // units and its cells render empty — the case the ACs' own precondition
        // excludes. See ENHANCED_CALCULATED_REF.
        const cells = await grid.rowValues(ENHANCED, ENHANCED_CALCULATED_REF)
        const row = Object.fromEntries(
          TARGET_COLUMNS.map((column, index) => [column, cells[index]])
        )
        expect(row.Units).toMatch(GRID_UNITS_2DP)
        expect(row.Size).toMatch(KILOMETRES)
        expect(row.Distinctiveness).toMatch(LABEL_AND_SCORE)
        expect(row['Watercourse encroachment']).toMatch(LABEL_AND_SCORE)
        expect(row['Riparian encroachment']).toMatch(LABEL_AND_SCORE)
        expect(row['Strategic significance']).toBe(FIXED_STRATEGIC_SIGNIFICANCE)
        expect(row['Target condition']).toMatch(LABEL_AND_SCORE)
        expect(row['Standard time to target']).toMatch(YEARS)
        expect(row.Advance).toMatch(YEARS)
        expect(row.Delay).toMatch(YEARS)
        expect(row['Final time to target']).toMatch(YEARS_AND_SCORE)
        expect(row['Standard difficulty']).toMatch(LABEL_AND_SCORE)

        await expectTotalsRow(grid, ENHANCED)

        // AC6. The unit suite asserts the pane is in the markup with the right
        // aria-label; what it cannot see is whether the pane ever actually
        // overflows, which is the whole point of the requirement. Run on the
        // 14-column grid — the 9-column Retained one is the narrow case.
        const { scrollWidth, clientWidth, scrollLeft } =
          await grid.scrollPaneToEnd(ENHANCED)

        expect(scrollWidth).toBeGreaterThan(clientWidth)
        // It moved, so the overflow is scrollable rather than clipped.
        expect(scrollLeft).toBeGreaterThan(0)
      })

      // AC4c and AC5 on the Created grid — the same column set as Enhanced,
      // reached through a different retention path, on the only shipped pairing
      // that has a Created tab at all.
      test('the Created grid carries the same columns as Enhanced', async ({
        watercoursesPostInterventionPage
      }) => {
        const grid = watercoursesPostInterventionPage
        await grid.open(mixProject.id)
        await grid.tab(CREATED).click()

        expect(await grid.columnHeadings(CREATED)).toEqual(TARGET_COLUMNS)
        expect(await grid.columnHeadings(CREATED)).not.toContain('Condition')
        await expect(grid.featureRows(CREATED)).toHaveCount(1)
        expect(await grid.columnValues(CREATED, 'Ref')).toEqual([
          MIX_CREATED_REF
        ])

        await expectColumn(grid, CREATED, 'Units', GRID_UNITS_2DP)
        await expectColumn(grid, CREATED, 'Size', KILOMETRES)
        await expectColumn(
          grid,
          CREATED,
          'Watercourse encroachment',
          LABEL_AND_SCORE
        )
        await expectColumn(
          grid,
          CREATED,
          'Riparian encroachment',
          LABEL_AND_SCORE
        )
        await expectColumn(grid, CREATED, 'Target condition', LABEL_AND_SCORE)
        await expectColumn(grid, CREATED, 'Standard time to target', YEARS)
        await expectColumn(grid, CREATED, 'Advance', YEARS)
        await expectColumn(grid, CREATED, 'Delay', YEARS)
        await expectColumn(
          grid,
          CREATED,
          'Final time to target',
          YEARS_AND_SCORE
        )
        await expectColumn(
          grid,
          CREATED,
          'Standard difficulty',
          LABEL_AND_SCORE
        )

        await expect(grid.refLink(CREATED, MIX_CREATED_REF)).toHaveAttribute(
          'href',
          detailsHrefPattern(mixProject.id)
        )

        await expectTotalsRow(grid, CREATED)
      })

      // AC8 and AC9. The `aria-sort` toggle itself is MOJ's own component
      // behaviour, already witnessed by real clicks in
      // habitat-list-upload.spec.js:342 and watercourses-baseline.spec.js. Two
      // things here are not:
      //
      //  - the RESULTING ROW ORDER on THIS grid, which depends on the
      //    `data-sort-value` attributes `post-intervention-habitat-grid.js`
      //    writes — a different builder from the baseline page's; and
      //  - that `createAll(SortableTable)` binds a table sitting inside a
      //    `display:none` GOV.UK tab panel at all. No other suite can see this:
      //    the frontend unit tests parse markup with cheerio and never run the
      //    client-side JS.
      test(
        'clicking a column heading re-orders a tab grid ascending, then descending',
        { tag: '@happy-path' },
        async ({ watercoursesPostInterventionPage }) => {
          const grid = watercoursesPostInterventionPage
          await grid.open(multiProject.id)

          const sizeHeader = grid
            .columnHeaders(RETAINED)
            .nth(RETAINED_COLUMNS.indexOf('Size'))
          const sortButton = grid.sortButton(RETAINED, 'Size')

          await sortButton.click()
          await expect(sizeHeader).toHaveAttribute('aria-sort', 'ascending')
          const ascending = numbersIn(
            await grid.columnValues(RETAINED, 'Size'),
            'km'
          )
          expect(ascending).toHaveLength(MULTI_RETAINED_REFS.length)
          expect(ascending).toEqual([...ascending].sort((a, b) => a - b))

          await sortButton.click()
          await expect(sizeHeader).toHaveAttribute('aria-sort', 'descending')
          const descending = numbersIn(
            await grid.columnValues(RETAINED, 'Size'),
            'km'
          )
          expect(descending).toEqual([...descending].sort((a, b) => b - a))

          // Only the clicked column is highlighted — MOJ clears the rest.
          const states = await grid.sortStates(RETAINED)
          expect(states.filter((state) => state !== 'none')).toEqual([
            'descending'
          ])
        }
      )

      // AC10. `post-intervention-habitat-details.spec.js` reaches these same
      // detail pages by harvesting a featureId from the DEPRECATED
      // post-intervention habitat list and opening the URL; nothing witnesses
      // the trip from this grid. Asserted once per intervention type because
      // the AC enumerates three destinations and the detail page's own layout
      // differs between them.
      test(
        'clicking a habitat reference opens that watercourse on the post-intervention details page',
        { tag: '@happy-path' },
        async ({
          page,
          watercoursesPostInterventionPage,
          postInterventionHabitatDetailsPage
        }) => {
          const grid = watercoursesPostInterventionPage

          for (const [label, reference] of [
            [RETAINED, MIX_RETAINED_REF],
            [ENHANCED, MIX_ENHANCED_REF],
            [CREATED, MIX_CREATED_REF]
          ]) {
            await grid.open(mixProject.id)
            if (label !== RETAINED) {
              await grid.tab(label).click()
            }

            await grid.refLink(label, reference).click()

            await expect(page).toHaveURL(detailsHrefPattern(mixProject.id))
            await expect(
              postInterventionHabitatDetailsPage.viewOnlyHeading
            ).toBeVisible()
            // The ref identifies WHICH watercourse was opened — without it the
            // assertion passes for any of the three.
            await expect(
              page.getByRole('heading', { name: reference, level: 1 })
            ).toBeVisible()
          }
        }
      )
    }
  )
})
