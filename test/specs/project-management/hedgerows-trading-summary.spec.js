import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import {
  getAreaTradingDeficitProject,
  getHedgerowTradingMetProject,
  getLinearInterventionTypesProject
} from '@utils/summary-projects.js'
import {
  expectStatusTag,
  STATUS_MET,
  STATUS_NOT_MET
} from '@utils/unit-type-tiles.js'
import {
  CUMULATIVE_SURPLUS_TILE,
  LOW,
  LOW_NET_CHANGE_TILE,
  MEDIUM,
  MEDIUM_DEFICIT_TILE,
  VERY_LOW
} from '@pages/hedgerows-trading-summary.page.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

// ─── Hedgerow trading rules — band statuses (BMD-1003 AC1–AC3) ───────────────
//
// SOLE WITNESS for the band keys of `tradingRuleStatuses.hedgerows` (`medium`,
// `low`, `veryLow`) on the GET /projects/{id} response envelope. The rule is
// unit-tested in the backend (hedgerow-trading-rule-statuses.test.js, AC1–AC3)
// against synthetic figures, and the page is unit-tested in the frontend
// (hedgerows-trading-summary/controller.test.js) against a fabricated
// `tradingRuleStatuses`; no integration test asserts the hedgerows key. Rename
// or reshape it on the backend and both suites stay green while this table
// loses its tags. Do not delete without an integration test that uploads a
// hedgerow-bearing pair and asserts `tradingRuleStatuses.hedgerows`.
//
// The three projects are chosen so each band reads BOTH values somewhere, and
// so no two bands share a value pattern across them — a page that read one
// band's key into another's row would fail at least one test. All three come
// from @utils/summary-projects.js; serial so each is built once.
test.describe('project-management', { tag: '@project-management' }, () => {
  test.describe.configure({ mode: 'serial' })

  test.describe(
    'Hedgerows trading summary — band statuses',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // harness trading-rules/higher-deficit-not-covered-from-below: the
      // Medium hedgerow loses 2.56 units, the Low one gains 2.45, and there is
      // no Very low hedgerow at all.
      test('a Medium deficit reads "Not met" and the Very low band is not listed', async ({
        browser,
        hedgerowsTradingSummaryPage
      }) => {
        const project = await getAreaTradingDeficitProject(browser)
        await hedgerowsTradingSummaryPage.open(project.id)

        // AC1, the deficit branch.
        expect(
          await hedgerowsTradingSummaryPage.bandTileValue(
            MEDIUM,
            MEDIUM_DEFICIT_TILE
          )
        ).toBe('-2.56 units')
        await expectStatusTag(
          hedgerowsTradingSummaryPage.statusTag(MEDIUM),
          STATUS_NOT_MET
        )
        await expectStatusTag(
          hedgerowsTradingSummaryPage.statusTag(LOW),
          STATUS_MET
        )
        // AC3's precondition: no Very low hedgerow on the baseline, so the band
        // is not derived and the page lists no row for it.
        expect(await hedgerowsTradingSummaryPage.bandNames()).toEqual([
          MEDIUM,
          LOW
        ])
      })

      // The "created linear features" pair: the Medium hedgerows gain 2.67
      // units, which falls short of the Low loss of 4.20, and the Very low
      // hedgerows lose 1.04 with nothing left to carry down.
      test('Low and Very low running totals below zero read "Not met" under a Met Medium band', async ({
        browser,
        hedgerowsTradingSummaryPage
      }) => {
        const project = await getLinearInterventionTypesProject(browser)
        await hedgerowsTradingSummaryPage.open(project.id)

        await expectStatusTag(
          hedgerowsTradingSummaryPage.statusTag(MEDIUM),
          STATUS_MET
        )
        // AC2, the deficit branch — the cumulative figure, not the net change,
        // decides it.
        expect(
          await hedgerowsTradingSummaryPage.bandTileValue(
            LOW,
            CUMULATIVE_SURPLUS_TILE
          )
        ).toBe('-1.53 units')
        await expectStatusTag(
          hedgerowsTradingSummaryPage.statusTag(LOW),
          STATUS_NOT_MET
        )
        // AC3, the deficit branch.
        expect(
          await hedgerowsTradingSummaryPage.bandTileValue(
            VERY_LOW,
            CUMULATIVE_SURPLUS_TILE
          )
        ).toBe('-1.04 units')
        await expectStatusTag(
          hedgerowsTradingSummaryPage.statusTag(VERY_LOW),
          STATUS_NOT_MET
        )
      })

      // harness trading-rules/lower-deficit-covered-from-above: the Low
      // hedgerow LOSES 1.55 units, but the Medium surplus of 4.88 carries down
      // and covers it. The case that tells the cumulative rule from a naive
      // "net change below zero" one.
      test('a Low loss covered by the Medium surplus reads "Met"', async ({
        browser,
        hedgerowsTradingSummaryPage
      }) => {
        const project = await getHedgerowTradingMetProject(browser)
        await hedgerowsTradingSummaryPage.open(project.id)

        // AC1, the non-deficit branch.
        expect(
          await hedgerowsTradingSummaryPage.bandTileValue(
            MEDIUM,
            MEDIUM_DEFICIT_TILE
          )
        ).toBe('4.88 units')
        await expectStatusTag(
          hedgerowsTradingSummaryPage.statusTag(MEDIUM),
          STATUS_MET
        )
        // AC2, the non-deficit branch.
        expect(
          await hedgerowsTradingSummaryPage.bandTileValue(
            LOW,
            LOW_NET_CHANGE_TILE
          )
        ).toBe('-1.55 units')
        expect(
          await hedgerowsTradingSummaryPage.bandTileValue(
            LOW,
            CUMULATIVE_SURPLUS_TILE
          )
        ).toBe('3.33 units')
        await expectStatusTag(
          hedgerowsTradingSummaryPage.statusTag(LOW),
          STATUS_MET
        )
      })
    }
  )
})
