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
  WATERCOURSES
} from '@utils/unit-type-labels.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

const UNITS_2DP = /^\d+\.\d{2}$/
const HECTARES = /^\d+(\.\d+)?ha$/
const FIXED_STRATEGIC_SIGNIFICANCE = 'Low (1)'
const REF_SORT_LOCALE = 'en'

// `Baseline - no hedgerows.gpkg` — 50 habitat parcels and 25 urban trees. The
// counts are asserted rather than hardcoded blindly: the point of the test is
// that BOTH collections reach one table, so the total is what matters.
const EXPECTED_HABITATS = 50
const EXPECTED_TREES = 25
const EXPECTED_ROWS = EXPECTED_HABITATS + EXPECTED_TREES

// BMD-857 AC5: the same five tiles the project summary and the area summary
// carry, in the same order. Baseline-only project, so the post-intervention
// tile keeps its unhyphenated heading.
const TILE_HEADINGS = [
  'Total on-site net percentage change',
  'Trading Rules',
  TILE_BASELINE,
  'On-site post intervention',
  'Total on-site net unit change'
]

// BMD-857 AC6: "{label} ({multiplier})". The score is REQUIRED, not optional:
// the controller drops it only for a non-finite multiplier, which no row of a
// valid baseline carries, and an optional group would let a regression that
// dropped every multiplier pass this test unchanged.
const LABEL_AND_SCORE = /^[^()]+ \(-?\d+(\.\d+)?\)$/

const COLUMN_HEADINGS = [
  'Ref',
  'Units',
  'Size',
  'Broad habitat',
  'Habitat type',
  'Distinctiveness',
  'Condition',
  'Strategic significance'
]

// Read-only, like every drill-down. The project comes from
// @utils/summary-projects.js, shared with project-summary.spec.js and
// area-summary.spec.js, so this file costs no upload of its own in CI.
test.describe('project-management', { tag: '@project-management' }, () => {
  test.describe.configure({ mode: 'serial' })

  test.describe('Area baseline — feature table', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    let project
    test.beforeAll(async ({ browser }) => {
      project = await getBaselineOnlyProject(browser)
    })

    // `area-baseline/controller.test.js` covers this page in 16 tests, all with
    // `wreck` mocked and hand-built features. What it cannot show is that the
    // real backend's `baseline.habitats` AND `baseline.trees` both arrive and
    // are rendered as one table — the single most load-bearing claim the page
    // makes, since trees are area habitats for units purposes but a separate
    // collection in the payload.
    test(
      'lists real habitat parcels and individual trees in one table',
      { tag: ['@smoke', '@happy-path'] },
      async ({ areaBaselinePage }) => {
        await areaBaselinePage.open(project.id)

        await expect(areaBaselinePage.heading).toBeVisible()
        await expect(areaBaselinePage.detailsTable).toBeVisible()
        await expect(areaBaselinePage.columnHeaders()).toHaveText(
          COLUMN_HEADINGS
        )

        // Parcels + trees in one table, not two.
        await expect(areaBaselinePage.featureRows()).toHaveCount(EXPECTED_ROWS)
        const refs = await areaBaselinePage.columnValues('ref')
        expect(refs.filter((r) => r.startsWith('H'))).toHaveLength(
          EXPECTED_HABITATS
        )
        expect(refs.filter((r) => r.startsWith('T'))).toHaveLength(
          EXPECTED_TREES
        )

        // Server-side ordering is by ref, ascending, across the combined list —
        // so the trees are interleaved by ref rather than appended.
        expect(refs).toEqual(
          [...refs].sort((a, b) =>
            a.localeCompare(b, REF_SORT_LOCALE, { numeric: true })
          )
        )

        // Folded in rather than paid for separately: the baseline action is
        // inert here (areaBaselineAction() with no href) because the page it
        // would link to is this one.
        await expect(
          areaBaselinePage.viewOnSiteAreaBaselineText()
        ).toBeVisible()
        await expect(
          areaBaselinePage.unitSection().getByRole('link', {
            name: 'View on-site area baseline'
          })
        ).toHaveCount(0)
      }
    )

    // The highest-value assertion on this page. The totals row is summed
    // SERVER-SIDE from the rendered features (`sumFinite` in the controller),
    // while the tile above it comes from the backend's own persisted aggregate
    // (`baseline.units.habitatsTotal + treesTotal`). Two independent paths to
    // the same number — nothing else in any suite compares them, and a
    // disagreement means either the aggregate or the feature list is wrong.
    //
    // Compared numerically with a tolerance rather than as strings: the tile
    // uses `formatUnits` (15 s.f. → 2dp) and the totals cell
    // `formatHabitatUnits` (7 s.f. → 2dp), so they can differ in the last
    // place without either being wrong. The bug this guards against — a
    // missing collection or the wrong field — is orders of magnitude larger.
    test('the totals row agrees with the backend unit aggregate', async ({
      areaBaselinePage
    }) => {
      await areaBaselinePage.open(project.id)

      const tileUnits = await areaBaselinePage.tileUnits(TILE_BASELINE)
      const totalsUnits = Number(
        await areaBaselinePage.totalsCell('units').innerText()
      )

      expect(totalsUnits).toBeCloseTo(tileUnits, 1)

      await expect(areaBaselinePage.totalsCell('ref')).toHaveText('Total')
      await expect(areaBaselinePage.totalsCell('size')).toHaveText(HECTARES)
      // The five non-numeric columns stay empty in the totals row.
      await expect(areaBaselinePage.totalsCell('broadHabitat')).toHaveText('')
      await expect(
        areaBaselinePage.totalsCell('strategicSignificance')
      ).toHaveText('')
    })

    test('every row renders formatted units, size and the fixed strategic significance', async ({
      areaBaselinePage
    }) => {
      await areaBaselinePage.open(project.id)

      // Across every row, not just the first: the formatters are applied per
      // cell, so a value that only some features carry (a non-finite score, a
      // missing size) would slip past a row-0 check.
      const [units, sizes, distinctiveness, condition, significance] =
        await Promise.all([
          areaBaselinePage.columnValues('units'),
          areaBaselinePage.columnValues('size'),
          areaBaselinePage.columnValues('distinctiveness'),
          areaBaselinePage.columnValues('condition'),
          areaBaselinePage.columnValues('strategicSignificance')
        ])

      // Length-checked as well as matched: a column that returned no cells at
      // all would satisfy its `for` loop vacuously.
      for (const column of [units, sizes, distinctiveness, condition]) {
        expect(column).toHaveLength(EXPECTED_ROWS)
      }

      for (const value of units) expect(value).toMatch(UNITS_2DP)
      for (const value of sizes) expect(value).toMatch(HECTARES)
      for (const value of distinctiveness)
        expect(value).toMatch(LABEL_AND_SCORE)
      for (const value of condition) expect(value).toMatch(LABEL_AND_SCORE)

      // BMD-315 AC9 pins this to Low (1) for MVS regardless of what the
      // GeoPackage carried — the engine hardcodes the baseline multiplier to 1,
      // so showing the uploaded category would misrepresent the units. Asserted
      // across every row because a leak would likely affect only some.
      expect(significance).toHaveLength(EXPECTED_ROWS)
      expect(new Set(significance)).toEqual(
        new Set([FIXED_STRATEGIC_SIGNIFICANCE])
      )
    })

    // BMD-857 AC6's last bullet. `controller.test.js:434` asserts the pane is
    // in the markup with the right aria-label; what it cannot see is whether
    // the pane ever actually overflows, which is the whole point of the
    // requirement — eight columns of real habitat data are what make it do so.
    // Chromium on Linux paints overlay scrollbars, so there is no bar to
    // assert on: the measurable fact is the overflow itself.
    test('the details table sits in a pane that overflows horizontally', async ({
      areaBaselinePage
    }) => {
      await areaBaselinePage.open(project.id)

      const { scrollWidth, clientWidth, scrollLeft } =
        await areaBaselinePage.scrollDetailsPaneToEnd()

      expect(scrollWidth).toBeGreaterThan(clientWidth)
      // It moved, so the overflow is scrollable rather than clipped.
      expect(scrollLeft).toBeGreaterThan(0)
    })
  })

  // ─── Page furniture (AC3, AC4, AC5, AC11, AC12) ──────────────────────────────
  //
  // The all-unit-types fixture, not the shared baseline-only one: that file has
  // an empty Hedgerows layer, so the Hedgerows nav link AC3 names never renders
  // on it. area-summary.spec.js already builds this project, so in CI (one
  // worker, module-scope cache) these tests cost no upload of their own.

  test.describe(
    'Area baseline — page furniture',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getAllUnitTypesProject(browser)
      })

      // `controller.test.js:104,124,137` covers all of this against mocked
      // `wreck` literals, which proves the RENDERING and not that a real
      // project reaches it. The upload href is the part worth pinning here
      // specifically: `uploadFileHref` is parameterised per page, so a test of
      // the helper proves the encoding while only this assertion proves THIS
      // page hands it its own returnUrl.
      test('renders the caption, results tiles and an upload action returning here', async ({
        areaBaselinePage
      }) => {
        await areaBaselinePage.open(project.id)

        await expect(areaBaselinePage.caption(project.name)).toBeVisible()
        await expect(areaBaselinePage.heading).toBeVisible()
        await expect(areaBaselinePage.resultsHeading).toBeVisible()
        await expect(areaBaselinePage.detailsHeading).toBeVisible()

        await expect(areaBaselinePage.tileHeadings()).toHaveText(TILE_HEADINGS)

        await expect(areaBaselinePage.uploadFileButton).toHaveAttribute(
          'href',
          uploadFileHref(project.id, `/projects/${project.id}/area-baseline`)
        )
      })

      // The only page in the service where the current nav item is a nested
      // CHILD and its parent stays a link — every other page marks a top-level
      // item current. `unit-type-navigation.test.js:141` proves the builder
      // produces that shape as a pure function; this proves the page renders it
      // from a project whose habitats actually earn all four entries.
      //
      // Following the links is area-summary.spec.js:260's job — the four
      // destinations are the same. What is asserted here is that this page
      // emits them at all, which on `Baseline - no hedgerows.gpkg` it could not.
      test('renders the full left navigation with Baseline as the current child', async ({
        areaBaselinePage
      }) => {
        await areaBaselinePage.open(project.id)

        await expect(areaBaselinePage.navigation).toBeVisible()
        await expect(
          areaBaselinePage.navItem(BASELINE_NAV_CHILD)
        ).toHaveAttribute('aria-current', 'page')
        await expect(areaBaselinePage.navLink(BASELINE_NAV_CHILD)).toHaveCount(
          0
        )

        const destinations = [
          [SUMMARY, 'project-summary'],
          [AREA_HABITATS, 'area-summary'],
          [HEDGEROWS, 'hedgerows-summary'],
          [WATERCOURSES, 'watercourses-summary']
        ]

        for (const [label, path] of destinations) {
          await expect(areaBaselinePage.navLink(label)).toHaveAttribute(
            'href',
            `/projects/${project.id}/${path}`
          )
        }
      })
    }
  )

  // ─── Drill-down into a feature ──────────────────────────────────────────────

  test.describe(
    'Area baseline — feature clickthrough',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getBaselineOnlyProject(browser)
      })

      // Wiring the unit tests cannot reach: they assert the href is in the
      // markup, not that following it resolves to that feature's page. The
      // href is built from HABITAT_UPLOAD_TYPES.baseline.detailsRoute with
      // featureId and projectId as query params, so this also proves the real
      // featureId the backend assigned round-trips.
      test('clicking a Ref opens that feature on the baseline habitat details page', async ({
        areaBaselinePage,
        baselineHabitatDetailsPage,
        page
      }) => {
        await areaBaselinePage.open(project.id)

        const firstRef = (await areaBaselinePage.columnValues('ref'))[0]
        await areaBaselinePage.refLink(firstRef).click()

        await page.waitForURL(/\/baseline-habitat-details\?/)
        await expect(baselineHabitatDetailsPage.heading).toBeVisible()
        // That habitat, not merely a habitat: the heading is built from the
        // feature the backend resolved the featureId to, so a link pointing at
        // the wrong row would still land on a valid page.
        await expect(baselineHabitatDetailsPage.heading).toContainText(firstRef)
        expect(page.url()).toContain(`projectId=${project.id}`)
        expect(page.url()).toContain('featureId=')
      })
    }
  )
})
