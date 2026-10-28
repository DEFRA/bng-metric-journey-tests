import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import {
  getAreaTradingDeficitProject,
  getHedgerowTradingAllMetProject,
  getHedgerowTradingMetProject,
  getLinearInterventionTypesProject
} from '@utils/summary-projects.js'
import { uploadFileHref } from '@utils/upload-file-navigation.js'
import {
  expectStatusTag,
  STATUS_MET,
  STATUS_NOT_MET
} from '@utils/unit-type-tiles.js'
import {
  CUMULATIVE_SURPLUS_TILE,
  HEDGEROWS_TRADING_SUMMARY_PATH,
  LOW,
  LOW_AVAILABLE_TILE,
  LOW_NET_CHANGE_TILE,
  MEDIUM,
  MEDIUM_AVAILABLE_TILE,
  MEDIUM_DEFICIT_TILE,
  TOTAL_UNIT_CHANGE,
  UNIT_CHANGE_COLUMNS,
  VERY_LOW,
  VERY_LOW_NET_CHANGE_TILE
} from '@pages/hedgerows-trading-summary.page.js'
import {
  AREA_HABITATS,
  BASELINE_NAV_CHILD,
  HEDGEROWS,
  POST_INTERVENTION_NAV_CHILD,
  SUMMARY,
  TRADING_RULES_NAV_CHILD,
  WATERCOURSES
} from '@utils/unit-type-labels.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

const LOW_TILES = [
  LOW_NET_CHANGE_TILE,
  MEDIUM_AVAILABLE_TILE,
  CUMULATIVE_SURPLUS_TILE
]
const VERY_LOW_TILES = [
  VERY_LOW_NET_CHANGE_TILE,
  LOW_AVAILABLE_TILE,
  CUMULATIVE_SURPLUS_TILE
]

const tradingSummaryUrl = (id) =>
  new RegExp(`/projects/${id}/${HEDGEROWS_TRADING_SUMMARY_PATH}$`)

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

        // BMD-1028 AC3a.
        await expect(
          hedgerowsTradingSummaryPage.statusSection.getByRole('columnheader')
        ).toHaveText(['Distinctiveness group', 'Status'])

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
        // BMD-1028 AC4: the tile carries the band's tag too.
        await expectStatusTag(
          hedgerowsTradingSummaryPage.bandTileTag(MEDIUM, MEDIUM_DEFICIT_TILE),
          STATUS_NOT_MET
        )
        await expectStatusTag(
          hedgerowsTradingSummaryPage.statusTag(LOW),
          STATUS_MET
        )
        // BMD-1028 AC6, Tile 2's floor: a Medium deficit is never carried
        // down, so "available" reads 0.00 rather than -2.56, and Tile 1 +
        // Tile 2 still equals Tile 3.
        expect(
          await hedgerowsTradingSummaryPage.bandTileValues(LOW, LOW_TILES)
        ).toEqual(['2.45 units', '0.00 units', '2.45 units'])
        // AC3's precondition: no Very low hedgerow on the baseline, so the band
        // is not derived and the page lists no row for it.
        expect(await hedgerowsTradingSummaryPage.bandNames()).toEqual([
          MEDIUM,
          LOW
        ])
      })

      // The "created linear features" pair: the Medium hedgerows gain 2.22
      // units, which falls short of the Low loss of 3.77 (4.20 before HG006's
      // baseline was recut from Good to Moderate for BMD-1182), and the Very
      // low hedgerows lose 1.04 with nothing left to carry down. The Medium
      // gain relies on HG005 and HG010 carrying a Low Proposed Strategic
      // Significance: the harness file gives them Medium, which BMD-1051
      // rejects and prices at zero, leaving every band Not met.
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
        ).toBe('-1.55 units')
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
        await expectStatusTag(
          hedgerowsTradingSummaryPage.bandTileTag(MEDIUM, MEDIUM_DEFICIT_TILE),
          STATUS_MET
        )
        // AC2, the non-deficit branch. BMD-1028 AC6: the Medium surplus is
        // what carries down.
        expect(
          await hedgerowsTradingSummaryPage.bandTileValues(LOW, LOW_TILES)
        ).toEqual(['-1.55 units', '4.88 units', '3.33 units'])
        await expectStatusTag(
          hedgerowsTradingSummaryPage.statusTag(LOW),
          STATUS_MET
        )
      })
    }
  )

  // ─── Band sections (BMD-1028 AC4–AC9) ────────────────────────────────────────
  //
  // SOLE WITNESS for `postIntervention.tradingRules.hedgerows.habitatTypes` —
  // the per-hedgerow-type unit changes in the grids — from a real upload. The
  // backend calculates them in enrich-post-intervention-hedgerow-trading-rules
  // .test.js from synthetic features, and the frontend renders them in
  // hedgerows-trading-summary/controller.test.js from a fabricated payload; no
  // integration test asserts the figures. Do not delete without an integration
  // test that uploads a hedgerow-bearing pair and asserts those figures.
  //
  // The linear pair is the one shipped pairing with every band present and
  // several hedgerow types per band, so one project carries all three sections.
  test.describe(
    'Hedgerows trading summary — band sections',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('the Medium section shows the deficit tile and each Medium hedgerow type with a total', async ({
        browser,
        hedgerowsTradingSummaryPage
      }) => {
        const project = await getLinearInterventionTypesProject(browser)
        await hedgerowsTradingSummaryPage.open(project.id)

        expect(
          await hedgerowsTradingSummaryPage.bandTileValue(
            MEDIUM,
            MEDIUM_DEFICIT_TILE
          )
        ).toBe('2.22 units')
        await expectStatusTag(
          hedgerowsTradingSummaryPage.bandTileTag(MEDIUM, MEDIUM_DEFICIT_TILE),
          STATUS_MET
        )
        // The rows add up to 2.21, the total to 2.22: each figure is rounded
        // for display on its own, so the two can differ by a penny.
        expect(await hedgerowsTradingSummaryPage.readBandGrid(MEDIUM)).toEqual({
          headers: UNIT_CHANGE_COLUMNS,
          rows: [
            ['Ecologically valuable line of trees', '1.94'],
            [
              'Ecologically valuable line of trees - associated with bank or ditch',
              '-1.56'
            ],
            ['Native hedgerow - associated with bank or ditch', '2.39'],
            ['Native hedgerow with trees', '-0.56'],
            ['Species-rich native hedgerow', '0.00'],
            [TOTAL_UNIT_CHANGE, '2.22']
          ]
        })
      })

      test('the Low section shows its three tiles and each Low hedgerow type with a total', async ({
        browser,
        hedgerowsTradingSummaryPage
      }) => {
        const project = await getLinearInterventionTypesProject(browser)
        await hedgerowsTradingSummaryPage.open(project.id)

        expect(
          await hedgerowsTradingSummaryPage.bandTileValues(LOW, LOW_TILES)
        ).toEqual(['-3.77 units', '2.22 units', '-1.55 units'])
        // Only the cumulative tile carries the band's status.
        await expectStatusTag(
          hedgerowsTradingSummaryPage.bandTileTag(LOW, CUMULATIVE_SURPLUS_TILE),
          STATUS_NOT_MET
        )
        await expect(
          hedgerowsTradingSummaryPage.bandTileTag(LOW, LOW_NET_CHANGE_TILE)
        ).toHaveCount(0)
        expect(await hedgerowsTradingSummaryPage.readBandGrid(LOW)).toEqual({
          headers: UNIT_CHANGE_COLUMNS,
          rows: [
            ['Line of trees', '-1.76'],
            ['Line of trees - associated with bank or ditch', '-2.01'],
            ['Native hedgerow', '0.00'],
            [TOTAL_UNIT_CHANGE, '-3.77']
          ]
        })
      })

      // A Low cumulative deficit (-1.55) is never carried down, so "available"
      // reads 0.00. That alone cannot tell which figure the page passes — any
      // negative input floors to 0.00 — hence the all-met test below.
      test('the Very low section shows a Low deficit carried down as 0.00 and its hedgerow type with a total', async ({
        browser,
        hedgerowsTradingSummaryPage
      }) => {
        const project = await getLinearInterventionTypesProject(browser)
        await hedgerowsTradingSummaryPage.open(project.id)

        expect(
          await hedgerowsTradingSummaryPage.bandTileValues(
            VERY_LOW,
            VERY_LOW_TILES
          )
        ).toEqual(['-1.04 units', '0.00 units', '-1.04 units'])
        await expectStatusTag(
          hedgerowsTradingSummaryPage.bandTileTag(
            VERY_LOW,
            CUMULATIVE_SURPLUS_TILE
          ),
          STATUS_NOT_MET
        )
        expect(
          await hedgerowsTradingSummaryPage.readBandGrid(VERY_LOW)
        ).toEqual({
          headers: UNIT_CHANGE_COLUMNS,
          rows: [
            ['Non-native and ornamental hedgerow', '-1.04'],
            [TOTAL_UNIT_CHANGE, '-1.04']
          ]
        })
      })

      // harness trading-rules/all-met: the Low hedgerow is enhanced (+1.26) and
      // the Very low one retained (0.00). SOLE WITNESS that the Very low
      // "available" tile is fed the Low CUMULATIVE figure — the only shared
      // pair where that figure is positive under a Very low band — and the only
      // real-data Very low "Met". The frontend tests the same carry-down
      // (controller.test.js "carries positive low availability down to very
      // low") with fabricated figures only.
      test('a Low surplus carries down into the Very low band, which reads "Met"', async ({
        browser,
        hedgerowsTradingSummaryPage
      }) => {
        const project = await getHedgerowTradingAllMetProject(browser)
        await hedgerowsTradingSummaryPage.open(project.id)

        expect(await hedgerowsTradingSummaryPage.bandNames()).toEqual([
          MEDIUM,
          LOW,
          VERY_LOW
        ])
        expect(
          await hedgerowsTradingSummaryPage.bandTileValue(
            LOW,
            CUMULATIVE_SURPLUS_TILE
          )
        ).toBe('1.26 units')
        expect(
          await hedgerowsTradingSummaryPage.bandTileValues(
            VERY_LOW,
            VERY_LOW_TILES
          )
        ).toEqual(['0.00 units', '1.26 units', '1.26 units'])
        await expectStatusTag(
          hedgerowsTradingSummaryPage.statusTag(VERY_LOW),
          STATUS_MET
        )
        await expectStatusTag(
          hedgerowsTradingSummaryPage.bandTileTag(
            VERY_LOW,
            CUMULATIVE_SURPLUS_TILE
          ),
          STATUS_MET
        )
      })
    }
  )

  // ─── Navigation (BMD-1028 AC10) ──────────────────────────────────────────────
  //
  // The frontend asserts the nav hrefs in mocked markup; this proves the page
  // emits them for a real project. The linear pair has rivers, so it also
  // witnesses the Watercourses item's present branch (AC1).
  // Each href is followed once elsewhere, and the builder takes only the
  // project and the current href, so the click does not depend on the page:
  // Summary, Hedgerows and Watercourses from area-summary.spec.js; Area
  // habitats and Reports from the project summary (area-summary.spec.js,
  // project-reports.spec.js); and each section's Baseline, Post intervention
  // and Trading rules children from that section's own summary page (the
  // "both triggers" and entry-point tests in each destination's spec). AC11's "Upload file" target is
  // the href asserted in the entry-points describe below; following it is
  // project-summary.spec.js's job, since the destination does not depend on
  // the page.
  test.describe(
    'Hedgerows trading summary — navigation',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('each left-navigation link points at its page', async ({
        browser,
        hedgerowsTradingSummaryPage
      }) => {
        const project = await getLinearInterventionTypesProject(browser)
        await hedgerowsTradingSummaryPage.open(project.id)

        for (const [linkText, path] of [
          [SUMMARY, 'project-summary'],
          [AREA_HABITATS, 'area-summary'],
          [HEDGEROWS, 'hedgerows-summary'],
          [BASELINE_NAV_CHILD, 'hedgerows-baseline'],
          [POST_INTERVENTION_NAV_CHILD, 'hedgerows-post-intervention'],
          [WATERCOURSES, 'watercourses-summary']
        ]) {
          await expect(
            hedgerowsTradingSummaryPage.navLink(linkText),
            linkText
          ).toHaveAttribute('href', `/projects/${project.id}/${path}`)
        }
      })
    }
  )

  // ─── Entry points (BMD-1027 AC5) ─────────────────────────────────────────────
  //
  // Sole witness that the hedgerows "Trading rules" nav child is followable.
  // The project summary's "View hedgerows trading rules" link is followed in
  // project-summary.spec.js. No frontend unit test can follow a link —
  // `unit-type-navigation.test.js:339` builds the nav child from a fabricated
  // project. Same project as the "Met" band test above, so no extra upload.
  test.describe(
    'Hedgerows trading summary — entry points',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // Arrives by clicking rather than by URL, so the nav shape asserted is
      // the one a user reaches: Hedgerows expanded, Trading rules current.
      test('the Hedgerows "Trading rules" nav child opens this page with Trading rules current, the rest of the nav, the caption and an upload action returning here', async ({
        browser,
        page,
        hedgerowsSummaryPage,
        hedgerowsTradingSummaryPage
      }) => {
        const project = await getHedgerowTradingMetProject(browser)
        await hedgerowsSummaryPage.open(project.id)

        // Nav-wide, but only the current section expands, so on the hedgerows
        // summary this can only be the Hedgerows child.
        await hedgerowsSummaryPage.navLink(TRADING_RULES_NAV_CHILD).click()

        await expect(page).toHaveURL(tradingSummaryUrl(project.id))
        await expect(hedgerowsTradingSummaryPage.heading).toBeVisible()
        await expect(
          hedgerowsTradingSummaryPage.hedgerowsNavChildren()
        ).toHaveText([
          BASELINE_NAV_CHILD,
          POST_INTERVENTION_NAV_CHILD,
          TRADING_RULES_NAV_CHILD
        ])
        await expect(
          hedgerowsTradingSummaryPage.navItem(TRADING_RULES_NAV_CHILD)
        ).toHaveAttribute('aria-current', 'page')
        await expect(
          hedgerowsTradingSummaryPage.navLink(TRADING_RULES_NAV_CHILD)
        ).toHaveCount(0)

        // BMD-1028 AC1: the rest of the nav. This pair has no rivers, so
        // Watercourses is absent; the navigation describe below covers the
        // present branch.
        for (const name of [SUMMARY, AREA_HABITATS, HEDGEROWS]) {
          await expect(
            hedgerowsTradingSummaryPage.navLink(name),
            name
          ).toBeVisible()
        }
        await expect(
          hedgerowsTradingSummaryPage.navigation.getByText(WATERCOURSES)
        ).toHaveCount(0)

        // BMD-1028 AC2. The upload button's returnUrl is built per page, so
        // another page's witness says nothing about this one.
        await expect(
          hedgerowsTradingSummaryPage.caption(project.name)
        ).toBeVisible()
        await expect(
          hedgerowsTradingSummaryPage.uploadFileButton
        ).toHaveAttribute(
          'href',
          uploadFileHref(
            project.id,
            `/projects/${project.id}/${HEDGEROWS_TRADING_SUMMARY_PATH}`
          )
        )
      })
    }
  )
})
