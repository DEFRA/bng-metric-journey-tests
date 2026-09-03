import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import {
  AREA_HABITATS,
  BASELINE_NAV_CHILD,
  HEDGEROWS,
  SUMMARY,
  TILE_BASELINE,
  WATERCOURSES
} from '@utils/unit-type-labels.js'
import {
  getAllUnitTypesProject,
  getWatercourseGainProject
} from '@utils/summary-projects.js'

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

// This page was the shared "under construction" placeholder until
// BMD-856/BMD-921 (frontend PR#250) built it on 2026-09-01. The placeholder
// tests that stood here failed on the very next CI run, which is exactly what
// they were written to do — see the note in the flow doc.
//
// Now structurally identical to the hedgerows summary, so as there, these tests
// do NOT re-assert the shared layout or nav mechanics: area-summary.spec.js
// witnesses those against real data. Covered here is only what differs — the
// watercourse backend fields, the inert baseline tile, and the
// post-intervention-only variant for THIS unit type.
test.describe('project-management', { tag: '@project-management' }, () => {
  test.describe.configure({ mode: 'serial' })

  test.describe('Watercourses summary — page content', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    let project
    test.beforeAll(async ({ browser }) => {
      project = await getAllUnitTypesProject(browser)
    })

    test(
      'renders watercourse figures and targets from real backend data',
      { tag: ['@smoke', '@happy-path'] },
      async ({ watercoursesSummaryPage }) => {
        await watercoursesSummaryPage.open(project.id)

        await expect(watercoursesSummaryPage.heading).toBeVisible()
        await expect(
          watercoursesSummaryPage.caption(project.name)
        ).toBeVisible()

        // Reads baseline.units.watercoursesTotal — a different backend field
        // again from habitatsTotal + treesTotal and hedgerowsTotal. The
        // frontend unit tests mock wreck, so nothing else proves it is emitted.
        expect(await watercoursesSummaryPage.tileValue(TILE_BASELINE)).toMatch(
          UNITS_2DP
        )

        await expect(watercoursesSummaryPage.targetsSection).toBeVisible()
        expect(
          await watercoursesSummaryPage.targetValue(TARGET_PERCENTAGE)
        ).toBe(NET_GAIN_TARGET)
        // Baseline-only, so the deficit is the whole requirement — same number
        // through the same formatter, hence an exact comparison.
        expect(
          await watercoursesSummaryPage.targetValue(TARGET_UNIT_DEFICIT)
        ).toBe(await watercoursesSummaryPage.targetValue(TARGET_UNITS_REQUIRED))
      }
    )

    test('the baseline tile is inert, with no "area" in its wording', async ({
      watercoursesSummaryPage
    }) => {
      await watercoursesSummaryPage.open(project.id)

      await expect(
        watercoursesSummaryPage.viewOnSiteBaselineText()
      ).toBeVisible()
      await expect(watercoursesSummaryPage.baselineAction()).toHaveCount(0)
    })

    test('Watercourses is current and expands its own Baseline child', async ({
      watercoursesSummaryPage
    }) => {
      await watercoursesSummaryPage.open(project.id)

      await expect(
        watercoursesSummaryPage.navItem(WATERCOURSES)
      ).toHaveAttribute('aria-current', 'page')
      await expect(watercoursesSummaryPage.navLink(AREA_HABITATS)).toBeVisible()
      await expect(watercoursesSummaryPage.navLink(HEDGEROWS)).toBeVisible()
      await expect(watercoursesSummaryPage.navLink(SUMMARY)).toBeVisible()
      // BMD-859/861: the Baseline child follows the current section now that
      // every unit type has a baseline page. The locator is nav-wide, so strict
      // mode fails if another section were expanded alongside this one.
      await expect(
        watercoursesSummaryPage.navLink(BASELINE_NAV_CHILD)
      ).toHaveAttribute('href', `/projects/${project.id}/watercourses-baseline`)
    })
  })

  // ─── Post-intervention-only watercourses (BMD-897) ───────────────────────────

  test.describe(
    'Watercourses summary — post-intervention-only watercourses',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getWatercourseGainProject(browser)
      })

      // hedgerows-summary.spec.js witnesses this variant for hedgerows. It
      // needs its own witness here because each controller passes its OWN
      // habitat-type string to hasPostInterventionOnlyHabitat — a shared helper
      // is not shared coverage when the caller picks the parameter. Typo this
      // page's argument and every other test still passes.
      test('a watercourse gained from a zero baseline shows "Not applicable" and no baseline action', async ({
        watercoursesSummaryPage
      }) => {
        await watercoursesSummaryPage.open(project.id)

        expect(await watercoursesSummaryPage.tileValue(TILE_BASELINE)).toBe(
          ZERO_UNITS
        )
        expect(
          await watercoursesSummaryPage.tileValue(TILE_NET_PERCENTAGE)
        ).toBe(POST_INTERVENTION_ONLY_PERCENTAGE)

        await expect(
          watercoursesSummaryPage.unitSection().getByText(/^(Met|Not met)$/)
        ).toHaveCount(0)

        // BMD-897 nulls the baseline action for this state — the inert line is
        // not rendered at all, rather than rendered without a link.
        await expect(
          watercoursesSummaryPage.viewOnSiteBaselineText()
        ).toHaveCount(0)

        // And the tile keeps the UNHYPHENATED heading, because the variant is
        // treated as "not a standard intervention".
        expect(
          await watercoursesSummaryPage.tileValue(TILE_POST_INTERVENTION)
        ).toMatch(UNITS_2DP)
      })
    }
  )
})
