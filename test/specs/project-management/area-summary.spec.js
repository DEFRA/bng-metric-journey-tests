import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { uploadFileHref } from '@utils/upload-file-navigation.js'
import { getBaselineOnlyProject } from '@utils/summary-projects.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

const AREA_HABITATS = 'Area habitats'
const SUMMARY = 'Summary'
const WATERCOURSES = 'Watercourses'
const HEDGEROWS = 'Hedgerows'
const BASELINE = 'Baseline'

const TILE_BASELINE = 'On-site baseline'
const TARGET_PERCENTAGE = 'Target percentage net gain'
const TARGET_UNITS_REQUIRED = 'Units required'
const TARGET_UNIT_DEFICIT = 'Unit deficit'

const NET_GAIN_TARGET = '10%'
const UNITS_2DP = /^\d+\.\d{2} units$/

// The area summary and every other drill-down are READ-ONLY: they render a
// project that was uploaded once. `getBaselineOnlyProject` is shared with
// project-summary.spec.js through @utils/summary-projects.js, so in CI (one
// worker) this whole file costs zero additional uploads.
//
// Serial for the same reason project-summary.spec.js is: the shared build must
// happen once, and concurrent uploads clobber the single pendingUploadId key.
test.describe('project-management', { tag: '@project-management' }, () => {
  test.describe.configure({ mode: 'serial' })

  // ─── Page content ───────────────────────────────────────────────────────────

  test.describe('Area summary — page content', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    let project
    test.beforeAll(async ({ browser }) => {
      project = await getBaselineOnlyProject(browser)
    })

    // The frontend unit suite covers this page thoroughly
    // (area-summary/controller.test.js, 20 tests) but mocks `wreck` and feeds
    // it hand-written literals, so it proves the RENDERING of those fields and
    // not that the backend ever emits them. This is the journey witness that
    // real `baseline.units` reaches the page — the one thing a mocked test
    // cannot show.
    test(
      'renders the caption, heading and results from real backend data',
      { tag: ['@smoke', '@happy-path'] },
      async ({ areaSummaryPage }) => {
        await areaSummaryPage.open(project.id)

        await expect(areaSummaryPage.heading).toBeVisible()
        await expect(areaSummaryPage.caption(project.name)).toBeVisible()
        await expect(areaSummaryPage.resultsHeading).toBeVisible()

        // The section is reachable by aria-label, not by an <h2>: the shared
        // macro renders a heading only when given a headingHref, and the
        // drill-down pages give none. A heading locator that works on the
        // project summary finds nothing here.
        await expect(areaSummaryPage.unitSection()).toBeVisible()
        expect(await areaSummaryPage.tileValue(TILE_BASELINE)).toMatch(
          UNITS_2DP
        )

        // Folded in rather than paid for separately: the upload button carries
        // a returnUrl back to THIS page, not the task list.
        await expect(areaSummaryPage.uploadFileButton).toHaveAttribute(
          'href',
          uploadFileHref(project.id, `/projects/${project.id}/area-summary`)
        )
      }
    )

    // Cross-page agreement on real numbers. Both pages compute area units as
    // `habitatsTotal + treesTotal` through the same helper and format with the
    // same `formatUnits`, so the rendered strings must match exactly — a
    // mismatch means one of them is reading a different backend field.
    test('the baseline units agree with the project summary', async ({
      areaSummaryPage,
      projectSummaryPage
    }) => {
      await projectSummaryPage.open(project.id)
      const fromSummary = await projectSummaryPage.tileValue(
        AREA_HABITATS,
        TILE_BASELINE
      )

      await areaSummaryPage.open(project.id)
      const fromAreaSummary = await areaSummaryPage.tileValue(TILE_BASELINE)

      expect(fromAreaSummary).toBe(fromSummary)
    })

    // The Targets section exists nowhere else in the service — the project
    // summary has no equivalent — so nothing outside the mocked unit tests has
    // ever seen this arithmetic run on a real baseline.
    test('the targets section is computed from the real baseline', async ({
      areaSummaryPage
    }) => {
      await areaSummaryPage.open(project.id)

      await expect(areaSummaryPage.targetsSection).toBeVisible()
      expect(await areaSummaryPage.targetValue(TARGET_PERCENTAGE)).toBe(
        NET_GAIN_TARGET
      )

      const baselineUnits = await areaSummaryPage.tileUnits(TILE_BASELINE)
      const unitsRequired = await areaSummaryPage.targetValue(
        TARGET_UNITS_REQUIRED
      )
      expect(unitsRequired).toMatch(UNITS_2DP)

      // Approximate, deliberately. The page multiplies the RAW baseline by 1.1
      // and formats the product; the tile above shows the baseline already
      // rounded to 2dp. Deriving an exact expectation from the rounded value
      // can be a cent out — the same full-precision-vs-display split that
      // BMD-722 documented for the habitat list.
      expect(Number(unitsRequired.replace(' units', ''))).toBeCloseTo(
        baselineUnits * 1.1,
        1
      )

      // This one IS exact. With no post-intervention data the deficit is
      // `max(0, unitsRequired - 0)`, so it is the same number through the same
      // formatter — no rounding gap to allow for.
      expect(await areaSummaryPage.targetValue(TARGET_UNIT_DEFICIT)).toBe(
        unitsRequired
      )
    })
  })

  // ─── Navigation ─────────────────────────────────────────────────────────────

  test.describe('Area summary — navigation', { tag: '@regression' }, () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    let project
    test.beforeAll(async ({ browser }) => {
      project = await getBaselineOnlyProject(browser)
    })

    // `unit-type-navigation.test.js` proves the builder as a pure function, and
    // project-summary.spec.js witnesses the COLLAPSED state against real data.
    // The expansion is what neither covers: only an area page renders the
    // Baseline child, because buildUnitTypeItem attaches it solely when the
    // current href is area-summary or area-baseline.
    test('Area habitats is current and expands to show its Baseline child', async ({
      areaSummaryPage
    }) => {
      await areaSummaryPage.open(project.id)

      // Current item: rendered as <strong aria-current="page">, not a link.
      await expect(areaSummaryPage.navItem(AREA_HABITATS)).toHaveAttribute(
        'aria-current',
        'page'
      )
      await expect(areaSummaryPage.navLink(AREA_HABITATS)).toHaveCount(0)

      await expect(areaSummaryPage.navLink(SUMMARY)).toHaveAttribute(
        'href',
        `/projects/${project.id}/project-summary`
      )
      await expect(areaSummaryPage.baselineNavChild()).toHaveAttribute(
        'href',
        `/projects/${project.id}/area-baseline`
      )

      // The fixture's Hedgerows layer is empty, so that unit type earns no nav
      // entry; its rivers do. Same conditional the project summary applies to
      // its sections.
      await expect(areaSummaryPage.navItem(WATERCOURSES)).toBeVisible()
      await expect(areaSummaryPage.navItem(HEDGEROWS)).toHaveCount(0)
    })

    test('the project summary collapses the Area habitats section again', async ({
      projectSummaryPage,
      areaSummaryPage
    }) => {
      await projectSummaryPage.open(project.id)

      // Same nav component, different current page: moving off the area pages
      // drops the Baseline child entirely rather than leaving it expanded.
      await expect(areaSummaryPage.baselineNavChild()).toHaveCount(0)
    })
  })

  // ─── Drill-down wiring ──────────────────────────────────────────────────────

  test.describe(
    'Area summary — drill-down to the area baseline',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getBaselineOnlyProject(browser)
      })

      // Pure wiring, which is exactly what the mocked unit tests cannot show:
      // they assert the href is in the markup, not that following it resolves.
      // Both routes into the area baseline are worth pinning because they come
      // from different controller values.
      test('the baseline tile link opens the area baseline page', async ({
        areaSummaryPage,
        areaBaselinePage
      }) => {
        await areaSummaryPage.open(project.id)

        await expect(
          areaSummaryPage.viewOnSiteAreaBaselineLink()
        ).toHaveAttribute('href', `/projects/${project.id}/area-baseline`)
        await areaSummaryPage.viewOnSiteAreaBaselineLink().click()

        await expect(areaBaselinePage.heading).toBeVisible()
        await expect(areaBaselinePage.detailsTable).toBeVisible()
      })

      test('the Baseline nav child opens the area baseline page', async ({
        areaSummaryPage,
        areaBaselinePage
      }) => {
        await areaSummaryPage.open(project.id)
        await areaSummaryPage.baselineNavChild().click()

        await expect(areaBaselinePage.heading).toBeVisible()
        // The child is now the current item, and its parent keeps its link.
        await expect(areaBaselinePage.navItem(BASELINE)).toHaveAttribute(
          'aria-current',
          'page'
        )
      })
    }
  )
})
