import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { uploadFileHref } from '@utils/upload-file-navigation.js'
import {
  getAllUnitTypesPostInterventionProject,
  getAllUnitTypesProject,
  getAreaGainProject,
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

const TILE_NET_PERCENTAGE = 'Total on-site net percentage change'
const TILE_TRADING_RULES = 'Trading Rules'
// With post-intervention data the tile is re-headed with a hyphen, so the
// baseline-only spelling ('On-site post intervention') will not find it.
const TILE_POST_INTERVENTION_WITH_PI = 'On-site post-intervention'
const TILE_NET_UNIT_CHANGE = 'Total on-site net unit change'

const TARGET_PERCENTAGE = 'Target percentage net gain'
const TARGET_UNITS_REQUIRED = 'Units required'
const TARGET_UNIT_DEFICIT = 'Unit deficit'

const NET_GAIN_TARGET = '10%'
const ZERO_UNITS = '0.00 units'
const UNITS_2DP = /^\d+\.\d{2} units$/

// BMD-854 AC4: the Results section carries the same five tiles as the Area
// habitats section of the project summary.
const SHARED_TILES = [
  TILE_NET_PERCENTAGE,
  TILE_TRADING_RULES,
  TILE_BASELINE,
  TILE_POST_INTERVENTION_WITH_PI,
  TILE_NET_UNIT_CHANGE
]

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

    // BMD-854 AC1. Sole witness that either route INTO this page works:
    // project-summary.spec.js asserts both hrefs are rendered, and the mocked
    // controller tests assert they are in the markup, but until this test
    // neither had ever been followed — the identical gap hedgerows closed in
    // hedgerows-summary.spec.js. Do not delete without moving the two clicks
    // onto another test that reaches this page from the project summary.
    test('the nav link and the section heading both open this page', async ({
      page,
      projectSummaryPage,
      areaSummaryPage
    }) => {
      const areaSummaryUrl = `/projects/${project.id}/area-summary`

      await projectSummaryPage.open(project.id)
      await projectSummaryPage.navLink(AREA_HABITATS).click()
      await expect(page).toHaveURL(new RegExp(areaSummaryUrl))
      await expect(areaSummaryPage.heading).toBeVisible()

      await projectSummaryPage.open(project.id)
      await projectSummaryPage.sectionHeadingLink(AREA_HABITATS).click()
      await expect(page).toHaveURL(new RegExp(areaSummaryUrl))
      await expect(areaSummaryPage.heading).toBeVisible()
    })
  })

  // ─── Left-navigation destinations ───────────────────────────────────────────

  test.describe(
    'Area summary — left navigation destinations',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // The all-unit-types baseline, not the shared baseline-only one: that
      // fixture has an empty Hedgerows layer, so the Hedgerows link this AC
      // names does not render on it at all.
      let project
      test.beforeAll(async ({ browser }) => {
        project = await getAllUnitTypesProject(browser)
      })

      // BMD-854 AC7. There is no back link on this page — the left nav is the
      // only way out, which is what makes following every link worth the click.
      // `unit-type-navigation.test.js` proves the builder as a pure function;
      // what it cannot show is that the hrefs it produces resolve.
      test('each left-navigation link opens its target page', async ({
        page,
        areaSummaryPage,
        projectSummaryPage,
        hedgerowsSummaryPage,
        watercoursesSummaryPage
      }) => {
        const destinations = [
          [SUMMARY, 'project-summary', projectSummaryPage.heading],
          [HEDGEROWS, 'hedgerows-summary', hedgerowsSummaryPage.heading],
          [
            WATERCOURSES,
            'watercourses-summary',
            watercoursesSummaryPage.heading
          ]
        ]

        for (const [label, path, heading] of destinations) {
          await areaSummaryPage.open(project.id)
          const target = `/projects/${project.id}/${path}`

          await expect(areaSummaryPage.navLink(label)).toHaveAttribute(
            'href',
            target
          )
          await areaSummaryPage.navLink(label).click()

          await expect(page).toHaveURL(new RegExp(target))
          await expect(heading).toBeVisible()
        }
      })
    }
  )

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
        await expect(
          areaBaselinePage.navItem(BASELINE_NAV_CHILD)
        ).toHaveAttribute('aria-current', 'page')
      })
    }
  )

  // ─── Post-intervention data (BMD-854 AC4 + AC5) ──────────────────────────────
  //
  // Every describe above runs on a baseline-only project, so until these tests
  // nothing had rendered this page with post-intervention data at all: not the
  // populated tile, not the real percentage, and not either non-trivial deficit
  // branch. `area-summary/controller.test.js` covers all of it against mocked
  // `wreck` literals, which proves the rendering and not that the backend emits
  // the fields; the arithmetic itself lives in the shared `buildTargetsSummary`
  // (a pure function in the frontend unit suite). What is left, and what these
  // tests hold, is this controller's CHOICE of what to feed it —
  // `areaUnits` = habitatsTotal + treesTotal — which could be re-pointed at
  // another unit type's field with the rest of the suite staying green.

  test.describe(
    'Area summary — post-intervention results',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getAllUnitTypesPostInterventionProject(browser)
      })

      test('the five Results tiles agree with the project summary', async ({
        areaSummaryPage,
        projectSummaryPage
      }) => {
        await areaSummaryPage.open(project.id)

        // The post-intervention tile is the one that changes shape once the
        // second document exists: re-headed with a hyphen, its upload link
        // replaced by inert text.
        expect(
          await areaSummaryPage.tileValue(TILE_POST_INTERVENTION_WITH_PI)
        ).toMatch(UNITS_2DP)
        await expect(areaSummaryPage.uploadPostInterventionLink()).toHaveCount(
          0
        )
        // Asserting the inert text IS there as well as unlinked: a bare
        // toHaveCount(0) passes just as happily when the action line has
        // disappeared altogether.
        await expect(
          areaSummaryPage.viewOnSitePostInterventionText()
        ).toBeVisible()

        // Read all five here, then compare against the project summary's Area
        // habitats section: both pages source them from the same backend
        // fields, so a mismatch means one of them is reading something else.
        const fromDrillDown = {}
        for (const tile of SHARED_TILES) {
          fromDrillDown[tile] = await areaSummaryPage.tileValue(tile)
        }

        await projectSummaryPage.open(project.id)
        for (const tile of SHARED_TILES) {
          expect(await projectSummaryPage.tileValue(AREA_HABITATS, tile)).toBe(
            fromDrillDown[tile]
          )
        }
      })

      test('the deficit is the shortfall between units required and post-intervention', async ({
        areaSummaryPage
      }) => {
        await areaSummaryPage.open(project.id)

        const unitsRequired = await areaSummaryPage.targetUnits(
          TARGET_UNITS_REQUIRED
        )
        const postIntervention = await areaSummaryPage.tileUnits(
          TILE_POST_INTERVENTION_WITH_PI
        )
        // Fixture check before the assertion: area units must be present and
        // must fall short, or the deficit would clamp to zero and prove nothing.
        expect(postIntervention).toBeGreaterThan(0)
        expect(postIntervention).toBeLessThan(unitsRequired)

        expect(await areaSummaryPage.targetValue(TARGET_UNIT_DEFICIT)).toMatch(
          UNITS_2DP
        )
        // Both operands are rendered to 2dp, so allow for the rounding gap.
        expect(
          await areaSummaryPage.targetUnits(TARGET_UNIT_DEFICIT)
        ).toBeCloseTo(unitsRequired - postIntervention, 1)
      })
    }
  )

  test.describe(
    'Area summary — post-intervention meets the target',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // The linear net-gain pair does nothing for area units, so this branch
      // needs the area pair — shared with project-summary.spec.js, which uses
      // it for the green "Met" tag, so it costs no extra upload in CI.
      let project
      test.beforeAll(async ({ browser }) => {
        project = await getAreaGainProject(browser)
      })

      test('the deficit is clamped to zero, not a negative surplus', async ({
        areaSummaryPage
      }) => {
        await areaSummaryPage.open(project.id)

        const unitsRequired = await areaSummaryPage.targetUnits(
          TARGET_UNITS_REQUIRED
        )
        const postIntervention = await areaSummaryPage.tileUnits(
          TILE_POST_INTERVENTION_WITH_PI
        )
        // Fixture check: this pair is only meaningful while it clears the
        // target. If the harness re-prices it, this fails before the assertion
        // below turns into a false pass.
        expect(postIntervention).toBeGreaterThanOrEqual(unitsRequired)

        expect(await areaSummaryPage.targetValue(TARGET_UNIT_DEFICIT)).toBe(
          ZERO_UNITS
        )
      })
    }
  )
})
