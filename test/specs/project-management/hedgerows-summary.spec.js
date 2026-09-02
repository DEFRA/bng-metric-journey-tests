import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import {
  getAllUnitTypesPostInterventionProject,
  getAllUnitTypesProject,
  getBaselineOnlyProject,
  getHedgerowGainProject,
  getTargetMetProject
} from '@utils/summary-projects.js'
import { uploadFileHref } from '@utils/upload-file-navigation.js'
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

// BMD-855 AC4: the Results section carries the same five tiles as the Hedgerows
// section of the project summary.
const SHARED_TILES = [
  TILE_NET_PERCENTAGE,
  TILE_TRADING_RULES,
  TILE_BASELINE,
  TILE_POST_INTERVENTION,
  TILE_NET_UNIT_CHANGE
]

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
        await expect(hedgerowsSummaryPage.resultsHeading).toBeVisible()

        // The upload button's returnUrl is built by THIS controller for this
        // page. The area summary asserting its own copy proves nothing here —
        // the value is chosen per caller, so each page needs its own witness.
        await expect(hedgerowsSummaryPage.uploadFileButton).toHaveAttribute(
          'href',
          uploadFileHref(
            project.id,
            `/projects/${project.id}/hedgerows-summary`
          )
        )

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

        // Units required is the baseline plus the 10% target. Approximate,
        // deliberately: the page multiplies the RAW baseline and formats the
        // product, while the tile above shows the baseline already rounded to
        // 2dp, so an exact expectation can be a penny out.
        expect(
          await hedgerowsSummaryPage.targetUnits(TARGET_UNITS_REQUIRED)
        ).toBeCloseTo(
          (await hedgerowsSummaryPage.tileUnits(TILE_BASELINE)) *
            NET_GAIN_TARGET_MULTIPLIER,
          1
        )
      }
    )

    // Cross-page agreement on real numbers, as area-summary.spec.js does for
    // habitatsTotal + treesTotal. Both pages read `hedgerowsTotal` through the
    // same formatter, so the rendered strings must match exactly — a mismatch
    // means one of them has been re-pointed at a different backend field.
    test(
      'the hedgerow figures agree with the project summary',
      { tag: '@regression' },
      async ({ hedgerowsSummaryPage, projectSummaryPage }) => {
        await projectSummaryPage.open(project.id)
        const fromSummary = {}
        for (const tile of SHARED_TILES) {
          fromSummary[tile] = await projectSummaryPage.tileValue(
            HEDGEROWS,
            tile
          )
        }

        await hedgerowsSummaryPage.open(project.id)
        for (const tile of SHARED_TILES) {
          expect(await hedgerowsSummaryPage.tileValue(tile), tile).toBe(
            fromSummary[tile]
          )
        }
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
      // Current means bold text rather than a link: markCurrent deletes the
      // href, so the item is a <strong> with nothing to click.
      await expect(hedgerowsSummaryPage.navLink(HEDGEROWS)).toHaveCount(0)

      // Moving to a different unit type collapses the one you came from, so the
      // Baseline child is gone even though Area habitats still links.
      await expect(hedgerowsSummaryPage.navLink(AREA_HABITATS)).toBeVisible()
      await expect(
        hedgerowsSummaryPage.navLink(BASELINE_NAV_CHILD)
      ).toHaveCount(0)
      await expect(hedgerowsSummaryPage.navLink(SUMMARY)).toBeVisible()

      // This fixture has rivers, so the conditional Watercourses item renders.
      // area-summary.spec.js witnesses the other side of the same condition,
      // where an empty layer drops the item from the nav entirely.
      await expect(hedgerowsSummaryPage.navLink(WATERCOURSES)).toBeVisible()
    })
  })

  // ─── Navigation wiring (BMD-855 AC1, AC6, AC7) ───────────────────────────────

  test.describe(
    'Hedgerows summary — navigation wiring',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getAllUnitTypesProject(browser)
      })

      // Sole witness that the hedgerow route INTO this page works. The same two
      // links are asserted for area habitats and watercourses in
      // project-summary.spec.js, but on NO_HEDGEROWS_FILE — a fixture with no
      // Hedgerows section and no Hedgerows nav item at all — so neither entry
      // point has ever been followed. Both render only when
      // `projectHasHabitatData(project, 'hedgerows')` holds against real
      // uploaded data, which the mocked controller tests cannot establish. Do
      // not delete without moving the clicks onto another test that uploads a
      // hedgerow-bearing baseline.
      test('the nav link and the section heading both open this page', async ({
        page,
        projectSummaryPage,
        hedgerowsSummaryPage
      }) => {
        const hedgerowsUrl = `/projects/${project.id}/hedgerows-summary`

        await projectSummaryPage.open(project.id)
        await projectSummaryPage.navigation
          .getByRole('link', { name: HEDGEROWS })
          .click()
        await expect(page).toHaveURL(new RegExp(hedgerowsUrl))
        await expect(hedgerowsSummaryPage.heading).toBeVisible()

        await projectSummaryPage.open(project.id)
        await projectSummaryPage.sectionHeadingLink(HEDGEROWS).click()
        await expect(page).toHaveURL(new RegExp(hedgerowsUrl))
        await expect(hedgerowsSummaryPage.heading).toBeVisible()
      })

      // The unit tests assert the upload href is in the markup; only a real
      // navigation shows that following it resolves and that Back/Cancel come
      // back HERE rather than defaulting to the task list.
      test('"Upload file" opens the file-type selection page, whose Back returns here', async ({
        page,
        hedgerowsSummaryPage,
        uploadFilePage
      }) => {
        const hedgerowsUrl = `/projects/${project.id}/hedgerows-summary`
        await hedgerowsSummaryPage.open(project.id)

        await hedgerowsSummaryPage.uploadFileButton.click()

        await expect(uploadFilePage.heading).toBeVisible()
        await uploadFilePage.assertReturnLinks(hedgerowsUrl)

        await uploadFilePage.backLink.click()
        await expect(page).toHaveURL(new RegExp(hedgerowsUrl))
      })

      // There is no back link on this page — the left nav is the only way out,
      // which is what makes following every one of its links worth the click.
      // `unit-type-navigation.test.js` proves the builder as a pure function;
      // what it cannot show is that the three hrefs it produces resolve.
      test('each left-navigation link opens its target page', async ({
        page,
        hedgerowsSummaryPage,
        projectSummaryPage,
        areaSummaryPage,
        watercoursesSummaryPage
      }) => {
        const destinations = [
          [SUMMARY, 'project-summary', projectSummaryPage.heading],
          [AREA_HABITATS, 'area-summary', areaSummaryPage.heading],
          [
            WATERCOURSES,
            'watercourses-summary',
            watercoursesSummaryPage.heading
          ]
        ]

        for (const [label, path, heading] of destinations) {
          await hedgerowsSummaryPage.open(project.id)
          const target = `/projects/${project.id}/${path}`

          await expect(hedgerowsSummaryPage.navLink(label)).toHaveAttribute(
            'href',
            target
          )
          await hedgerowsSummaryPage.navLink(label).click()

          await expect(page).toHaveURL(new RegExp(target))
          await expect(heading).toBeVisible()
        }
      })
    }
  )

  // ─── Targets against post-intervention data (BMD-855 AC5) ────────────────────
  //
  // Sole witness for both non-trivial deficit branches, on ANY unit-type page:
  // every other drill-down test runs on a baseline-only project, where the
  // deficit is trivially the whole requirement. The arithmetic itself lives in
  // the shared `buildTargetsSummary` (covered as a pure function in the
  // frontend unit suite), but this controller chooses what to feed it —
  // `postIntervention.units.hedgerowsTotal` — so re-pointing it at another unit
  // type's field would leave every other test in the suite green. Do not delete
  // either test without adding a post-intervention witness in its place.

  test.describe(
    'Hedgerows summary — post-intervention meets the target',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getTargetMetProject(browser)
      })

      test('the deficit is clamped to zero, not a negative surplus', async ({
        hedgerowsSummaryPage
      }) => {
        await hedgerowsSummaryPage.open(project.id)

        const unitsRequired = await hedgerowsSummaryPage.targetUnits(
          TARGET_UNITS_REQUIRED
        )
        const postIntervention = await hedgerowsSummaryPage.tileUnits(
          TILE_POST_INTERVENTION_WITH_PI
        )
        // Fixture check: this pair is only meaningful while it clears the
        // target. If the harness re-prices it, this fails before the assertion
        // below turns into a false pass.
        expect(postIntervention).toBeGreaterThanOrEqual(unitsRequired)

        expect(
          await hedgerowsSummaryPage.targetValue(TARGET_UNIT_DEFICIT)
        ).toBe(ZERO_UNITS)
      })
    }
  )

  test.describe(
    'Hedgerows summary — post-intervention falls short of the target',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getAllUnitTypesPostInterventionProject(browser)
      })

      test('the deficit is the shortfall between units required and post-intervention', async ({
        hedgerowsSummaryPage
      }) => {
        await hedgerowsSummaryPage.open(project.id)

        const unitsRequired = await hedgerowsSummaryPage.targetUnits(
          TARGET_UNITS_REQUIRED
        )
        const postIntervention = await hedgerowsSummaryPage.tileUnits(
          TILE_POST_INTERVENTION_WITH_PI
        )
        // Both halves matter: hedgerows must be present post-intervention (or
        // this is the BMD-897 variant, not this branch) and must fall short (or
        // the deficit would clamp to zero and prove nothing).
        expect(postIntervention).toBeGreaterThan(0)
        expect(postIntervention).toBeLessThan(unitsRequired)

        expect(
          await hedgerowsSummaryPage.targetValue(TARGET_UNIT_DEFICIT)
        ).toMatch(UNITS_2DP)
        // Both operands are rendered to 2dp, so allow for the rounding gap.
        expect(
          await hedgerowsSummaryPage.targetUnits(TARGET_UNIT_DEFICIT)
        ).toBeCloseTo(unitsRequired - postIntervention, 1)
      })
    }
  )

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
