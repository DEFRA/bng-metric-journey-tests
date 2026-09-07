import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { uploadFileHref } from '@utils/upload-file-navigation.js'
import {
  getAllUnitTypesProject,
  getBaselineOnlyProject
} from '@utils/summary-projects.js'
import {
  AREA_HABITATS,
  BASELINE_NAV_CHILD,
  HEDGEROWS,
  SUMMARY,
  TILE_BASELINE,
  VIEW_ON_SITE_WATERCOURSES_BASELINE,
  WATERCOURSES
} from '@utils/unit-type-labels.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

const BASELINE_PATH = 'watercourses-baseline'

const UNITS_2DP = /^\d+\.\d{2}$/
const KILOMETRES = /^\d+(\.\d+)?km$/
const FIXED_STRATEGIC_SIGNIFICANCE = 'Low (1)'
const REF_SORT_LOCALE = 'en'

// `Baseline - no hedgerows.gpkg` — three rivers, all Ditches. Pinned rather
// than counted loosely: a partial render is exactly the failure a `> 0` check
// would wave through.
//
// NOT `Baseline - all unit and intervention types.gpkg`, which the hedgerow
// twin uses: two of its eight rivers are Culvert/Good, a combination
// bng-metric-engine's watercourse-condition-scores.json marks "Not Possible",
// so they persist with no units and render blank Units and Distinctiveness
// cells. BMD-861's ACs are all written under a precondition that units were
// calculated for every watercourse, so the grid is judged on a fixture that
// meets it. See the flow doc's "Rows with no calculable units".
const EXPECTED_WATERCOURSES = 3

// BMD-861 AC5: the same five tiles the project summary and the watercourses
// summary carry, in the same order. Baseline-only project, so the
// post-intervention tile keeps its unhyphenated heading.
const TILE_HEADINGS = [
  'Total on-site net percentage change',
  'Trading Rules',
  TILE_BASELINE,
  'On-site post intervention',
  'Total on-site net unit change'
]

// BMD-861 AC6, as built. SEVEN columns: "Broad habitat" is an extraColumn the
// linear pages do not pass, because the field does not apply to watercourses
// (confirmed on the ticket, 2026-09-02). Headings render in GOV.UK sentence
// case rather than the AC's title case.
const COLUMN_HEADINGS = [
  'Ref',
  'Units',
  'Size',
  'Habitat type',
  'Distinctiveness',
  'Condition',
  'Strategic significance'
]

// "{label} ({multiplier})". The score is REQUIRED, not optional: the controller
// drops it only for a non-finite multiplier, which no row of a precondition-
// satisfying baseline carries, and an optional group would let a regression
// that dropped every multiplier pass unchanged.
const LABEL_AND_SCORE = /^[^()]+ \(-?\d+(\.\d+)?\)$/

// Read-only, like every drill-down. Both projects come from
// @utils/summary-projects.js and are already built by project-summary,
// area-summary, hedgerows-baseline and habitat-list, so this file costs no
// upload of its own in CI.
test.describe('project-management', { tag: '@project-management' }, () => {
  test.describe.configure({ mode: 'serial' })

  test.describe('Watercourses baseline — feature table', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    let project
    test.beforeAll(async ({ browser }) => {
      project = await getBaselineOnlyProject(browser)
    })

    // `watercourses-baseline/controller.test.js` covers this page through the
    // shared `registerLinearBaselinePageTests` suite, with `wreck` mocked and
    // two hand-built features. What it cannot show is that a REAL uploaded
    // watercourse carries the fields the grid reads: nothing in the backend
    // integration suite asserts them either — `baseline-persistence.test.js:59`
    // checks only that `units` is a number, and `features.test.js:87` seeds its
    // watercourse by hand. This is the sole witness that ref, sizeMetres,
    // distinctiveness and condition survive a real import. Do not delete
    // without adding per-feature assertions to the backend's real-upload test.
    test(
      'lists every baseline watercourse, sorted by ref, with formatted values',
      { tag: ['@smoke', '@happy-path'] },
      async ({ watercoursesBaselinePage }) => {
        await watercoursesBaselinePage.open(project.id)

        await expect(watercoursesBaselinePage.heading).toBeVisible()
        await expect(watercoursesBaselinePage.detailsHeading).toBeVisible()
        await expect(watercoursesBaselinePage.columnHeaders()).toHaveText(
          COLUMN_HEADINGS
        )
        await expect(watercoursesBaselinePage.featureRows()).toHaveCount(
          EXPECTED_WATERCOURSES
        )

        const [refs, units, sizes, distinctiveness, condition, significance] =
          await Promise.all([
            watercoursesBaselinePage.columnValues('ref'),
            watercoursesBaselinePage.columnValues('units'),
            watercoursesBaselinePage.columnValues('size'),
            watercoursesBaselinePage.columnValues('distinctiveness'),
            watercoursesBaselinePage.columnValues('condition'),
            watercoursesBaselinePage.columnValues('strategicSignificance')
          ])

        // AC7: the server sorts by ref ascending before rendering, and no
        // column is highlighted until the user clicks one.
        expect(refs).toEqual(
          [...refs].sort((a, b) =>
            a.localeCompare(b, REF_SORT_LOCALE, { numeric: true })
          )
        )
        for (const header of await watercoursesBaselinePage
          .columnHeaders()
          .all()) {
          await expect(header).toHaveAttribute('aria-sort', 'none')
        }

        // Across every row, not just the first: the formatters are applied per
        // cell, so a value only some features carry would slip past a row-0
        // check. Length-checked as well as matched — a column that returned no
        // cells at all would satisfy its `for` loop vacuously.
        for (const column of [units, sizes, distinctiveness, condition]) {
          expect(column).toHaveLength(EXPECTED_WATERCOURSES)
        }

        for (const value of units) expect(value).toMatch(UNITS_2DP)
        // Kilometres with no space before the suffix — the linear pages'
        // formatter, where the area page uses hectares.
        for (const value of sizes) expect(value).toMatch(KILOMETRES)
        for (const value of distinctiveness)
          expect(value).toMatch(LABEL_AND_SCORE)
        for (const value of condition) expect(value).toMatch(LABEL_AND_SCORE)

        // BMD-315 AC9 pins this to Low (1) for MVS regardless of what the
        // GeoPackage carried — the engine hardcodes the baseline multiplier to
        // 1, so showing the uploaded category would misrepresent the units.
        expect(significance).toHaveLength(EXPECTED_WATERCOURSES)
        expect(new Set(significance)).toEqual(
          new Set([FIXED_STRATEGIC_SIGNIFICANCE])
        )
      }
    )

    // The highest-value assertion on this page. The totals row is summed
    // SERVER-SIDE from the rendered features (`sumFinite`), while the tile
    // above it comes from the backend's own persisted aggregate
    // (`baseline.units.watercoursesTotal`). Two independent paths to the same
    // number — nothing else in any suite compares them, and a disagreement
    // means either the aggregate or the feature list is wrong.
    //
    // Compared numerically with a tolerance rather than as strings: the tile
    // uses `formatUnits` (15 s.f. → 2dp) and the totals cell
    // `formatHabitatUnits` (7 s.f. → 2dp), so they can differ in the last place
    // without either being wrong.
    test('the totals row agrees with the backend unit aggregate', async ({
      watercoursesBaselinePage
    }) => {
      await watercoursesBaselinePage.open(project.id)

      const tileUnits = await watercoursesBaselinePage.tileUnits(TILE_BASELINE)
      const totalsUnits = Number(
        await watercoursesBaselinePage.totalsCell('units').innerText()
      )

      expect(totalsUnits).toBeCloseTo(tileUnits, 1)

      await expect(watercoursesBaselinePage.totalsCell('ref')).toHaveText(
        'Total'
      )
      // The totals size uses 10 s.f. against the rows' 7 — a different
      // formatter, so it needs its own assertion rather than riding on theirs.
      await expect(watercoursesBaselinePage.totalsCell('size')).toHaveText(
        KILOMETRES
      )
      // The four non-numeric columns stay empty in the totals row.
      await expect(
        watercoursesBaselinePage.totalsCell('habitatType')
      ).toHaveText('')
      await expect(
        watercoursesBaselinePage.totalsCell('strategicSignificance')
      ).toHaveText('')
    })

    // BMD-861 AC10. Wiring the unit tests cannot reach: they assert the href is
    // in the markup, not that following it resolves to that feature's page.
    // `baseline-habitat-details.spec.js:381` does render a real watercourse,
    // but reaches it from the DEPRECATED habitat list — so this is the only
    // test tying THIS grid's Ref links to the details page. `baseline
    // .watercourses` is also a third backend collection, resolved by its own
    // branch of the features endpoint and its own details-page strategy
    // (`headingPrefix: 'Watercourse'`), which is what makes the heading
    // assertion below worth its click.
    test('clicking a Ref opens that watercourse on the baseline habitat details page', async ({
      page,
      watercoursesBaselinePage,
      baselineHabitatDetailsPage
    }) => {
      await watercoursesBaselinePage.open(project.id)

      const firstRef = (await watercoursesBaselinePage.columnValues('ref'))[0]
      await watercoursesBaselinePage.refLink(firstRef).click()

      await page.waitForURL(/\/baseline-habitat-details\?/)
      await expect(baselineHabitatDetailsPage.heading).toBeVisible()
      // That watercourse, not merely a feature: the heading is built from what
      // the backend resolved the featureId to, so a link pointing at the wrong
      // row would still land on a valid page.
      await expect(baselineHabitatDetailsPage.heading).toContainText(firstRef)
      expect(page.url()).toContain(`projectId=${project.id}`)
      expect(page.url()).toContain('featureId=')
    })
  })

  // ─── Page furniture (AC3, AC4, AC5, AC11, AC12) ──────────────────────────────

  test.describe(
    'Watercourses baseline — page furniture',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // `Baseline - all unit and intervention types.gpkg` — the only fixture
      // populating every unit type, so it is the only one that earns all four
      // nav entries. Its two unscoreable Culvert rows do not matter here: no
      // assertion in this describe reads the grid.
      let project
      test.beforeAll(async ({ browser }) => {
        project = await getAllUnitTypesProject(browser)
      })

      // The unit suite covers all of this against mocked `wreck` literals,
      // which proves the RENDERING and not that a real project reaches it. The
      // upload href is the part worth pinning specifically: `uploadFileHref` is
      // parameterised per page, so a test of the helper proves the encoding
      // while only this assertion proves THIS page hands it its own returnUrl.
      // Following the link is `hedgerows-baseline.spec.js:296`'s job — the
      // destination and its Back/Cancel behaviour are page-independent.
      test('renders the caption, five tiles and an upload action returning here', async ({
        watercoursesBaselinePage
      }) => {
        await watercoursesBaselinePage.open(project.id)

        await expect(
          watercoursesBaselinePage.caption(project.name)
        ).toBeVisible()
        await expect(watercoursesBaselinePage.heading).toBeVisible()
        await expect(watercoursesBaselinePage.resultsHeading).toBeVisible()
        await expect(watercoursesBaselinePage.tileHeadings()).toHaveText(
          TILE_HEADINGS
        )

        // AC5's bullet, amended on 2026-09-04: the baseline tile carries NO
        // action line at all — not a link, and not the inert text line the page
        // rendered before PR#266 — because it would point at this very page.
        await expect(
          watercoursesBaselinePage
            .unitSection()
            .getByRole('link', { name: VIEW_ON_SITE_WATERCOURSES_BASELINE })
        ).toHaveCount(0)
        await expect(
          watercoursesBaselinePage
            .unitSection()
            .getByText(/^View on-site (watercourses )?baseline$/)
        ).toHaveCount(0)

        await expect(watercoursesBaselinePage.uploadFileButton).toHaveAttribute(
          'href',
          uploadFileHref(project.id, `/projects/${project.id}/${BASELINE_PATH}`)
        )
      })

      // AC3 and AC12. `unit-type-navigation.test.js` proves the builder
      // produces this shape as a pure function; this proves the page renders it
      // from a project whose habitats actually earn all four entries.
      //
      // Following the links is area-summary.spec.js:260's job — the four
      // destinations are the same, and re-clicking them here would test the
      // shared macro rather than this page. What is asserted is that this page
      // emits them at all, which on a fixture without watercourses it could not.
      test('renders the full left navigation with Baseline as the current child', async ({
        watercoursesBaselinePage
      }) => {
        await watercoursesBaselinePage.open(project.id)

        await expect(watercoursesBaselinePage.navigation).toBeVisible()

        // The current item is a nested child whose PARENT stays a link — the
        // shape only the baseline pages have.
        await expect(
          watercoursesBaselinePage.navItem(BASELINE_NAV_CHILD)
        ).toHaveAttribute('aria-current', 'page')
        await expect(
          watercoursesBaselinePage.navLink(BASELINE_NAV_CHILD)
        ).toHaveCount(0)

        const destinations = [
          [SUMMARY, 'project-summary'],
          [AREA_HABITATS, 'area-summary'],
          [HEDGEROWS, 'hedgerows-summary'],
          [WATERCOURSES, 'watercourses-summary']
        ]

        for (const [label, path] of destinations) {
          await expect(watercoursesBaselinePage.navLink(label)).toHaveAttribute(
            'href',
            `/projects/${project.id}/${path}`
          )
        }
      })
    }
  )

  // ─── Entry points ────────────────────────────────────────────────────────────

  test.describe(
    'Watercourses baseline — entry points',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getAllUnitTypesProject(browser)
      })

      // BMD-861 AC1, both routes. watercourses-summary.spec.js:86 and :114
      // assert both hrefs and stop there — until this test nothing had followed
      // either, so nothing proved the page they point at renders. The
      // results-section link did not exist at all before PR#266. Do not delete
      // without moving the clicks onto another test that reaches this page from
      // the watercourses summary.
      test('both triggers on the watercourses summary open this page', async ({
        page,
        watercoursesSummaryPage,
        watercoursesBaselinePage
      }) => {
        const baselineUrl = `/projects/${project.id}/${BASELINE_PATH}`

        // Route A — the Baseline child in the left nav.
        await watercoursesSummaryPage.open(project.id)
        await watercoursesSummaryPage.navLink(BASELINE_NAV_CHILD).click()

        await expect(page).toHaveURL(new RegExp(baselineUrl))
        await expect(watercoursesBaselinePage.heading).toBeVisible()

        // Route B — "View on-site watercourses baseline" in the Results tile.
        await watercoursesSummaryPage.open(project.id)
        await watercoursesSummaryPage.baselineLink().click()

        await expect(page).toHaveURL(new RegExp(baselineUrl))
        await expect(watercoursesBaselinePage.heading).toBeVisible()
        await expect(watercoursesBaselinePage.detailsTable).toBeVisible()
      })

      // BMD-861 AC2. project-summary.spec.js:986 asserts this link's href on a
      // fixture that has watercourses, but never follows it — the area tile's
      // click at :1001 and the hedgerow tile's in hedgerows-baseline.spec.js
      // are the only two baseline tiles anyone has actually clicked from there.
      // Do not delete without moving the click onto another test that reaches
      // this page from the project summary.
      test('the project summary watercourses baseline tile opens this page', async ({
        page,
        projectSummaryPage,
        watercoursesBaselinePage
      }) => {
        await projectSummaryPage.open(project.id)

        const baselineLink =
          projectSummaryPage.viewOnSiteWatercoursesBaselineLink(WATERCOURSES)

        await expect(baselineLink).toHaveAttribute(
          'href',
          `/projects/${project.id}/${BASELINE_PATH}`
        )
        await baselineLink.click()

        await expect(page).toHaveURL(
          new RegExp(`/projects/${project.id}/${BASELINE_PATH}`)
        )
        await expect(watercoursesBaselinePage.heading).toBeVisible()
        await expect(watercoursesBaselinePage.detailsTable).toBeVisible()
      })
    }
  )
})
