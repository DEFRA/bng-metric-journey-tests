import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import {
  getAllUnitTypesPostInterventionProject,
  getAreaInterventionTypesProject
} from '@utils/summary-projects.js'

// The area habitats post-intervention page (BMD-858 / BMD-997) —
// `/projects/{id}/area-post-intervention`. See
// test/flows/project-management/area-post-intervention.flow.md.
//
// This file covers BMD-997, the grids inside the intervention-type tabs. The
// BMD-858 page furniture (nav, header, tiles, size section, tab shell) has no
// journey coverage yet — see the flow doc.

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
// The shared-build upload budget. It sits on `describe.configure` because the
// build runs in `beforeAll`, where a per-test `setTimeout()` comes too late.
const SHARED_BUILD_TEST_TIMEOUT = 180_000

const PAGE_PATH = 'area-post-intervention'

const RETAINED = 'Retained'
const ENHANCED = 'Enhanced'
const CREATED = 'Created'
const ALL_TABS = [RETAINED, ENHANCED, CREATED]

// Grid cells carry the bare number; the tiles above them append " units".
const GRID_UNITS_2DP = /^-?\d+\.\d{2}$/
// Hectares with no space before the suffix — `formatAreaHectares`.
const HECTARES = /^\d+(\.\d+)?ha$/
// "{label} ({score})". The score is REQUIRED: an optional group would let a
// regression that dropped every multiplier pass.
const LABEL_AND_SCORE = /^[^()]+ \(-?\d+(\.\d+)?\)$/
const YEARS = /^\d+ years?$/
// "{n} year(s) ({multiplier})" — the Final time to target shape.
const YEARS_AND_SCORE = /^\d+ years? \(-?\d+(\.\d+)?\)$/
// Retained features carry their baseline strategic significance, fixed at
// Low (1) for MVS (BMD-315 AC9).
const FIXED_STRATEGIC_SIGNIFICANCE = 'Low (1)'

// Column sets from `buildColumns` in post-intervention-habitat-grid.js, with
// the area page's Broad habitat column inserted after Size. Headings render in
// GOV.UK sentence case where the ticket's AC4 table title-cases "Standard
// Difficulty".
const RETAINED_COLUMNS = [
  'Ref',
  'Units',
  'Size',
  'Broad habitat',
  'Habitat type',
  'Distinctiveness',
  'Condition',
  'Strategic significance'
]
const TARGET_COLUMNS = [
  'Ref',
  'Units',
  'Size',
  'Broad habitat',
  'Habitat type',
  'Distinctiveness',
  'Strategic significance',
  'Target condition',
  'Standard time to target',
  'Advance',
  'Delay',
  'Final time to target',
  'Standard difficulty'
]

// `Post-intervention - created area habitat.gpkg`, per tab, in the ascending
// order AC7 requires. Pinned rather than counted loosely: a partial render is
// exactly the failure a `> 0` check would wave through. The Created tab holds
// the one real Created parcel (H2-7) plus seven parcels the GeoPackage marks
// Lost — a Lost AREA habitat is persisted as Created (BMD-534 PO ruling). Its
// numeric ordering also puts H2-10 after H2-9, not after H2-1.
const RETAINED_REFS = ['H1', 'H2-2']
const ENHANCED_REFS = ['H2-3', 'H3']
const CREATED_REFS = [
  'H2-1',
  'H2-4',
  'H2-5',
  'H2-6',
  'H2-7',
  'H2-8',
  'H2-9',
  'H2-10'
]
const CREATED_ON_GRID_REF = 'H2-7'
const LOST_AS_CREATED_REF = 'H2-1'

// `Post-intervention - all unit and intervention types.gpkg`: parcels plus
// urban trees per tab (33 + 19 Retained, 25 + 24 Enhanced). Its 62 Lost parcels
// become Created; its 17 Lost trees are dropped at import.
const MANY_ROW_COUNTS = { [RETAINED]: 52, [ENHANCED]: 49, [CREATED]: 62 }
const TREE_REF = /^T\d+$/

const detailsHrefPattern = (projectId) =>
  new RegExp(
    `/post-intervention-habitat-details\\?featureId=[^&]+&projectId=${projectId}` +
      `&returnUrl=${encodeURIComponent(`/projects/${projectId}/${PAGE_PATH}`)}$`
  )

const naturalOrder = (refs) =>
  [...refs].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
const hectares = (values) =>
  values.map((value) => Number(value.replace('ha', '')))
const sum = (values) => values.reduce((total, value) => total + value, 0)

async function expectColumn(grid, label, heading, pattern) {
  const values = await grid.columnValues(label, heading)
  // Length-checked as well as matched — a column that returned no cells at all
  // would satisfy the loop vacuously.
  expect(values.length, `${label} ${heading} cells`).toBeGreaterThan(0)
  for (const value of values) {
    expect(value, `${label} ${heading} "${value}"`).toMatch(pattern)
  }
}

/**
 * AC5. The totals row is summed SERVER-SIDE from the unrounded feature values,
 * so it is compared back against the rendered rows with a tolerance: each Units
 * cell is already rounded to 2 dp, and over 50+ rows the rounded cells can sum
 * a few hundredths away from the rounded total.
 */
async function expectTotalsRow(grid, label) {
  await expect(await grid.totalsCell(label, 'Ref')).toHaveText('Total')
  const totalUnits = (
    await (await grid.totalsCell(label, 'Units')).innerText()
  ).trim()
  const totalSize = (
    await (await grid.totalsCell(label, 'Size')).innerText()
  ).trim()
  expect(totalUnits).toMatch(GRID_UNITS_2DP)
  expect(totalSize).toMatch(HECTARES)

  const rowUnits = (await grid.columnValues(label, 'Units')).map(Number)
  expect(Number(totalUnits), `${label} Units total`).toBeCloseTo(
    sum(rowUnits),
    1
  )
  expect(
    Number(totalSize.replace('ha', '')),
    `${label} Size total`
  ).toBeCloseTo(sum(hectares(await grid.columnValues(label, 'Size'))), 4)

  // Every non-numeric column stays empty in the totals row.
  await expect(await grid.totalsCell(label, 'Habitat type')).toHaveText('')
  await expect(
    await grid.totalsCell(label, 'Strategic significance')
  ).toHaveText('')
}

async function expectTargetBlock(row) {
  expect(row.Units).toMatch(GRID_UNITS_2DP)
  expect(row.Size).toMatch(HECTARES)
  expect(row.Distinctiveness).toMatch(LABEL_AND_SCORE)
  expect(row['Strategic significance']).toMatch(LABEL_AND_SCORE)
  expect(row['Target condition']).toMatch(LABEL_AND_SCORE)
  expect(row['Standard time to target']).toMatch(YEARS)
  expect(row.Advance).toMatch(YEARS)
  expect(row.Delay).toMatch(YEARS)
  expect(row['Final time to target']).toMatch(YEARS_AND_SCORE)
  expect(row['Standard difficulty']).toMatch(LABEL_AND_SCORE)
}

test.describe('project-management', { tag: '@project-management' }, () => {
  // Uploads are the slowest step we own and concurrent ones clobber the shared
  // `pendingUploadId` yar key, so the file runs in one worker and each shared
  // project is built once.
  test.describe.configure({
    mode: 'serial',
    timeout: SHARED_BUILD_TEST_TIMEOUT
  })

  // ─── Intervention type grids (BMD-997 AC1-AC10) ──────────────────────────────
  //
  // `area-post-intervention/controller.test.js:239-330` asserts the tabs,
  // columns, rows and totals in markup — with `wreck` mocked and one hand-built
  // feature per tab, so it proves the grid renders `proposed.broadType` IF it
  // arrives, never that a real import emits it. The backend integration suite
  // is the other half of the same gap: `post-intervention-persistence.test.js`
  // asserts only `status` and a numeric `units` per feature (`:64-66`) — none
  // of the `proposed.*` display fields these columns read, no post-intervention
  // urban tree, and no Lost area parcel persisted as Created.
  //
  // Sole witness, do not delete without a replacement: these tests are the
  // only place any suite proves a real uploaded area habitat, a Lost->Created
  // parcel or a post-intervention urban tree reaches this grid. Adding those
  // assertions to post-intervention-persistence.test.js would cover the data
  // half; the rendering half (column wiring, client-side sort, scrolling, the
  // Ref click) stays here regardless. See the Backend coverage proposals in
  // the BMD-997 analysis.

  test.describe(
    'Area post-intervention — intervention type grids',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // Two projects. The three-tab pairing is the only one with a real
      // Created area habitat and calculated Enhanced rows; the all-unit-types
      // pairing is free — `project-summary.spec.js` builds it in the same
      // module-scope cache — and is here for its 50+ rows per tab and its
      // urban trees.
      let project
      let manyRowProject
      test.beforeAll(async ({ browser }) => {
        project = await getAreaInterventionTypesProject(browser)
        manyRowProject = await getAllUnitTypesPostInterventionProject(browser)
      })

      // AC1, AC4a, AC5, AC7 — the only tab with a Condition column and no
      // target/time-to-target block.
      test('the Retained grid lists every retained area habitat with formatted values and a totals row', async ({
        areaPostInterventionPage
      }) => {
        const grid = areaPostInterventionPage
        await grid.open(project.id)

        // Retained is the first visible tab, so it is selected on load.
        await expect(grid.tab(RETAINED)).toHaveAttribute(
          'aria-selected',
          'true'
        )
        await expect(grid.panelHeading(RETAINED)).toBeVisible()

        expect(await grid.columnHeadings(RETAINED)).toEqual(RETAINED_COLUMNS)
        expect(await grid.columnValues(RETAINED, 'Ref')).toEqual(RETAINED_REFS)
        expect(await grid.sortStates(RETAINED)).toEqual(
          RETAINED_COLUMNS.map(() => 'none')
        )

        await expectColumn(grid, RETAINED, 'Units', GRID_UNITS_2DP)
        await expectColumn(grid, RETAINED, 'Size', HECTARES)
        await expectColumn(grid, RETAINED, 'Distinctiveness', LABEL_AND_SCORE)
        await expectColumn(grid, RETAINED, 'Condition', LABEL_AND_SCORE)
        expect(
          new Set(await grid.columnValues(RETAINED, 'Strategic significance'))
        ).toEqual(new Set([FIXED_STRATEGIC_SIGNIFICANCE]))

        // Broad habitat and Habitat type read from the BASELINE record for a
        // Retained feature — pinned to the fixture's values for H1.
        const h1 = await grid.rowByRef(RETAINED, 'H1')
        expect(h1['Broad habitat']).toBe('Urban')
        expect(h1['Habitat type']).toBe('Developed land; sealed surface')

        // AC4's Ref link — only a real import proves the feature has a
        // featureId to put in it; `buildRefCell` renders plain text otherwise.
        for (const reference of RETAINED_REFS) {
          await expect(grid.refLink(RETAINED, reference)).toHaveAttribute(
            'href',
            detailsHrefPattern(project.id)
          )
        }

        await expectTotalsRow(grid, RETAINED)
      })

      // AC2, AC4b, AC5. Both Enhanced parcels improve on their baseline
      // condition, so the engine calculates them and every target/time cell is
      // populated — unlike the linear fixtures' non-uplift Enhanced rows.
      test('the Enhanced grid carries the target and time-to-target columns, populated on calculated rows', async ({
        areaPostInterventionPage
      }) => {
        const grid = areaPostInterventionPage
        await grid.open(project.id)
        await grid.tab(ENHANCED).click()

        await expect(grid.panelHeading(ENHANCED)).toBeVisible()
        await expect(grid.panelHeading(RETAINED)).toBeHidden()
        expect(await grid.columnHeadings(ENHANCED)).toEqual(TARGET_COLUMNS)
        expect(await grid.columnValues(ENHANCED, 'Ref')).toEqual(ENHANCED_REFS)

        for (const reference of ENHANCED_REFS) {
          await expectTargetBlock(await grid.rowByRef(ENHANCED, reference))
        }

        // Read from the PROPOSED record for an Enhanced feature.
        const h23 = await grid.rowByRef(ENHANCED, 'H2-3')
        expect(h23['Broad habitat']).toBe('Grassland')
        expect(h23['Habitat type']).toBe('Other neutral grassland')

        await expectTotalsRow(grid, ENHANCED)
      })

      // AC3, AC4c, AC5. The Created tab here is reached two ways at once: a
      // real Created parcel (H2-7) and Lost parcels the backend persists as
      // Created. The unit test hands the tab a literal 'Created'.
      test('the Created grid carries the same columns, including Lost parcels imported as Created', async ({
        areaPostInterventionPage
      }) => {
        const grid = areaPostInterventionPage
        await grid.open(project.id)
        await grid.tab(CREATED).click()

        await expect(grid.panelHeading(CREATED)).toBeVisible()
        expect(await grid.columnHeadings(CREATED)).toEqual(TARGET_COLUMNS)
        expect(await grid.columnValues(CREATED, 'Ref')).toEqual(CREATED_REFS)

        const created = await grid.rowByRef(CREATED, CREATED_ON_GRID_REF)
        await expectTargetBlock(created)
        expect(created['Broad habitat']).toBe('Lakes')
        expect(created['Habitat type']).toBe('Ponds (non-priority habitat)')

        // A Lost parcel still renders a full row — the shape BMD-534 settled.
        const lost = await grid.rowByRef(CREATED, LOST_AS_CREATED_REF)
        expect(lost.Units).toMatch(GRID_UNITS_2DP)
        expect(lost.Size).toMatch(HECTARES)
        expect(lost['Habitat type']).not.toBe('')

        await expectTotalsRow(grid, CREATED)
      })

      // AC5, AC7 over 50+ rows per tab, and the area-only rule that urban trees
      // join the parcels in the same grid (`collectAreaFeatures`).
      test('many-row grids are ordered by reference, unhighlighted, totalled, and include urban trees', async ({
        areaPostInterventionPage
      }) => {
        const grid = areaPostInterventionPage
        await grid.open(manyRowProject.id)

        for (const label of ALL_TABS) {
          if (label !== RETAINED) {
            await grid.tab(label).click()
          }

          const refs = await grid.columnValues(label, 'Ref')
          expect(refs, `${label} rows`).toHaveLength(MANY_ROW_COUNTS[label])
          // AC7: ascending by ref, compared with numeric collation — the order
          // `sortHabitatFeatures` promises.
          expect(refs).toEqual(naturalOrder(refs))
          expect(
            (await grid.sortStates(label)).every((state) => state === 'none'),
            `${label} aria-sort`
          ).toBe(true)

          await expectTotalsRow(grid, label)
        }

        // Trees reach Retained and Enhanced; Lost trees are dropped, so none
        // reach Created.
        await grid.tab(RETAINED).click()
        const retainedRefs = await grid.columnValues(RETAINED, 'Ref')
        const treeRef = retainedRefs.find((ref) => TREE_REF.test(ref))
        expect(treeRef, 'a tree row in the Retained grid').toBeDefined()
        const tree = await grid.rowByRef(RETAINED, treeRef)
        expect(tree.Units).toMatch(GRID_UNITS_2DP)
        expect(tree.Size).toMatch(HECTARES)
      })

      // AC8 and AC9. The `aria-sort` toggle itself is MOJ's own behaviour; what
      // only this test sees is the resulting row order on THIS grid's
      // `data-sort-value`s, and that the component binds at all on this page.
      test(
        'clicking a column heading re-orders a grid ascending, then descending',
        { tag: '@happy-path' },
        async ({ areaPostInterventionPage }) => {
          const grid = areaPostInterventionPage
          await grid.open(manyRowProject.id)

          const sizeHeader = grid
            .columnHeaders(RETAINED)
            .nth(RETAINED_COLUMNS.indexOf('Size'))
          const sortButton = grid.sortButton(RETAINED, 'Size')

          await sortButton.click()
          await expect(sizeHeader).toHaveAttribute('aria-sort', 'ascending')
          const ascending = hectares(await grid.columnValues(RETAINED, 'Size'))
          expect(ascending).toHaveLength(MANY_ROW_COUNTS[RETAINED])
          expect(ascending).toEqual([...ascending].sort((a, b) => a - b))

          await sortButton.click()
          await expect(sizeHeader).toHaveAttribute('aria-sort', 'descending')
          const descending = hectares(await grid.columnValues(RETAINED, 'Size'))
          expect(descending).toEqual([...descending].sort((a, b) => b - a))

          // Only the clicked column is highlighted — MOJ clears the rest.
          const states = await grid.sortStates(RETAINED)
          expect(states.filter((state) => state !== 'none')).toEqual([
            'descending'
          ])
        }
      )

      // AC6. The unit suite can see the pane in the markup; whether it ever
      // overflows is a layout fact. Run on the 13-column Enhanced grid — the
      // 8-column Retained one is the narrow case.
      test('a thirteen-column grid sits in a pane that overflows horizontally', async ({
        areaPostInterventionPage
      }) => {
        const grid = areaPostInterventionPage
        await grid.open(project.id)
        await grid.tab(ENHANCED).click()

        const { scrollWidth, clientWidth, scrollLeft } =
          await grid.scrollPaneToEnd(ENHANCED)

        expect(scrollWidth).toBeGreaterThan(clientWidth)
        // It moved, so the overflow is scrollable rather than clipped.
        expect(scrollLeft).toBeGreaterThan(0)
      })

      // AC10a, AC10b, AC10c. Asserted once per intervention type because the AC
      // names a different details story per tab (BMD-608 / 725 / 736).
      test(
        'clicking a habitat reference opens that area habitat on the post-intervention details page',
        { tag: '@happy-path' },
        async ({
          page,
          areaPostInterventionPage,
          postInterventionHabitatDetailsPage
        }) => {
          const grid = areaPostInterventionPage

          for (const [label, reference] of [
            [RETAINED, RETAINED_REFS[0]],
            [ENHANCED, ENHANCED_REFS[0]],
            [CREATED, CREATED_ON_GRID_REF]
          ]) {
            await grid.open(project.id)
            if (label !== RETAINED) {
              await grid.tab(label).click()
            }

            await grid.refLink(label, reference).click()

            await expect(page).toHaveURL(detailsHrefPattern(project.id))
            await expect(
              postInterventionHabitatDetailsPage.viewOnlyHeading.first()
            ).toBeVisible()
            // The ref identifies WHICH habitat was opened — without it the
            // assertions above pass on any of them.
            await expect(
              page.getByText(reference, { exact: true }).first()
            ).toBeVisible()
          }
        }
      )
    }
  )
})
