import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import {
  getAllUnitTypesProject,
  getBaselineOnlyProject,
  getHedgerowGainProject
} from '@utils/summary-projects.js'
import {
  AREA_HABITATS,
  BASELINE_NAV_CHILD,
  HEDGEROWS,
  SUMMARY,
  TILE_BASELINE
} from '@utils/unit-type-labels.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

const TILE_NET_PERCENTAGE = 'Total on-site net percentage change'
const TILE_POST_INTERVENTION = 'On-site post intervention'
const TARGET_PERCENTAGE = 'Target percentage net gain'
const TARGET_UNITS_REQUIRED = 'Units required'
const TARGET_UNIT_DEFICIT = 'Unit deficit'

const NET_GAIN_TARGET = '10%'
const ZERO_UNITS = '0.00 units'
const UNITS_2DP = /^\d+\.\d{2} units$/
const POST_INTERVENTION_ONLY_PERCENTAGE = 'Not applicable'

// This page is structurally identical to the area summary, so the tests below
// deliberately do NOT re-assert the shared layout, the targets arithmetic or the
// nav mechanics — area-summary.spec.js witnesses all of that against real data,
// and repeating it here would test the shared macro rather than this page's
// wiring. What is covered here is only what differs: the hedgerow BACKEND
// FIELDS, the inert baseline tile, and the post-intervention-only variant.
test.describe('project-management', { tag: '@project-management' }, () => {
  test.describe.configure({ mode: 'serial' })

  test.describe('Hedgerows summary — page content', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    let project
    test.beforeAll(async ({ browser }) => {
      project = await getAllUnitTypesProject(browser)
    })

    test(
      'renders hedgerow figures and targets from real backend data',
      { tag: ['@smoke', '@happy-path'] },
      async ({ hedgerowsSummaryPage }) => {
        await hedgerowsSummaryPage.open(project.id)

        await expect(hedgerowsSummaryPage.heading).toBeVisible()
        await expect(hedgerowsSummaryPage.caption(project.name)).toBeVisible()

        // Reads `baseline.units.hedgerowsTotal`, a different backend field from
        // the area page's habitatsTotal + treesTotal. The frontend unit tests
        // mock wreck, so nothing else proves this field is really emitted.
        expect(await hedgerowsSummaryPage.tileValue(TILE_BASELINE)).toMatch(
          UNITS_2DP
        )

        await expect(hedgerowsSummaryPage.targetsSection).toBeVisible()
        expect(await hedgerowsSummaryPage.targetValue(TARGET_PERCENTAGE)).toBe(
          NET_GAIN_TARGET
        )
        // Baseline-only, so the deficit is the whole requirement — same number
        // through the same formatter, hence an exact comparison.
        expect(
          await hedgerowsSummaryPage.targetValue(TARGET_UNIT_DEFICIT)
        ).toBe(await hedgerowsSummaryPage.targetValue(TARGET_UNITS_REQUIRED))
      }
    )

    // The one deliberate difference from the area summary. No hedgerow baseline
    // page exists, so the controller passes no `baselineAction` and the tile
    // falls back to the shared inert default — note the wording drops the word
    // "area" the linked variant carries.
    test('the baseline tile is inert, with no "area" in its wording', async ({
      hedgerowsSummaryPage
    }) => {
      await hedgerowsSummaryPage.open(project.id)

      await expect(hedgerowsSummaryPage.viewOnSiteBaselineText()).toBeVisible()
      await expect(hedgerowsSummaryPage.baselineAction()).toHaveCount(0)
      await expect(
        hedgerowsSummaryPage
          .unitSection()
          .getByText('View on-site area baseline')
      ).toHaveCount(0)
    })

    test('Hedgerows is current and the Area habitats section is collapsed', async ({
      hedgerowsSummaryPage
    }) => {
      await hedgerowsSummaryPage.open(project.id)

      await expect(hedgerowsSummaryPage.navItem(HEDGEROWS)).toHaveAttribute(
        'aria-current',
        'page'
      )
      // Moving to a different unit type collapses the one you came from, so the
      // Baseline child is gone even though Area habitats still links.
      await expect(hedgerowsSummaryPage.navLink(AREA_HABITATS)).toBeVisible()
      await expect(
        hedgerowsSummaryPage.navLink(BASELINE_NAV_CHILD)
      ).toHaveCount(0)
      await expect(hedgerowsSummaryPage.navLink(SUMMARY)).toBeVisible()
    })
  })

  // ─── Post-intervention-only hedgerows (BMD-897) ──────────────────────────────

  test.describe(
    'Hedgerows summary — post-intervention-only hedgerows',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getHedgerowGainProject(browser)
      })

      // project-summary.spec.js witnesses this variant on the PROJECT SUMMARY.
      // It needs its own witness here because `hasPostInterventionOnlyHabitat`
      // is called separately by each controller with its own habitat-type
      // argument — a shared helper is not shared coverage when the caller
      // chooses the parameter. Point this page's call at the wrong type and
      // every other test still passes.
      test('a hedgerow gained from a zero baseline shows "Not applicable" and no baseline action', async ({
        hedgerowsSummaryPage
      }) => {
        await hedgerowsSummaryPage.open(project.id)

        expect(await hedgerowsSummaryPage.tileValue(TILE_BASELINE)).toBe(
          ZERO_UNITS
        )
        expect(await hedgerowsSummaryPage.tileValue(TILE_NET_PERCENTAGE)).toBe(
          POST_INTERVENTION_ONLY_PERCENTAGE
        )

        // No baseline to compare against, so no Met/Not met tag is rendered.
        await expect(
          hedgerowsSummaryPage.unitSection().getByText(/^(Met|Not met)$/)
        ).toHaveCount(0)

        // BMD-897 nulls the baseline action entirely for this state — the inert
        // line is not rendered at all, rather than rendered without a link.
        await expect(hedgerowsSummaryPage.viewOnSiteBaselineText()).toHaveCount(
          0
        )

        // And the tile keeps the UNHYPHENATED heading, because the variant is
        // treated as "not a standard intervention".
        expect(
          await hedgerowsSummaryPage.tileValue(TILE_POST_INTERVENTION)
        ).toMatch(UNITS_2DP)
      })
    }
  )

  // ─── Reachable without hedgerow data ─────────────────────────────────────────

  test.describe(
    'Hedgerows summary — project with no hedgerow data',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getBaselineOnlyProject(browser)
      })

      // The nav entry is conditional on the project having hedgerow data; the
      // ROUTE is not. So a stale bookmark still renders the page — showing
      // zeroes, with nothing in the nav marked current because there is no
      // Hedgerows item to mark. Documented as an oddity in the flow doc rather
      // than an intended design; pinned here so a deliberate change is visible.
      test('renders zeroes on a direct URL, with no Hedgerows nav item to mark current', async ({
        hedgerowsSummaryPage
      }) => {
        await hedgerowsSummaryPage.open(project.id)

        await expect(hedgerowsSummaryPage.heading).toBeVisible()
        expect(await hedgerowsSummaryPage.tileValue(TILE_BASELINE)).toBe(
          ZERO_UNITS
        )
        await expect(hedgerowsSummaryPage.navItem(HEDGEROWS)).toHaveCount(0)
      })
    }
  )
})
