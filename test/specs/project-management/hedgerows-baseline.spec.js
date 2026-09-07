import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { uploadFileHref } from '@utils/upload-file-navigation.js'
import {
  getAllUnitTypesProject,
  getNoWatercoursesProject
} from '@utils/summary-projects.js'
import {
  AREA_HABITATS,
  BASELINE_NAV_CHILD,
  HEDGEROWS,
  SUMMARY,
  TILE_BASELINE,
  VIEW_ON_SITE_HEDGEROWS_BASELINE,
  WATERCOURSES
} from '@utils/unit-type-labels.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

const BASELINE_PATH = 'hedgerows-baseline'

const UNITS_2DP = /^\d+\.\d{2}$/
const KILOMETRES = /^\d+(\.\d+)?km$/
const FIXED_STRATEGIC_SIGNIFICANCE = 'Low (1)'
const REF_SORT_LOCALE = 'en'

// `Baseline - all unit and intervention types.gpkg` — 40 hedgerows. Pinned
// rather than counted loosely: a partial render is exactly the failure a
// `> 0` check would wave through.
const EXPECTED_HEDGEROWS = 40

// BMD-859 AC5: the same five tiles the project summary and the hedgerows
// summary carry, in the same order. Baseline-only project, so the
// post-intervention tile keeps its unhyphenated heading.
const TILE_HEADINGS = [
  'Total on-site net percentage change',
  'Trading Rules',
  TILE_BASELINE,
  'On-site post intervention',
  'Total on-site net unit change'
]

// BMD-859 AC6, as built. SEVEN columns: "Broad habitat" is an extraColumn the
// linear pages do not pass, because the field does not apply to hedgerows
// (confirmed on the ticket, 2026-09-02). Headings render in GOV.UK sentence
// case rather than the AC's title case.
const COLUMN_HEADINGS = [
  'Ref',
  'Units',
  'Size',
  'Habitat type',
  'Distinctiveness',
  'Condition',
  'Strategic significance'
]

// "{label} ({multiplier})". The score is REQUIRED, not optional: the controller
// drops it only for a non-finite multiplier, which no row of a valid baseline
// carries, and an optional group would let a regression that dropped every
// multiplier pass unchanged.
const LABEL_AND_SCORE = /^[^()]+ \(-?\d+(\.\d+)?\)$/

// Read-only, like every drill-down. Both projects come from
// @utils/summary-projects.js and are already built by area-summary,
// hedgerows-summary, project-summary and habitat-list, so this file costs no
// upload of its own in CI.
test.describe('project-management', { tag: '@project-management' }, () => {
  test.describe.configure({ mode: 'serial' })

  test.describe('Hedgerows baseline — feature table', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    let project
    test.beforeAll(async ({ browser }) => {
      project = await getAllUnitTypesProject(browser)
    })

    // `hedgerows-baseline/controller.test.js` covers this page through the
    // shared `registerLinearBaselinePageTests` suite, with `wreck` mocked and
    // two hand-built features. What it cannot show is that a REAL uploaded
    // hedgerow carries the fields the grid reads: nothing in the backend
    // integration suite asserts them either — `baseline-persistence.test.js:50`
    // checks only that `units` is a number, and `features.test.js:68` seeds its
    // hedgerow by hand. This is the sole witness that ref, sizeMetres,
    // distinctiveness and condition survive a real import. Do not delete
    // without adding per-feature assertions to the backend's real-upload test.
    test(
      'lists every baseline hedgerow, sorted by ref, with formatted values',
      { tag: ['@smoke', '@happy-path'] },
      async ({ hedgerowsBaselinePage }) => {
        await hedgerowsBaselinePage.open(project.id)

        await expect(hedgerowsBaselinePage.heading).toBeVisible()
        await expect(hedgerowsBaselinePage.detailsHeading).toBeVisible()
        await expect(hedgerowsBaselinePage.columnHeaders()).toHaveText(
          COLUMN_HEADINGS
        )
        await expect(hedgerowsBaselinePage.featureRows()).toHaveCount(
          EXPECTED_HEDGEROWS
        )

        const [refs, units, sizes, distinctiveness, condition, significance] =
          await Promise.all([
            hedgerowsBaselinePage.columnValues('ref'),
            hedgerowsBaselinePage.columnValues('units'),
            hedgerowsBaselinePage.columnValues('size'),
            hedgerowsBaselinePage.columnValues('distinctiveness'),
            hedgerowsBaselinePage.columnValues('condition'),
            hedgerowsBaselinePage.columnValues('strategicSignificance')
          ])

        // AC7: the server sorts by ref ascending before rendering, and no
        // column is highlighted until the user clicks one.
        expect(refs).toEqual(
          [...refs].sort((a, b) =>
            a.localeCompare(b, REF_SORT_LOCALE, { numeric: true })
          )
        )
        for (const header of await hedgerowsBaselinePage
          .columnHeaders()
          .all()) {
          await expect(header).toHaveAttribute('aria-sort', 'none')
        }

        // Across every row, not just the first: the formatters are applied per
        // cell, so a value only some features carry would slip past a row-0
        // check. Length-checked as well as matched — a column that returned no
        // cells at all would satisfy its `for` loop vacuously.
        for (const column of [units, sizes, distinctiveness, condition]) {
          expect(column).toHaveLength(EXPECTED_HEDGEROWS)
        }

        for (const value of units) expect(value).toMatch(UNITS_2DP)
        // Kilometres with no space before the suffix — the linear pages'
        // formatter, where the area page uses hectares.
        for (const value of sizes) expect(value).toMatch(KILOMETRES)
        for (const value of distinctiveness)
          expect(value).toMatch(LABEL_AND_SCORE)
        for (const value of condition) expect(value).toMatch(LABEL_AND_SCORE)

        // BMD-315 AC9 pins this to Low (1) for MVS regardless of what the
        // GeoPackage carried — the engine hardcodes the baseline multiplier to
        // 1, so showing the uploaded category would misrepresent the units.
        expect(significance).toHaveLength(EXPECTED_HEDGEROWS)
        expect(new Set(significance)).toEqual(
          new Set([FIXED_STRATEGIC_SIGNIFICANCE])
        )
      }
    )

    // The highest-value assertion on this page. The totals row is summed
    // SERVER-SIDE from the rendered features (`sumFinite`), while the tile
    // above it comes from the backend's own persisted aggregate
    // (`baseline.units.hedgerowsTotal`). Two independent paths to the same
    // number — nothing else in any suite compares them, and a disagreement
    // means either the aggregate or the feature list is wrong.
    //
    // Compared numerically with a tolerance rather than as strings: the tile
    // uses `formatUnits` (15 s.f. → 2dp) and the totals cell
    // `formatHabitatUnits` (7 s.f. → 2dp), so they can differ in the last place
    // without either being wrong.
    test('the totals row agrees with the backend unit aggregate', async ({
      hedgerowsBaselinePage
    }) => {
      await hedgerowsBaselinePage.open(project.id)

      const tileUnits = await hedgerowsBaselinePage.tileUnits(TILE_BASELINE)
      const totalsUnits = Number(
        await hedgerowsBaselinePage.totalsCell('units').innerText()
      )

      expect(totalsUnits).toBeCloseTo(tileUnits, 1)

      await expect(hedgerowsBaselinePage.totalsCell('ref')).toHaveText('Total')
      // The totals size uses 10 s.f. against the rows' 7 — a different
      // formatter, so it needs its own assertion rather than riding on theirs.
      await expect(hedgerowsBaselinePage.totalsCell('size')).toHaveText(
        KILOMETRES
      )
      // The four non-numeric columns stay empty in the totals row.
      await expect(hedgerowsBaselinePage.totalsCell('habitatType')).toHaveText(
        ''
      )
      await expect(
        hedgerowsBaselinePage.totalsCell('strategicSignificance')
      ).toHaveText('')
    })

    // AC6's last bullet. The unit suite asserts the pane is in the markup with
    // the right aria-label; what it cannot see is whether the pane ever
    // actually overflows, which is the whole point of the requirement. Chromium
    // on Linux paints overlay scrollbars, so there is no bar to assert on: the
    // measurable fact is the overflow itself.
    test('the details table sits in a pane that overflows horizontally', async ({
      hedgerowsBaselinePage
    }) => {
      await hedgerowsBaselinePage.open(project.id)

      const { scrollWidth, clientWidth, scrollLeft } =
        await hedgerowsBaselinePage.scrollDetailsPaneToEnd()

      expect(scrollWidth).toBeGreaterThan(clientWidth)
      // It moved, so the overflow is scrollable rather than clipped.
      expect(scrollLeft).toBeGreaterThan(0)
    })

    // AC8 and AC9. The `aria-sort` toggling itself is MoJ's own component
    // behaviour — the ACs say "default component behaviour" — and is already
    // witnessed by real clicks in habitat-list-upload.spec.js:341-381, so it is
    // used here only to wait on. What this test claims is the RESULTING ROW
    // ORDER, which nothing else checks: the deprecated habitat list emits its
    // own unpadded `data-sort-value`s and never asserts an order, and
    // `baseline-habitat-grid.test.js:27` only simulates the comparison in Node.
    // Sole witness that this grid's sort values actually drive the component.
    // Do not delete without asserting row order wherever the clicks move to.
    test('clicking a column heading re-orders the rows by that column', async ({
      hedgerowsBaselinePage
    }) => {
      await hedgerowsBaselinePage.open(project.id)

      const unitsHeader = hedgerowsBaselinePage.columnHeaders().nth(1)
      const sortButton = hedgerowsBaselinePage.sortButton('units')

      await sortButton.click()
      await expect(unitsHeader).toHaveAttribute('aria-sort', 'ascending')
      const ascending = (await hedgerowsBaselinePage.columnValues('units')).map(
        Number
      )
      expect(ascending).toHaveLength(EXPECTED_HEDGEROWS)
      expect(ascending).toEqual([...ascending].sort((a, b) => a - b))

      await sortButton.click()
      await expect(unitsHeader).toHaveAttribute('aria-sort', 'descending')
      const descending = (
        await hedgerowsBaselinePage.columnValues('units')
      ).map(Number)
      expect(descending).toEqual([...descending].sort((a, b) => b - a))
    })
  })

  // ─── Page furniture (AC3, AC4, AC5, AC11, AC12) ──────────────────────────────

  test.describe(
    'Hedgerows baseline — page furniture',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getAllUnitTypesProject(browser)
      })

      // The unit suite covers all of this against mocked `wreck` literals,
      // which proves the RENDERING and not that a real project reaches it. The
      // upload href is the part worth pinning specifically: `uploadFileHref` is
      // parameterised per page, so a test of the helper proves the encoding
      // while only this assertion proves THIS page hands it its own returnUrl.
      test('renders the caption, five tiles and an upload action returning here', async ({
        hedgerowsBaselinePage
      }) => {
        await hedgerowsBaselinePage.open(project.id)

        await expect(hedgerowsBaselinePage.caption(project.name)).toBeVisible()
        await expect(hedgerowsBaselinePage.heading).toBeVisible()
        await expect(hedgerowsBaselinePage.resultsHeading).toBeVisible()
        await expect(hedgerowsBaselinePage.tileHeadings()).toHaveText(
          TILE_HEADINGS
        )

        // AC5's bullet, amended on 2026-09-04: the baseline tile carries NO
        // action line at all — not a link, and not the inert text line the page
        // rendered before PR#266 — because it would point at this very page.
        await expect(
          hedgerowsBaselinePage
            .unitSection()
            .getByRole('link', { name: VIEW_ON_SITE_HEDGEROWS_BASELINE })
        ).toHaveCount(0)
        await expect(
          hedgerowsBaselinePage
            .unitSection()
            .getByText(/^View on-site (hedgerows )?baseline$/)
        ).toHaveCount(0)

        await expect(hedgerowsBaselinePage.uploadFileButton).toHaveAttribute(
          'href',
          uploadFileHref(project.id, `/projects/${project.id}/${BASELINE_PATH}`)
        )
      })

      // AC11. The unit tests assert the upload href is in the markup; only a
      // real navigation shows that following it resolves and that Back/Cancel
      // come back HERE rather than to the summary page above.
      test('"Upload file" opens the file-type selection page, whose Back returns here', async ({
        page,
        hedgerowsBaselinePage,
        uploadFilePage
      }) => {
        const baselineUrl = `/projects/${project.id}/${BASELINE_PATH}`
        await hedgerowsBaselinePage.open(project.id)

        await hedgerowsBaselinePage.uploadFileButton.click()

        await expect(uploadFilePage.heading).toBeVisible()
        await uploadFilePage.assertReturnLinks(baselineUrl)

        await uploadFilePage.backLink.click()
        await expect(page).toHaveURL(new RegExp(baselineUrl))
      })

      // AC3 and AC12. `unit-type-navigation.test.js:102` proves the builder
      // produces this shape as a pure function; this proves the page renders it
      // from a project whose habitats actually earn all four entries.
      //
      // Following the links is area-summary.spec.js:260's job — the four
      // destinations are the same, and re-clicking them here would test the
      // shared macro rather than this page. What is asserted is that this page
      // emits them at all, which on a fixture without hedgerows it could not.
      test('renders the full left navigation with Baseline as the current child', async ({
        hedgerowsBaselinePage
      }) => {
        await hedgerowsBaselinePage.open(project.id)

        await expect(hedgerowsBaselinePage.navigation).toBeVisible()

        // The current item is a nested child whose PARENT stays a link — the
        // shape only the baseline pages have.
        await expect(
          hedgerowsBaselinePage.navItem(BASELINE_NAV_CHILD)
        ).toHaveAttribute('aria-current', 'page')
        await expect(
          hedgerowsBaselinePage.navLink(BASELINE_NAV_CHILD)
        ).toHaveCount(0)

        const destinations = [
          [SUMMARY, 'project-summary'],
          [AREA_HABITATS, 'area-summary'],
          [HEDGEROWS, 'hedgerows-summary'],
          [WATERCOURSES, 'watercourses-summary']
        ]

        for (const [label, path] of destinations) {
          await expect(hedgerowsBaselinePage.navLink(label)).toHaveAttribute(
            'href',
            `/projects/${project.id}/${path}`
          )
        }
      })
    }
  )

  // ─── AC3's conditional Watercourses item, negative half ──────────────────────

  test.describe(
    'Hedgerows baseline — project with no watercourses',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // 16 hedgerows and NO rivers — so the page itself still renders while the
      // conditional nav item must not. project-summary.spec.js and
      // habitat-list-upload.spec.js already build this project.
      let project
      test.beforeAll(async ({ browser }) => {
        project = await getNoWatercoursesProject(browser)
      })

      // The other half of AC3's condition. `projectHasHabitatData` is called
      // per unit type with its own habitat key, so the positive case asserted
      // above does not prove the negative one: pass the wrong key and the item
      // renders on every project.
      test('omits the Watercourses nav item entirely', async ({
        hedgerowsBaselinePage
      }) => {
        await hedgerowsBaselinePage.open(project.id)

        await expect(hedgerowsBaselinePage.heading).toBeVisible()
        await expect(hedgerowsBaselinePage.navItem(WATERCOURSES)).toHaveCount(0)
        // The three that survive, so a nav that failed to render at all cannot
        // pass this test.
        await expect(hedgerowsBaselinePage.navLink(SUMMARY)).toBeVisible()
        await expect(hedgerowsBaselinePage.navLink(AREA_HABITATS)).toBeVisible()
        await expect(hedgerowsBaselinePage.navLink(HEDGEROWS)).toBeVisible()
      })
    }
  )

  // ─── Entry point and drill-down ──────────────────────────────────────────────

  test.describe(
    'Hedgerows baseline — entry and clickthrough',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getAllUnitTypesProject(browser)
      })

      // BMD-859 AC2. Sole witness for this route: project-summary.spec.js:984
      // asserts the equivalent links for area habitats and watercourses, but on
      // `Baseline - no hedgerows.gpkg` — a fixture with no Hedgerows section at
      // all, so the hedgerow tile has never been rendered there, let alone
      // clicked. Do not delete without moving the click onto another test that
      // reaches the project summary from a hedgerow-bearing baseline.
      test('the project summary hedgerows baseline tile opens this page', async ({
        page,
        projectSummaryPage,
        hedgerowsBaselinePage
      }) => {
        await projectSummaryPage.open(project.id)

        const baselineLink =
          projectSummaryPage.viewOnSiteHedgerowsBaselineLink(HEDGEROWS)

        await expect(baselineLink).toHaveAttribute(
          'href',
          `/projects/${project.id}/${BASELINE_PATH}`
        )
        await baselineLink.click()

        await expect(page).toHaveURL(
          new RegExp(`/projects/${project.id}/${BASELINE_PATH}`)
        )
        await expect(hedgerowsBaselinePage.heading).toBeVisible()
        await expect(hedgerowsBaselinePage.detailsTable).toBeVisible()
      })

      // BMD-859 AC10. Wiring the unit tests cannot reach: they assert the href
      // is in the markup, not that following it resolves to that feature's
      // page. area-baseline.spec.js:317 does the same for area habitats, but
      // `baseline.hedgerows` is a different backend collection resolved by a
      // different branch of the features endpoint — which is what makes the
      // heading assertion below worth its click.
      test('clicking a Ref opens that hedgerow on the baseline habitat details page', async ({
        page,
        hedgerowsBaselinePage,
        baselineHabitatDetailsPage
      }) => {
        await hedgerowsBaselinePage.open(project.id)

        const firstRef = (await hedgerowsBaselinePage.columnValues('ref'))[0]
        await hedgerowsBaselinePage.refLink(firstRef).click()

        await page.waitForURL(/\/baseline-habitat-details\?/)
        await expect(baselineHabitatDetailsPage.heading).toBeVisible()
        // That hedgerow, not merely a feature: the heading is built from what
        // the backend resolved the featureId to, so a link pointing at the
        // wrong row would still land on a valid page.
        await expect(baselineHabitatDetailsPage.heading).toContainText(firstRef)
        expect(page.url()).toContain(`projectId=${project.id}`)
        expect(page.url()).toContain('featureId=')
      })
    }
  )
})
