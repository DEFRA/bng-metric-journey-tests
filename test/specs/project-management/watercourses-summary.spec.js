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
  getAllUnitTypesPostInterventionProject,
  getAllUnitTypesProject,
  getWatercourseGainProject
} from '@utils/summary-projects.js'
import { uploadFileHref } from '@utils/upload-file-navigation.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

const TILE_NET_PERCENTAGE = 'Total on-site net percentage change'
const TILE_TRADING_RULES = 'Trading Rules'
const TILE_POST_INTERVENTION = 'On-site post intervention'
// With post-intervention data the same tile is re-headed with a hyphen, so a
// locator keyed to the baseline-only spelling will not find it.
const TILE_POST_INTERVENTION_WITH_PI = 'On-site post-intervention'
const TILE_NET_UNIT_CHANGE = 'Total on-site net unit change'
const TARGET_PERCENTAGE = 'Target percentage net gain'
const TARGET_UNITS_REQUIRED = 'Units required'
const TARGET_UNIT_DEFICIT = 'Unit deficit'

const NET_GAIN_TARGET = '10%'
const ZERO_UNITS = '0.00 units'
const UNITS_2DP = /^\d+\.\d{2} units$/
const POST_INTERVENTION_ONLY_PERCENTAGE = 'Not applicable'
const NET_GAIN_TARGET_MULTIPLIER = 1.1

// BMD-856 AC4: the Results section carries the same five tiles as the
// Watercourses section of the project summary.
const SHARED_TILES = [
  TILE_NET_PERCENTAGE,
  TILE_TRADING_RULES,
  TILE_BASELINE,
  TILE_POST_INTERVENTION_WITH_PI,
  TILE_NET_UNIT_CHANGE
]

// This page was the shared "under construction" placeholder until
// BMD-856/BMD-921 (frontend PR#250) built it on 2026-09-01. The placeholder
// tests that stood here failed on the very next CI run, which is exactly what
// they were written to do — see the note in the flow doc.
//
// Now structurally identical to the hedgerows summary, so as there, these tests
// do NOT re-assert the shared layout or the nav mechanics: area-summary.spec.js
// witnesses those against real data. Covered here is only what differs — the
// watercourse BACKEND FIELDS (baseline and post-intervention), this
// controller's own upload returnUrl and baseline link, the two routes into the
// page, and the post-intervention-only variant for THIS unit type.
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
        await expect(watercoursesSummaryPage.resultsHeading).toBeVisible()

        // BMD-856 AC3/AC6. The upload button's returnUrl is built by THIS
        // controller for this page, so the area and hedgerow specs asserting
        // their own copies prove nothing here — the value is chosen per caller.
        await expect(watercoursesSummaryPage.uploadFileButton).toHaveAttribute(
          'href',
          uploadFileHref(
            project.id,
            `/projects/${project.id}/watercourses-summary`
          )
        )

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

    // BMD-861's half of frontend PR#266 (2026-09-04), the watercourse twin of
    // BMD-859 AC1: the tile was inert until that PR passed
    // `watercoursesBaselineAction(href)` into this controller. Following the
    // link belongs to BMD-861's own AC sweep — asserted here is that this page
    // emits its own unit type's wording rather than the shared default.
    test('the baseline tile links to the watercourses baseline page', async ({
      watercoursesSummaryPage
    }) => {
      await watercoursesSummaryPage.open(project.id)

      await expect(watercoursesSummaryPage.baselineLink()).toHaveAttribute(
        'href',
        `/projects/${project.id}/watercourses-baseline`
      )
      await expect(
        watercoursesSummaryPage.viewOnSiteBaselineText()
      ).toHaveCount(0)
    })

    test('Watercourses is current and expands its own Baseline child', async ({
      watercoursesSummaryPage
    }) => {
      await watercoursesSummaryPage.open(project.id)

      await expect(
        watercoursesSummaryPage.navItem(WATERCOURSES)
      ).toHaveAttribute('aria-current', 'page')
      // Current means bold text rather than a link: markCurrent deletes the
      // href, so the item is a <strong> with nothing to click.
      await expect(watercoursesSummaryPage.navLink(WATERCOURSES)).toHaveCount(0)

      // BMD-856 AC7. Asserting the hrefs rather than mere visibility: this
      // page has no back link, so the left nav is the only way out, and the
      // AC names a destination per link. area-summary.spec.js and
      // hedgerows-summary.spec.js follow the equivalent links from their own
      // pages, which is what makes clicking all three again here redundant.
      const destinations = [
        [AREA_HABITATS, 'area-summary'],
        [HEDGEROWS, 'hedgerows-summary'],
        [SUMMARY, 'project-summary']
      ]

      for (const [label, path] of destinations) {
        await expect(watercoursesSummaryPage.navLink(label)).toHaveAttribute(
          'href',
          `/projects/${project.id}/${path}`
        )
      }
      // BMD-859/861: the Baseline child follows the current section now that
      // every unit type has a baseline page. The locator is nav-wide, so strict
      // mode fails if another section were expanded alongside this one.
      await expect(
        watercoursesSummaryPage.navLink(BASELINE_NAV_CHILD)
      ).toHaveAttribute('href', `/projects/${project.id}/watercourses-baseline`)
    })

    // BMD-856 AC1. Sole witness that either route INTO this page from the
    // project summary works: project-summary.spec.js:947 asserts both hrefs are
    // rendered and watercourses-summary/controller.test.js proves the
    // destination renders against mocked data, but until this test neither link
    // had ever been followed. area-summary.spec.js:220 and
    // hedgerows-summary.spec.js:236 close the identical gap for the other two
    // unit types. The nav clicks in those two files reach this page from a
    // SIBLING drill-down, not from the summary, so they do not stand in for
    // this. Do not delete without moving both clicks onto another test that
    // reaches this page from the project summary.
    test('the nav link and the section heading both open this page', async ({
      page,
      projectSummaryPage,
      watercoursesSummaryPage
    }) => {
      const watercoursesUrl = `/projects/${project.id}/watercourses-summary`

      await projectSummaryPage.open(project.id)
      await projectSummaryPage.navLink(WATERCOURSES).click()
      await expect(page).toHaveURL(new RegExp(watercoursesUrl))
      await expect(watercoursesSummaryPage.heading).toBeVisible()

      await projectSummaryPage.open(project.id)
      await projectSummaryPage.sectionHeadingLink(WATERCOURSES).click()
      await expect(page).toHaveURL(new RegExp(watercoursesUrl))
      await expect(watercoursesSummaryPage.heading).toBeVisible()
    })
  })

  // ─── Post-intervention results and targets (BMD-856 AC4 + AC5) ───────────────
  //
  // Every other describe in this file runs on a baseline-only project or on the
  // BMD-897 post-intervention-ONLY variant, so until this one nothing had
  // rendered this page with BOTH documents populated: not the re-headed
  // post-intervention tile, not the real percentage, and not the deficit's
  // subtraction branch. `postIntervention.units.watercoursesTotal` reaching
  // THIS page is a distinct data family from the baseline field the smoke test
  // above holds.
  //
  // The arithmetic itself lives in the shared `buildTargetsSummary` (a pure
  // function, covered in the frontend unit suite), and the mocked
  // `watercourses-summary/controller.test.js` covers the rendering. What
  // neither can show is this controller's CHOICE of what to feed it —
  // `postInterventionUnits.watercoursesTotal` — which could be re-pointed at
  // hedgerows with every other test in the suite staying green.

  test.describe(
    'Watercourses summary — post-intervention results',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getAllUnitTypesPostInterventionProject(browser)
      })

      test('the five Results tiles agree with the project summary', async ({
        watercoursesSummaryPage,
        projectSummaryPage
      }) => {
        await watercoursesSummaryPage.open(project.id)

        // The post-intervention tile is the one that changes shape once the
        // second document exists: re-headed with a hyphen, its upload link
        // replaced by inert text.
        expect(
          await watercoursesSummaryPage.tileValue(
            TILE_POST_INTERVENTION_WITH_PI
          )
        ).toMatch(UNITS_2DP)
        await expect(
          watercoursesSummaryPage.uploadPostInterventionLink()
        ).toHaveCount(0)
        // Asserting the inert text IS there as well as unlinked: a bare
        // toHaveCount(0) passes just as happily when the action line has
        // disappeared altogether.
        await expect(
          watercoursesSummaryPage.viewOnSitePostInterventionText()
        ).toBeVisible()

        // Read all five here, then compare against the project summary's
        // Watercourses section: both pages source them from the same backend
        // fields, so a mismatch means one of them is reading something else.
        const fromDrillDown = {}
        for (const tile of SHARED_TILES) {
          fromDrillDown[tile] = await watercoursesSummaryPage.tileValue(tile)
        }

        await projectSummaryPage.open(project.id)
        for (const tile of SHARED_TILES) {
          expect(
            await projectSummaryPage.tileValue(WATERCOURSES, tile),
            tile
          ).toBe(fromDrillDown[tile])
        }
      })

      test('the deficit is the shortfall between units required and post-intervention', async ({
        watercoursesSummaryPage
      }) => {
        await watercoursesSummaryPage.open(project.id)

        const unitsRequired = await watercoursesSummaryPage.targetUnits(
          TARGET_UNITS_REQUIRED
        )
        const postIntervention = await watercoursesSummaryPage.tileUnits(
          TILE_POST_INTERVENTION_WITH_PI
        )
        // Fixture check before the assertion: watercourses must be present
        // post-intervention (or this is the BMD-897 variant, not this branch)
        // and must fall short (or the deficit would clamp to zero and prove
        // nothing).
        expect(postIntervention).toBeGreaterThan(0)
        expect(postIntervention).toBeLessThan(unitsRequired)

        // Units required is the baseline plus the 10% target. Approximate,
        // deliberately: the page multiplies the RAW baseline and formats the
        // product, while the tile shows the baseline already rounded to 2dp, so
        // an exact expectation can be a penny out.
        expect(unitsRequired).toBeCloseTo(
          (await watercoursesSummaryPage.tileUnits(TILE_BASELINE)) *
            NET_GAIN_TARGET_MULTIPLIER,
          1
        )

        expect(
          await watercoursesSummaryPage.targetValue(TARGET_UNIT_DEFICIT)
        ).toMatch(UNITS_2DP)
        // Both operands are rendered to 2dp, so allow for the rounding gap.
        expect(
          await watercoursesSummaryPage.targetUnits(TARGET_UNIT_DEFICIT)
        ).toBeCloseTo(unitsRequired - postIntervention, 1)
      })
    }
  )

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
