import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { getBaselineOnlyProject } from '@utils/summary-projects.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

const TILE_BASELINE = 'On-site baseline'
const UNITS_2DP = /^\d+\.\d{2}$/
const HECTARES = /^\d+(\.\d+)?ha$/
const FIXED_STRATEGIC_SIGNIFICANCE = 'Low (1)'

// `Baseline - no hedgerows.gpkg` — 50 habitat parcels and 25 urban trees. The
// counts are asserted rather than hardcoded blindly: the point of the test is
// that BOTH collections reach one table, so the total is what matters.
const EXPECTED_HABITATS = 50
const EXPECTED_TREES = 25
const EXPECTED_ROWS = EXPECTED_HABITATS + EXPECTED_TREES

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
        expect(refs).toEqual([...refs].sort((a, b) => a.localeCompare(b)))

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

      expect(await areaBaselinePage.cellText(0, 'units')).toMatch(UNITS_2DP)
      expect(await areaBaselinePage.cellText(0, 'size')).toMatch(HECTARES)

      // BMD-315 AC9 pins this to Low (1) for MVS regardless of what the
      // GeoPackage carried — the engine hardcodes the baseline multiplier to 1,
      // so showing the uploaded category would misrepresent the units. Asserted
      // across every row because a leak would likely affect only some.
      const significance = await areaBaselinePage.columnValues(
        'strategicSignificance'
      )
      expect(significance).toHaveLength(EXPECTED_ROWS)
      expect(new Set(significance)).toEqual(
        new Set([FIXED_STRATEGIC_SIGNIFICANCE])
      )
    })
  })

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
        expect(page.url()).toContain(`projectId=${project.id}`)
        expect(page.url()).toContain('featureId=')
      })
    }
  )
})
