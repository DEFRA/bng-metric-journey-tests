import { test, expect } from '@fixtures'
import { WATERCOURSES_TRADING_SUMMARY_PATH } from '@pages/watercourses-trading-summary.page.js'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { getTargetMetProject } from '@utils/summary-projects.js'
import {
  BASELINE_NAV_CHILD,
  POST_INTERVENTION_NAV_CHILD,
  TRADING_RULES_NAV_CHILD
} from '@utils/unit-type-labels.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

// The watercourses trading summary (BMD-1029, frontend PR#347). Only its entry
// points are covered so far; the page's own content — status table, band
// tiles and grids — is BMD-1029's coverage and belongs in this file too.
test.describe('project-management', { tag: '@project-management' }, () => {
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

      const tradingSummaryUrl = (id) =>
        new RegExp(`/projects/${id}/${WATERCOURSES_TRADING_SUMMARY_PATH}$`)

      // Arrives by clicking rather than by URL, so the nav shape asserted is
      // the one a user reaches: Watercourses expanded, Trading rules current.
      test('the Watercourses "Trading rules" nav child opens this page with Trading rules current', async ({
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
