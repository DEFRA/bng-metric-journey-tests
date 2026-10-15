import { test, expect } from '@fixtures'
import {
  LOW,
  LOW_TILES,
  MEDIUM,
  MEDIUM_DEFICIT_TILE,
  WATERCOURSES_TRADING_SUMMARY_PATH
} from '@pages/watercourses-trading-summary.page.js'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { uploadFileHref } from '@utils/upload-file-navigation.js'
import {
  getAllUnitTypesPostInterventionProject,
  getBaselineOnlyProject,
  getTargetMetProject,
  getWatercourseGainProject
} from '@utils/summary-projects.js'
import {
  expectStatusTag,
  STATUS_MET,
  STATUS_NOT_MET
} from '@utils/unit-type-tiles.js'
import {
  BASELINE_NAV_CHILD,
  POST_INTERVENTION_NAV_CHILD,
  TRADING_RULES_NAV_CHILD
} from '@utils/unit-type-labels.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

const UNIT_CHANGE_COLUMNS = ['Habitat type', 'Unit change']

const tradingSummaryUrl = (id) =>
  new RegExp(`/projects/${id}/${WATERCOURSES_TRADING_SUMMARY_PATH}$`)

// The watercourses trading summary (BMD-1029, frontend PR#347).
test.describe('project-management', { tag: '@project-management' }, () => {
  test.describe.configure({ mode: 'serial' })

  // ─── Band sections (BMD-1029) ────────────────────────────────────────────────
  //
  // `watercourses-trading-summary/controller.test.js` covers every element of
  // this page against a fabricated project (`worked-example.fixture.js`), and
  // the backend covers the verdicts in `watercourse-trading-rule-statuses
  // .test.js` against synthetic figures. Neither shows that a REAL upload
  // produces `postIntervention.tradingRules.watercourses` and
  // `tradingRuleStatuses.watercourses` in the shape this page reads — no
  // integration test asserts either key. These tests are that witness: rename
  // or reshape either key on the backend and both sibling suites stay green
  // while this page loses its figures. Do not delete without an integration
  // test that uploads a watercourse-bearing pair and asserts both keys.
  //
  // Figures probed against the stack on 2026-10-15. Since BMD-1056 the
  // baseline is derived from the post-intervention file's Baseline columns, so
  // a fixture regeneration can move them — check the PI file first if one
  // disagrees.
  test.describe(
    'Watercourses trading summary — band sections',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // `linear net gain met`: the only watercourse type, Canals, gains 0.47
      // units and every watercourse is Medium.
      test('a Medium band with no deficit reads "Met" and no Low band is listed', async ({
        browser,
        watercoursesTradingSummaryPage
      }) => {
        const project = await getTargetMetProject(browser)
        await watercoursesTradingSummaryPage.open(project.id)

        expect(await watercoursesTradingSummaryPage.bandNames()).toEqual([
          MEDIUM
        ])
        await expectStatusTag(
          watercoursesTradingSummaryPage.statusTag(MEDIUM),
          STATUS_MET
        )
        expect(
          await watercoursesTradingSummaryPage.bandTileValue(
            MEDIUM,
            MEDIUM_DEFICIT_TILE
          )
        ).toBe('0.00 units')
        await expectStatusTag(
          watercoursesTradingSummaryPage.bandTileTag(
            MEDIUM,
            MEDIUM_DEFICIT_TILE
          ),
          STATUS_MET
        )
        expect(
          await watercoursesTradingSummaryPage.readBandGrid(MEDIUM)
        ).toEqual({ headers: UNIT_CHANGE_COLUMNS, rows: [['Canals', '0.47']] })
        await expect(
          watercoursesTradingSummaryPage.bandSection(LOW)
        ).toHaveCount(0)
      })

      // `all unit and intervention types`: the only shared pair with a Low
      // watercourse. Canals lose 4.52 units (Medium deficit), the Culvert loses
      // 0.32 with no Medium surplus to carry down. SOLE real-data witness for
      // the Low band, for its tag on the cumulative tile (PR#387), and for
      // `showLowTotals: false` — neither grid has a totals row, unlike the
      // area page.
      test('a Medium deficit and a Low running total below zero both read "Not met"', async ({
        browser,
        watercoursesTradingSummaryPage
      }) => {
        const project = await getAllUnitTypesPostInterventionProject(browser)
        await watercoursesTradingSummaryPage.open(project.id)

        expect(await watercoursesTradingSummaryPage.bandNames()).toEqual([
          MEDIUM,
          LOW
        ])
        await expectStatusTag(
          watercoursesTradingSummaryPage.statusTag(MEDIUM),
          STATUS_NOT_MET
        )
        await expectStatusTag(
          watercoursesTradingSummaryPage.statusTag(LOW),
          STATUS_NOT_MET
        )

        expect(
          await watercoursesTradingSummaryPage.bandTileValue(
            MEDIUM,
            MEDIUM_DEFICIT_TILE
          )
        ).toBe('-4.52 units')
        await expectStatusTag(
          watercoursesTradingSummaryPage.bandTileTag(
            MEDIUM,
            MEDIUM_DEFICIT_TILE
          ),
          STATUS_NOT_MET
        )
        expect(
          await watercoursesTradingSummaryPage.readBandGrid(MEDIUM)
        ).toEqual({
          headers: UNIT_CHANGE_COLUMNS,
          rows: [
            ['Canals', '-4.52'],
            ['Ditches', '0.00']
          ]
        })

        expect(
          await watercoursesTradingSummaryPage.bandTileValue(
            LOW,
            LOW_TILES.netChange
          )
        ).toBe('-0.32 units')
        // A Medium deficit never carries down: available reads 0.00, not -4.52.
        expect(
          await watercoursesTradingSummaryPage.bandTileValue(
            LOW,
            LOW_TILES.mediumSurplus
          )
        ).toBe('0.00 units')
        expect(
          await watercoursesTradingSummaryPage.bandTileValue(
            LOW,
            LOW_TILES.cumulativeSurplus
          )
        ).toBe('-0.32 units')
        await expectStatusTag(
          watercoursesTradingSummaryPage.bandTileTag(
            LOW,
            LOW_TILES.cumulativeSurplus
          ),
          STATUS_NOT_MET
        )
        await expect(
          watercoursesTradingSummaryPage.bandTileTag(LOW, LOW_TILES.netChange)
        ).toHaveCount(0)
        expect(await watercoursesTradingSummaryPage.readBandGrid(LOW)).toEqual({
          headers: UNIT_CHANGE_COLUMNS,
          rows: [['Culvert', '-0.32']]
        })
      })

      // `created watercourses`: every watercourse is Created, so the derived
      // baseline has none and trading rules do not apply. The backend returns
      // null band statuses (watercourse-trading-rule-statuses.test.js:62) and
      // the page shows the band with NO tag rather than a red one — unknown is
      // not failed. SOLE real-data witness for that null-verdict path.
      test('watercourses that exist only post intervention get no verdict and no tag', async ({
        browser,
        watercoursesTradingSummaryPage
      }) => {
        const project = await getWatercourseGainProject(browser)
        await watercoursesTradingSummaryPage.open(project.id)

        expect(await watercoursesTradingSummaryPage.bandNames()).toEqual([
          MEDIUM
        ])
        await expect(
          watercoursesTradingSummaryPage.statusTag(MEDIUM)
        ).toHaveCount(0)
        expect(
          await watercoursesTradingSummaryPage.bandTileValue(
            MEDIUM,
            MEDIUM_DEFICIT_TILE
          )
        ).toBe('0.00 units')
        await expect(
          watercoursesTradingSummaryPage.bandTileTag(
            MEDIUM,
            MEDIUM_DEFICIT_TILE
          )
        ).toHaveCount(0)
      })

      // The redirect target is passed per controller (`summaryPath`), so the
      // area and hedgerow pages' guards say nothing about this one.
      test('a project with no post-intervention file is sent to the watercourses summary', async ({
        browser,
        page
      }) => {
        const project = await getBaselineOnlyProject(browser)
        await page.goto(
          `/projects/${project.id}/${WATERCOURSES_TRADING_SUMMARY_PATH}`
        )

        await expect(page).toHaveURL(
          new RegExp(`/projects/${project.id}/watercourses-summary$`)
        )
      })

      // Unreachable from a real upload: the backend always calculates the
      // figures when a post-intervention file is accepted, so only a document
      // saved before BMD-1029 or a failed calculation reaches this branch.
      // `controller.test.js:346` covers it against a fabricated project.
      //
      // Unblock: a backend fault-injection hook (or a fixture that makes the
      // watercourse trading calculation fail) — upload it, then run the body.
      test.skip('a project whose figures were never calculated says so', async ({
        page
      }) => {
        // const project = await <project with no watercourse trading figures>
        // await page.goto(`/projects/${project.id}/${WATERCOURSES_TRADING_SUMMARY_PATH}`)
        // await expect(page.getByText('Trading rules have not been calculated for this project. Upload the post-intervention file again to calculate them.')).toBeVisible()
        // await expect(page.getByRole('table')).toHaveCount(0)
      })
    }
  )

  // ─── Entry points (BMD-1031 AC5) ─────────────────────────────────────────────
  //
  // SOLE WITNESS that either watercourse link is followable. The other
  // watercourse specs and project-summary.spec.js assert only the two links'
  // hrefs, and no frontend unit test can follow a link —
  // watercourses-trading-summary/controller.test.js:460-501 renders each entry
  // page against a fabricated project and reads the href off the markup.
  // getTargetMetProject is already built by project-summary.spec.js and
  // watercourses-baseline.spec.js, so in a shared worker this costs no upload.
  test.describe(
    'Watercourses trading summary — entry points',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // Arrives by clicking rather than by URL, so the nav shape asserted is
      // the one a user reaches: Watercourses expanded, Trading rules current.
      test('the Watercourses "Trading rules" nav child opens this page with Trading rules current, the caption and an upload action returning here', async ({
        browser,
        page,
        watercoursesSummaryPage,
        watercoursesTradingSummaryPage
      }) => {
        const project = await getTargetMetProject(browser)
        await watercoursesSummaryPage.open(project.id)

        // Nav-wide, but only the current section expands, so on the
        // watercourses summary this can only be the Watercourses child.
        await watercoursesSummaryPage.navLink(TRADING_RULES_NAV_CHILD).click()

        await expect(page).toHaveURL(tradingSummaryUrl(project.id))
        await expect(watercoursesTradingSummaryPage.heading).toBeVisible()
        await expect(
          watercoursesTradingSummaryPage.watercoursesNavChildren()
        ).toHaveText([
          BASELINE_NAV_CHILD,
          POST_INTERVENTION_NAV_CHILD,
          TRADING_RULES_NAV_CHILD
        ])
        await expect(
          watercoursesTradingSummaryPage.navItem(TRADING_RULES_NAV_CHILD)
        ).toHaveAttribute('aria-current', 'page')
        await expect(
          watercoursesTradingSummaryPage.navLink(TRADING_RULES_NAV_CHILD)
        ).toHaveCount(0)
        // The upload button's returnUrl is built per page, so another page's
        // witness says nothing about this one.
        await expect(
          watercoursesTradingSummaryPage.caption(project.name)
        ).toBeVisible()
        await expect(
          watercoursesTradingSummaryPage.uploadFileButton
        ).toHaveAttribute(
          'href',
          uploadFileHref(
            project.id,
            `/projects/${project.id}/${WATERCOURSES_TRADING_SUMMARY_PATH}`
          )
        )
      })

      test('the project summary "View watercourses trading rules" link opens this page', async ({
        browser,
        page,
        projectSummaryPage,
        watercoursesTradingSummaryPage
      }) => {
        const project = await getTargetMetProject(browser)
        await projectSummaryPage.open(project.id)

        await projectSummaryPage.watercoursesTradingRulesLink().click()

        await expect(page).toHaveURL(tradingSummaryUrl(project.id))
        await expect(watercoursesTradingSummaryPage.heading).toBeVisible()
      })
    }
  )
})
