import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { uploadFileHref } from '@utils/upload-file-navigation.js'
import {
  getAreaTradingDeficitProject,
  getIntertidalTradingProject
} from '@utils/summary-projects.js'
import {
  AREA_HABITATS,
  BASELINE_NAV_CHILD,
  HEDGEROWS,
  POST_INTERVENTION_NAV_CHILD,
  SUMMARY,
  TRADING_RULES_NAV_CHILD,
  WATERCOURSES
} from '@utils/unit-type-labels.js'
import {
  expectStatusTag,
  STATUS_MET,
  STATUS_NOT_MET
} from '@utils/unit-type-tiles.js'
import { LOW_TILES } from '@pages/area-trading-summary.page.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

const INTERTIDAL_HEADING = 'Intertidal sediment and Intertidal hard structures'
const TOTAL_BROAD_HABITAT_CHANGE = 'Total broad habitat change'
const TOTAL_ON_SITE_UNIT_CHANGE = 'Total on-site unit change'
const IGGI_HABITAT_TYPE =
  'Artificial hard structures with integrated greening of grey infrastructure (IGGI)'

// The area trading summary is read-only: it renders figures the backend
// calculated and saved at post-intervention upload (BMD-993). Both projects
// come from @utils/summary-projects.js, so each fixture pair is uploaded once
// per worker. Serial for the same reason as the other drill-down specs: the
// shared build must happen once, and concurrent uploads clobber the single
// pendingUploadId key.
//
// The frontend suite renders every AC of this page
// (area-trading-summary/controller.test.js) — against a mocked backend handed
// the worked-example literal. The engine and backend test the arithmetic on
// synthetic input. Nothing else shows that a REAL upload produces the fields
// this page reads, so these tests are the sole wiring witness: rename
// `postIntervention.tradingRules.areaHabitats` or `tradingRuleStatuses` on the
// backend and every mocked test stays green while the page breaks. Do not
// delete them without a backend integration test that uploads a trading-rules
// fixture pair and asserts the saved figures and statuses.
test.describe('project-management', { tag: '@project-management' }, () => {
  test.describe.configure({ mode: 'serial' })

  // ─── Medium deficit project ──────────────────────────────────────────────────
  //
  // harness trading-rules/higher-deficit-not-covered-from-below: a Medium
  // grassland lost (Medium band Not met, −153.69) and two Low grasslands
  // enhanced (Low band Met, +166.54); hedgerows, no rivers. Its pinned figures
  // come from the BMD-1024 manual validation runs, stable across 2026-09-28,
  // 2026-10-01 and 2026-10-02.

  test.describe('Area trading summary — Medium deficit project', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    let project
    test.beforeAll(async ({ browser }) => {
      project = await getAreaTradingDeficitProject(browser)
    })

    // Followed from the results link rather than opened by URL, so the entry
    // point (BMD-1025) is exercised on the way in.
    test(
      'opens from "View area trading rules" with the caption, heading and upload button',
      { tag: '@smoke' },
      async ({ page, areaSummaryPage, areaTradingSummaryPage }) => {
        await areaSummaryPage.open(project.id)
        await areaSummaryPage.areaTradingRulesLink().click()

        await expect(page).toHaveURL(
          new RegExp(`/projects/${project.id}/area-trading-summary$`)
        )
        await expect(areaTradingSummaryPage.heading).toBeVisible()
        await expect(areaTradingSummaryPage.caption(project.name)).toBeVisible()
        // The returnUrl is built per page, so another page's upload-button
        // witness says nothing about this one.
        await expect(areaTradingSummaryPage.uploadFileButton).toHaveAttribute(
          'href',
          uploadFileHref(
            project.id,
            `/projects/${project.id}/area-trading-summary`
          )
        )
      }
    )

    // BMD-1024 AC1, as ruled by the team: "Post intervention" without a hyphen
    // and "Trading rules" with a lower-case r. "Reports" is deliberately not
    // asserted — it came from a spike and has no story.
    //
    // Arrives by clicking the area summary's Trading rules child (BMD-1025
    // AC5) rather than by URL: every other page only asserts that child's
    // href, so this is the one place it is followed.
    test(
      'the left navigation expands Area habitats with Trading rules current',
      { tag: '@regression' },
      async ({ page, areaSummaryPage, areaTradingSummaryPage }) => {
        await areaSummaryPage.open(project.id)
        await areaSummaryPage.navLink(TRADING_RULES_NAV_CHILD).click()
        await expect(page).toHaveURL(
          new RegExp(`/projects/${project.id}/area-trading-summary$`)
        )

        await expect(areaTradingSummaryPage.navLink(SUMMARY)).toBeVisible()
        await expect(
          areaTradingSummaryPage.navLink(AREA_HABITATS)
        ).toBeVisible()
        await expect(areaTradingSummaryPage.areaNavChildren()).toHaveText([
          BASELINE_NAV_CHILD,
          POST_INTERVENTION_NAV_CHILD,
          TRADING_RULES_NAV_CHILD
        ])
        await expect(
          areaTradingSummaryPage.navItem(TRADING_RULES_NAV_CHILD)
        ).toHaveAttribute('aria-current', 'page')
        await expect(
          areaTradingSummaryPage.navLink(TRADING_RULES_NAV_CHILD)
        ).toHaveCount(0)

        // Conditional items: this pair has hedgerows and no rivers.
        await expect(areaTradingSummaryPage.navLink(HEDGEROWS)).toBeVisible()
        await expect(areaTradingSummaryPage.navLink(WATERCOURSES)).toHaveCount(
          0
        )
      }
    )

    // Sole real-data witness for the band statuses
    // (`tradingRuleStatuses.areaHabitats.medium` / `.low`). The BMD-1008 tests
    // render only `overall`, on other pages. The Medium "Met" and Low "Not met"
    // branches are rule-tested in backend area-trading-rule-statuses.test.js and
    // rendered in the frontend controller test; a variant here would add an
    // upload, not coverage.
    test(
      'the trading summary shows Medium "Not met" and Low "Met"',
      { tag: '@regression' },
      async ({ areaTradingSummaryPage }) => {
        await areaTradingSummaryPage.open(project.id)

        await expect(
          areaTradingSummaryPage.statusSection.getByRole('columnheader')
        ).toHaveText(['Distinctiveness group', 'Status'])
        await expectStatusTag(
          areaTradingSummaryPage.statusTag('Medium'),
          STATUS_NOT_MET
        )
        await expectStatusTag(
          areaTradingSummaryPage.statusTag('Low'),
          STATUS_MET
        )
      }
    )

    test(
      'the Medium section shows the deficit tile and a grid per broad habitat',
      { tag: '@regression' },
      async ({ areaTradingSummaryPage }) => {
        await areaTradingSummaryPage.open(project.id)

        expect(await areaTradingSummaryPage.mediumDeficitValue()).toBe(
          '-153.69 units'
        )
        await expectStatusTag(
          areaTradingSummaryPage.mediumDeficitTag(),
          STATUS_NOT_MET
        )

        await expect(
          areaTradingSummaryPage.broadHabitatHeading('Grassland')
        ).toBeVisible()
        const grid = await areaTradingSummaryPage.readGridContaining(
          areaTradingSummaryPage.mediumSection,
          'Other neutral grassland'
        )
        expect(grid).toEqual({
          headers: ['Habitat type', 'Unit change'],
          rows: [
            ['Other neutral grassland', '-153.69'],
            [TOTAL_BROAD_HABITAT_CHANGE, '-153.69']
          ]
        })

        // No Medium intertidal habitat in this pair, so no merged grid.
        await expect(
          areaTradingSummaryPage.broadHabitatHeading(INTERTIDAL_HEADING)
        ).toHaveCount(0)
      }
    )

    test(
      'the Low section shows its three tiles and the Low habitat grid',
      { tag: '@regression' },
      async ({ areaTradingSummaryPage }) => {
        await areaTradingSummaryPage.open(project.id)

        expect(
          await areaTradingSummaryPage.lowTileValue(LOW_TILES.netChange)
        ).toBe('166.54 units')
        expect(
          await areaTradingSummaryPage.lowTileValue(LOW_TILES.mediumSurplus)
        ).toBe('0.00 units')
        expect(
          await areaTradingSummaryPage.lowTileValue(LOW_TILES.cumulativeSurplus)
        ).toBe('166.54 units')

        const grid = await areaTradingSummaryPage.readGridContaining(
          areaTradingSummaryPage.lowSection,
          'Modified grassland'
        )
        expect(grid).toEqual({
          headers: ['Broad habitat', 'Habitat type', 'On-site unit change'],
          rows: [
            ['Grassland', 'Modified grassland', '166.54'],
            [TOTAL_ON_SITE_UNIT_CHANGE, '', '166.54']
          ]
        })
      }
    )

    // BMD-1024 AC8. The frontend asserts the hrefs in mocked markup; this
    // follows each one from this page and checks where it lands.
    test(
      'each left-navigation link opens its page',
      { tag: '@regression' },
      async ({
        page,
        areaTradingSummaryPage,
        projectSummaryPage,
        areaSummaryPage,
        areaBaselinePage,
        areaPostInterventionPage,
        hedgerowsSummaryPage
      }) => {
        const destinations = [
          [SUMMARY, 'project-summary', projectSummaryPage.heading],
          [AREA_HABITATS, 'area-summary', areaSummaryPage.heading],
          [BASELINE_NAV_CHILD, 'area-baseline', areaBaselinePage.heading],
          [
            POST_INTERVENTION_NAV_CHILD,
            'area-post-intervention',
            areaPostInterventionPage.heading
          ],
          [HEDGEROWS, 'hedgerows-summary', hedgerowsSummaryPage.heading]
        ]

        for (const [linkText, path, landingHeading] of destinations) {
          await areaTradingSummaryPage.open(project.id)
          await areaTradingSummaryPage.navLink(linkText).click()

          await expect(page, linkText).toHaveURL(
            new RegExp(`/projects/${project.id}/${path}$`)
          )
          await expect(landingHeading, linkText).toBeVisible()
        }
      }
    )

    test(
      'Upload file opens the file-type selection page',
      { tag: '@regression' },
      async ({ page, areaTradingSummaryPage, uploadFilePage }) => {
        await areaTradingSummaryPage.open(project.id)
        await areaTradingSummaryPage.uploadFileButton.click()

        await expect(page).toHaveURL(
          new RegExp(`/projects/${project.id}/upload-file\\?`)
        )
        await expect(uploadFilePage.heading).toBeVisible()
      }
    )
  })

  // ─── Intertidal project ──────────────────────────────────────────────────────
  //
  // harness valid/IGGI pair. Only the intertidal row is pinned: the IGGI parcel
  // is Retained, so it nets to 0.00 whatever the engine does. The pair's other
  // figures moved when the engine changed between 2026-09-28 and 2026-10-01, and
  // its Medium verdict rests on a deficit that renders as "0.00 units" beside
  // "Not met" — precision a journey test should not pin.

  test.describe('Area trading summary — intertidal project', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    let project
    test.beforeAll(async ({ browser }) => {
      project = await getIntertidalTradingProject(browser)
    })

    // Sole witness for the intertidal merge on real data. The engine merges the
    // two intertidal broad habitats into "Intertidal sediment and hard
    // structures" (bng-library area-trading-rules.mjs); that is tested only on
    // the synthetic worked example, and the frontend renders it only from a
    // mocked literal. Do not delete without a backend integration test that
    // uploads an intertidal fixture and asserts the merged entry.
    test(
      'merges the intertidal broad habitats into one grid',
      { tag: '@regression' },
      async ({ areaTradingSummaryPage }) => {
        await areaTradingSummaryPage.open(project.id)

        await expect(
          areaTradingSummaryPage.broadHabitatHeading(INTERTIDAL_HEADING)
        ).toBeVisible()
        // Merged, so no grid under the habitat's own broad habitat.
        await expect(
          areaTradingSummaryPage.broadHabitatHeading(
            'Intertidal hard structures'
          )
        ).toHaveCount(0)

        const grid = await areaTradingSummaryPage.readGridContaining(
          areaTradingSummaryPage.mediumSection,
          IGGI_HABITAT_TYPE
        )
        expect(grid).toEqual({
          headers: ['Broad habitat', 'Habitat type', 'On-site unit change'],
          rows: [
            ['Intertidal hard structures', IGGI_HABITAT_TYPE, '0.00'],
            [TOTAL_BROAD_HABITAT_CHANGE, '', '0.00']
          ]
        })
      }
    )

    test(
      'lists Watercourses in the navigation and it opens the watercourses summary',
      { tag: '@regression' },
      async ({ page, areaTradingSummaryPage, watercoursesSummaryPage }) => {
        await areaTradingSummaryPage.open(project.id)
        await areaTradingSummaryPage.navLink(WATERCOURSES).click()

        await expect(page).toHaveURL(
          new RegExp(`/projects/${project.id}/watercourses-summary$`)
        )
        await expect(watercoursesSummaryPage.heading).toBeVisible()
      }
    )
  })
})
