import { test, expect } from '@fixtures'
import { score, unitsTolerance } from '@utils/grid-values.js'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import {
  getAllUnitTypesPostInterventionProject,
  getLongPaddedRefsProject,
  LONG_PADDED_REFS
} from '@utils/summary-projects.js'
import {
  getRunAllUnitTypesPostInterventionProject,
  getRunAreaInterventionTypesProject,
  getRunWatercourseInterventionTypesProject,
  getRunNoRetainedAreaProject,
  getRunRetainedSignificanceProject,
  getRunTreesPostInterventionProject,
  getServiceTemplateAreaSignificanceBlankProject,
  getServiceTemplateCreatedIncompleteProject,
  getServiceTemplateHedgerowInvalidEnhancementProject,
  getServiceTemplateIncompleteEnhancementsProject,
  getServiceTemplateLongRefsProject
} from '@utils/run-projects.js'
import {
  LEGACY_ONLY,
  SERVICE_TEMPLATE_ONLY,
  isServiceTemplateRun
} from '@utils/template-run.js'
import { openPiTabFor } from '@utils/post-intervention-grid.js'
import {
  expectRefCut,
  expectRefTailHidden,
  expectRefWhole,
  gridRefName
} from '@utils/habitat-ref-display.js'
import { uploadFileHref } from '@utils/upload-file-navigation.js'
import {
  BASELINE_AREA_LABEL,
  POST_INTERVENTION_AREA_LABEL,
  SITE_AREA_LABEL
} from '@pages/area-post-intervention.page.js'
import {
  AREA_HABITATS,
  BASELINE_NAV_CHILD,
  HEDGEROWS,
  POST_INTERVENTION_NAV_CHILD,
  REPORTS,
  STATUS_COMPLETE,
  STATUS_INCOMPLETE,
  SUMMARY,
  TILE_BASELINE,
  TILE_NET_PERCENTAGE,
  TILE_TRADING_RULES,
  TRADING_RULES_NAV_CHILD,
  VIEW_ON_SITE_AREA_POST_INTERVENTION,
  VIEW_ON_SITE_POST_INTERVENTION,
  WATERCOURSES
} from '@utils/unit-type-labels.js'

// The area habitats post-intervention page (BMD-858 / BMD-997) —
// `/projects/{id}/area-post-intervention`. See
// test/flows/project-management/area-post-intervention.flow.md.
//
// Two describes: the BMD-858 page furniture (nav, header, tiles, size section,
// tab visibility, upload action) and the BMD-997 grids inside the
// intervention-type tabs. The BMD-1102 Status column describe covers all three
// unit types' post-intervention grids, the way area-baseline.spec.js does for
// the baseline grids.

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
// The shared-build upload budget. It sits on `describe.configure` because the
// build runs in `beforeAll`, where a per-test `setTimeout()` comes too late.
const SHARED_BUILD_TEST_TIMEOUT = 180_000

const PAGE_PATH = 'area-post-intervention'

const TILE_POST_INTERVENTION_WITH_PI = 'On-site post-intervention'
const TILE_NET_UNIT_CHANGE = 'Total on-site net unit change'
// The area summary tile set, in rendered order (BMD-858 AC5).
const RESULTS_TILES = [
  TILE_NET_PERCENTAGE,
  TILE_TRADING_RULES,
  TILE_BASELINE,
  TILE_POST_INTERVENTION_WITH_PI,
  TILE_NET_UNIT_CHANGE
]

// BMD-858 AC6, in rendered order. The ticket's Site Area label omits the
// closing bracket; the page closes it.
const SIZE_TILES = [
  BASELINE_AREA_LABEL,
  POST_INTERVENTION_AREA_LABEL,
  SITE_AREA_LABEL
]
// `formatSummaryAreaSize` — 2 dp, `ha` suffix, no space.
const HECTARES_2DP = /^\d+\.\d{2}ha$/

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
// A time over the metric's 30 years reads "30+ years".
const YEARS = /^\d+\+? years?$/
// "{n} year(s) ({multiplier})" — the Final time to target shape.
const YEARS_AND_SCORE = /^\d+\+? years? \(-?\d+(\.\d+)?\)$/
// Retained features carry their baseline strategic significance, fixed at
// Low (1) for MVS (BMD-315 AC9).
const FIXED_STRATEGIC_SIGNIFICANCE = 'Low (1)'
// BMD-1051. On-site Retained parcels whose file gives a strategic
// significance above Low: in the legacy all-unit-types PI file H046 (High) and
// H002 (Medium); in the BNG Service template's baseline-significance-high.gpkg,
// H002 (High). An Enhanced parcel whose value is Medium (H086, Fairly Good →
// Fairly Good), which only the legacy template offers.
const RETAINED_ON_SITE_NON_LOW_REFS = isServiceTemplateRun()
  ? ['H002']
  : ['H046', 'H002']
const ENHANCED_REJECTED_REF = 'H086'

// Column sets from `buildColumns` in post-intervention-habitat-grid.js, with
// the area page's Broad habitat column inserted after Size. Headings render in
// GOV.UK sentence case where the ticket's AC4 table title-cases "Standard
// Difficulty".
const RETAINED_COLUMNS = [
  'Ref',
  'Status',
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
  'Status',
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

// Each run's three-tab project, its rows per tab in the ascending order AC7
// requires, and a row on each tab with the broad habitat and type it shows.
// Pinned rather than counted loosely: a partial render is exactly the failure
// a `> 0` check would wave through.
//
// Legacy, `Post-intervention - created area habitat.gpkg`. The Created tab
// holds the one real Created parcel (H2-7) plus seven parcels the GeoPackage
// marks Lost — a Lost AREA habitat is persisted as Created (BMD-534 PO
// ruling). Its numeric ordering also puts H2-10 after H2-9, not after H2-1.
// Its many-row project is the all-unit-types pair: parcels plus urban trees
// per tab (33 + 19 Retained, 25 + 24 Enhanced); its 62 Lost parcels become
// Created, and its 17 Lost trees are dropped at import.
//
// BNG Service template, `default-site.gpkg`, for both: each tab lists its
// area habitats, vertical area habitats (V001 Retained, V002 Enhanced, V003
// and V005 Created) and trees together (AC7). H003 is a parcel kept in two
// Retained parts, so its ref appears twice. A habitat the template removes has
// no post-intervention row at all, so nothing reaches the grids as Lost.
const GRID = isServiceTemplateRun()
  ? {
      retainedRefs: [
        'H002',
        'H003',
        'H003',
        'H012',
        'H022',
        'H026',
        'H029',
        'H034',
        'H039',
        'H044',
        'H047',
        'H049',
        'H050',
        'T004',
        'T008',
        'T010',
        'T012',
        'T014',
        'T021',
        'T025',
        'V001'
      ],
      enhancedRefs: [
        'H001',
        'H004',
        'H006',
        'H008',
        'H024',
        'H030',
        'H031',
        'H037',
        'H040',
        'T001',
        'T006',
        'T011',
        'T013',
        'T015',
        'T017',
        'T019',
        'T020',
        'T024',
        'V002'
      ],
      createdRefs: [
        'H005',
        'H007',
        'H009',
        'H010',
        'H011',
        'H013',
        'H014',
        'H015',
        'H016',
        'H017',
        'H018',
        'H019',
        'H020',
        'H021',
        'H023',
        'H025',
        'H027',
        'H028',
        'H032',
        'H033',
        'H035',
        'H036',
        'H038',
        'H041',
        'H042',
        'H043',
        'H045',
        'H046',
        'H048',
        'T005',
        'V003',
        'V005'
      ],
      retained: {
        ref: 'H002',
        broadHabitat: 'Woodland and forest',
        habitatType: 'Other woodland; broadleaved'
      },
      enhanced: {
        ref: 'H001',
        broadHabitat: 'Grassland',
        habitatType: 'Other lowland acid grassland'
      },
      created: {
        ref: 'H005',
        broadHabitat: 'Urban',
        habitatType: 'Allotments'
      },
      lostAsCreatedRef: null,
      manyRowCounts: { [RETAINED]: 21, [ENHANCED]: 19, [CREATED]: 32 }
    }
  : {
      retainedRefs: ['H1', 'H2-2'],
      enhancedRefs: ['H2-3', 'H3'],
      createdRefs: [
        'H2-1',
        'H2-4',
        'H2-5',
        'H2-6',
        'H2-7',
        'H2-8',
        'H2-9',
        'H2-10'
      ],
      retained: {
        ref: 'H1',
        broadHabitat: 'Urban',
        habitatType: 'Developed land; sealed surface'
      },
      enhanced: {
        ref: 'H2-3',
        broadHabitat: 'Grassland',
        habitatType: 'Other neutral grassland'
      },
      created: {
        ref: 'H2-7',
        broadHabitat: 'Lakes',
        habitatType: 'Ponds (non-priority habitat)'
      },
      lostAsCreatedRef: 'H2-1',
      manyRowCounts: { [RETAINED]: 52, [ENHANCED]: 49, [CREATED]: 62 }
    }
// The BNG Service template's default site (AC5): the two strategic
// significances its Enhanced and Created rows carry, its Enhanced trees, and
// the baseline features it removes. A removed habitat or tree has a baseline
// row and no post-intervention one: V004, a demolished structure, and the
// felled trees.
const SERVICE_TEMPLATE_SIGNIFICANCES = ['Low (1)', 'High (1.15)']
const ENHANCED_TREE_REFS = [
  'T001',
  'T006',
  'T011',
  'T013',
  'T015',
  'T017',
  'T019',
  'T020',
  'T024'
]
const ENHANCED_TREE_REF = 'T006'
const REMOVED_REFS = [
  'V004',
  'T002',
  'T003',
  'T007',
  'T009',
  'T016',
  'T018',
  'T022',
  'T023'
]

// Refs that appear once on a tab, so a Ref link finds one row.
const singleRefs = (refs) =>
  refs.filter((ref) => refs.indexOf(ref) === refs.lastIndexOf(ref))
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
// BNG-587 AC1: the fixed area of each individual-tree size band, in hectares,
// on a tree of each band, and how many trees the run's tree project has.
const TREES = isServiceTemplateRun()
  ? {
      // size-and-setting.gpkg: 16 trees, two of each band and setting.
      bands: [
        ['T001', '0.0041'], // Small
        ['T003', '0.0163'], // Medium
        ['T005', '0.0366'], // Large
        ['T007', '0.0765'] // Very large
      ],
      count: 16
    }
  : {
      bands: [
        ['T001', '0.0041'], // Small
        ['T002', '0.0163'], // Medium
        ['T003', '0.0366'], // Large
        ['T004', '0.0765'] // Very large
      ],
      count: 4
    }
// The area-size tiles round to 2dp, so a sum of 4dp grid sizes can differ from
// them by up to one rounding step.
const AREA_TILE_TOLERANCE_HA = 0.01
const STATUS_HEADING = 'Status'

// BMD-1102: the all-unit-types pair's Enhanced rows, one Complete and one
// Incomplete per unit type. The hedgerow grid holds one Complete row (HG018)
// among eight Incomplete ones, so a Status sort that broke ties by reversing
// the ascending order would move the Incomplete refs, not just HG018.
const STATUS_ROWS = {
  area: { complete: 'H004', incomplete: 'H005' },
  hedgerows: { complete: 'HG018', incomplete: 'HG011' },
  watercourses: { complete: 'R007', incomplete: 'R008' }
}
const HEDGEROW_INCOMPLETE_REFS = [
  'HG011',
  'HG012',
  'HG026',
  'HG030',
  'HG031',
  'HG032',
  'HG034',
  'HG040'
]
const HEDGEROW_STATUS_ASCENDING = [
  STATUS_ROWS.hedgerows.complete,
  ...HEDGEROW_INCOMPLETE_REFS
]
const HEDGEROW_STATUS_DESCENDING = [
  ...HEDGEROW_INCOMPLETE_REFS,
  STATUS_ROWS.hedgerows.complete
]

// The BNG Service template's Status rows: a Complete and an Incomplete row on
// one tab of each unit type's grid, each from the project that has them. The
// area habitats of invalid-data-incomplete.gpkg are all Enhanced: H001-H003
// Complete, H004-H006 Incomplete with no proposed condition or strategic
// significance.
const SERVICE_TEMPLATE_STATUS_ROWS = {
  area: { tab: ENHANCED, complete: 'H001', incomplete: 'H004' },
  hedgerows: { tab: ENHANCED, complete: 'HG002', incomplete: 'HG001' },
  watercourses: { tab: CREATED, complete: 'R003', incomplete: 'R005' }
}
// area-created-no-condition-or-timing.gpkg: the default site with H005, one
// of its 32 Created area habitats, saved Incomplete.
const CREATED_INCOMPLETE_REF = 'H005'
// invalid-data-incomplete.gpkg's H004: Enhanced with no Proposed Condition or
// Proposed Strategic Significance.
const ENHANCED_UNPRICED_REF = 'H004'
// area-enhanced-significance-blank.gpkg's H006: Enhanced from Fairly Poor to
// Moderate, with no years in advance or delay, and no Proposed Strategic
// Significance alone.
const SIGNIFICANCE_BLANK_REF = 'H006'
const SIGNIFICANCE_BLANK_KEPT = {
  targetCondition: 'Moderate',
  years: '0 years'
}
// long-and-padded-refs.gpkg: Retained area habitats whose refs, in both
// stages, are longer than 10 characters, and '   H034   ', which the import
// trims.
const SERVICE_TEMPLATE_LONG_REFS = [
  'WOODLAND-NORTH-EDGE',
  'Étang-du-Moulin-Ælfrīc',
  `H050-${'x'.repeat(94)}`
]
const SERVICE_TEMPLATE_PADDED_REF = 'H034'

/** A row's Status tag, found by the row's Ref link and the tag's text. */
function statusTag(grid, label, reference, status) {
  return grid
    .featureRows(label)
    .filter({
      has: grid.page.getByRole('link', { name: reference, exact: true })
    })
    .getByText(status, { exact: true })
}

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

  // ─── Page furniture (BMD-858) ────────────────────────────────────────────────
  //
  // `area-post-intervention/controller.test.js` asserts every element here in
  // markup (`:141` header, `:161` upload, `:174`/`:257` tiles, `:200`/`:230`
  // size, `:268` nav, `:295` tabs) against a mocked `wreck` and hand-built
  // projects. What these hold is the half it cannot see: that this controller
  // feeds them from a real project. AC7a/AC8 live in the BMD-997 grid tests
  // below; AC2a, AC3b and the AC10 click-throughs are witnessed elsewhere —
  // see the flow doc's Journey coverage.

  test.describe(
    'Area post-intervention — page furniture',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // Hedgerows AND watercourses in both documents, so every conditional nav
      // item renders. Already built in the module-scope cache by
      // project-summary.spec.js and the BMD-997 describe below.
      let project
      test.beforeAll(async ({ browser }) => {
        project = await getRunAllUnitTypesPostInterventionProject(browser)
      })

      // AC4 and AC9. The `returnUrl` is built per page from the factory's
      // `config.path`, so the hedgerow page's twin of this assertion does not
      // cover it. Following the button is project-summary.spec.js's job — the
      // destination does not depend on the page, only the returnUrl does.
      test('the header shows the project name, the page heading and an Upload file button returning here', async ({
        areaPostInterventionPage
      }) => {
        await areaPostInterventionPage.open(project.id)

        await expect(
          areaPostInterventionPage.caption(project.name)
        ).toBeVisible()
        await expect(areaPostInterventionPage.heading).toBeVisible()
        await expect(areaPostInterventionPage.uploadFileButton).toHaveAttribute(
          'href',
          uploadFileHref(project.id, `/projects/${project.id}/${PAGE_PATH}`)
        )
      })

      // AC3a, plus AC10's targets as hrefs on THIS page. Following them is
      // left to area-trading-summary.spec.js (Trading rules, clicked from the
      // area summary) and area-summary.spec.js (the rest): the builder takes
      // only the project and the current href, so a click from a sibling area
      // page exercises the same link.
      test('the left navigation marks Post intervention as current and links everything else', async ({
        areaPostInterventionPage
      }) => {
        const nav = areaPostInterventionPage
        await nav.open(project.id)

        // Current page: a <strong aria-current="page">, not a link.
        await expect(nav.navItem(POST_INTERVENTION_NAV_CHILD)).toHaveAttribute(
          'aria-current',
          'page'
        )
        await expect(nav.navLink(POST_INTERVENTION_NAV_CHILD)).toHaveCount(0)

        const projectPage = (path) => `/projects/${project.id}/${path}`
        for (const [label, path] of [
          [SUMMARY, 'project-summary'],
          [AREA_HABITATS, 'area-summary'],
          [BASELINE_NAV_CHILD, 'area-baseline'],
          [TRADING_RULES_NAV_CHILD, 'area-trading-summary'],
          [HEDGEROWS, 'hedgerows-summary'],
          [WATERCOURSES, 'watercourses-summary'],
          [REPORTS, 'reports']
        ]) {
          await expect(nav.navLink(label), label).toHaveAttribute(
            'href',
            projectPage(path)
          )
        }
      })

      // AC5. The tile values are compared with the project summary's, which
      // reads the same backend fields — a mismatch means this controller's
      // own choice (`areaUnits` + `areaInterventionSummary`) points elsewhere.
      // That is how it caught the missing Trading Rules tag fixed by frontend
      // PR#361 (2026-10-06): a heading-only check passed without it.
      test('the results tiles match the project summary, without a link back to this page', async ({
        areaPostInterventionPage,
        projectSummaryPage
      }) => {
        await areaPostInterventionPage.open(project.id)

        await expect(areaPostInterventionPage.resultsHeading).toBeVisible()
        await expect(areaPostInterventionPage.tileHeadings()).toHaveText(
          RESULTS_TILES
        )
        // No self-link, and no inert stand-in for one either: the action line
        // under the post-intervention tile is dropped on this page only.
        const section = areaPostInterventionPage.unitSection()
        await expect(
          section.getByRole('link', {
            name: VIEW_ON_SITE_AREA_POST_INTERVENTION
          })
        ).toHaveCount(0)
        await expect(
          section.getByText(VIEW_ON_SITE_POST_INTERVENTION, { exact: true })
        ).toHaveCount(0)
        // BMD-1025 AC3: the Trading Rules tile DOES link out, to the area
        // trading summary. Built by this page's own controller, so no sibling
        // page's witness covers it.
        await expect(
          areaPostInterventionPage.areaTradingRulesLink()
        ).toHaveAttribute(
          'href',
          `/projects/${project.id}/area-trading-summary`
        )

        const values = {}
        for (const tile of RESULTS_TILES) {
          values[tile] = await areaPostInterventionPage.tileValue(tile)
        }

        await projectSummaryPage.open(project.id)
        for (const tile of RESULTS_TILES) {
          expect(
            await projectSummaryPage.tileValue(AREA_HABITATS, tile),
            tile
          ).toBe(values[tile])
        }
      })

      // AC6. Labels in order, and every value in hectares to 2 dp. The
      // post-intervention and Site Area tiles are reconciled against the grid
      // (trees in, trees out) by the "individual trees (BNG-587)" test below.
      // What is left is the baseline tile — the only figure on this page drawn
      // from `baseline.habitatSizes` — so it is compared with the area
      // baseline page's grid total. A baseline tile wired to the
      // post-intervention document fails here: this project's area differs
      // between the two (53.66ha baseline, 53.14ha post-intervention).
      test('the size section shows baseline, post-intervention and site area in hectares to 2 dp', async ({
        areaPostInterventionPage,
        areaBaselinePage
      }) => {
        await areaPostInterventionPage.open(project.id)

        await expect(areaPostInterventionPage.areaSizeTileLabels()).toHaveText(
          SIZE_TILES
        )
        const sizes = {}
        for (const label of SIZE_TILES) {
          sizes[label] = await areaPostInterventionPage.areaSizeTileValue(label)
          expect(sizes[label], label).toMatch(HECTARES_2DP)
        }

        await areaBaselinePage.open(project.id)
        const [baselineGridTotal] = hectares([
          (await areaBaselinePage.totalsCell('size').innerText()).trim()
        ])
        const [baselineTile] = hectares([sizes[BASELINE_AREA_LABEL]])
        expect(Math.abs(baselineTile - baselineGridTotal)).toBeLessThan(
          AREA_TILE_TOLERANCE_HA
        )
      })

      // AC7b. `visibleInterventionTabs` runs on this page's own area features,
      // so the hedgerow and watercourse pages' tab tests witness none of it.
      // The legacy area gain project has six Enhanced parcels and a Created
      // tree but no Retained area habitat, and the BNG Service template's
      // thirty-plus.gpkg has Enhanced and Created habitats and trees only — the
      // tab set skips Retained AND the default falls to the first VISIBLE tab,
      // which a Retained-led project cannot show.
      test('a tab set with no Retained habitats skips that tab and selects the first visible one', async ({
        browser,
        areaPostInterventionPage
      }) => {
        const gainProject = await getRunNoRetainedAreaProject(browser)
        const grid = areaPostInterventionPage
        await grid.open(gainProject.id)

        await expect(grid.tabs).toHaveText([ENHANCED, CREATED])
        await expect(grid.tab(RETAINED)).toHaveCount(0)
        await expect(grid.tab(ENHANCED)).toHaveAttribute(
          'aria-selected',
          'true'
        )
        await expect(grid.panelHeading(ENHANCED)).toBeVisible()
      })
    }
  )

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
      let retainedSignificanceProject
      test.beforeAll(async ({ browser }) => {
        project = await getRunAreaInterventionTypesProject(browser)
        manyRowProject =
          await getRunAllUnitTypesPostInterventionProject(browser)
        retainedSignificanceProject =
          await getRunRetainedSignificanceProject(browser)
      })

      // AC1, AC4a, AC5, AC7 — the only tab with a Condition column and no
      // target/time-to-target block.
      test('the Retained grid lists every retained area habitat with formatted values and a totals row', async ({
        areaPostInterventionPage
      }) => {
        const grid = areaPostInterventionPage
        await grid.open(project.id)

        // BMD-858 AC7a: all three tabs in display order, Retained — the first
        // visible — selected on load, and the other two still anchors to their
        // panels. A GOV.UK tab's link role is replaced by `tab`, so "is a
        // link" is asserted through `href` and the unselected state.
        await expect(grid.tabs).toHaveText(ALL_TABS)
        await expect(grid.tab(RETAINED)).toHaveAttribute(
          'aria-selected',
          'true'
        )
        await expect(grid.panelHeading(RETAINED)).toBeVisible()
        for (const label of [ENHANCED, CREATED]) {
          await expect(grid.tab(label)).toHaveAttribute(
            'aria-selected',
            'false'
          )
          await expect(grid.tab(label)).toHaveAttribute(
            'href',
            `#${label.toLowerCase()}`
          )
        }

        expect(await grid.columnHeadings(RETAINED)).toEqual(RETAINED_COLUMNS)
        expect(await grid.columnValues(RETAINED, 'Ref')).toEqual(
          GRID.retainedRefs
        )
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
        // Retained feature — pinned to the fixture's values.
        const retained = await grid.rowByRef(RETAINED, GRID.retained.ref)
        expect(retained['Broad habitat']).toBe(GRID.retained.broadHabitat)
        expect(retained['Habitat type']).toBe(GRID.retained.habitatType)

        // AC4's Ref link — only a real import proves the feature has a
        // featureId to put in it; `buildRefCell` renders plain text otherwise.
        for (const reference of singleRefs(GRID.retainedRefs)) {
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

        // BMD-858 AC8: the clicked tab takes selection and focus, and the
        // other two drop back to unselected. GOV.UK Tabs is client-side JS, so
        // no markup test can see this.
        await expect(grid.tab(ENHANCED)).toHaveAttribute(
          'aria-selected',
          'true'
        )
        await expect(grid.tab(ENHANCED)).toBeFocused()
        for (const label of [RETAINED, CREATED]) {
          await expect(grid.tab(label)).toHaveAttribute(
            'aria-selected',
            'false'
          )
        }
        await expect(grid.panelHeading(ENHANCED)).toBeVisible()
        await expect(grid.panelHeading(RETAINED)).toBeHidden()
        expect(await grid.columnHeadings(ENHANCED)).toEqual(TARGET_COLUMNS)
        expect(await grid.columnValues(ENHANCED, 'Ref')).toEqual(
          GRID.enhancedRefs
        )

        for (const reference of GRID.enhancedRefs) {
          await expectTargetBlock(await grid.rowByRef(ENHANCED, reference))
        }

        // Read from the PROPOSED record for an Enhanced feature.
        const enhanced = await grid.rowByRef(ENHANCED, GRID.enhanced.ref)
        expect(enhanced['Broad habitat']).toBe(GRID.enhanced.broadHabitat)
        expect(enhanced['Habitat type']).toBe(GRID.enhanced.habitatType)

        await expectTotalsRow(grid, ENHANCED)
      })

      // AC3, AC4c, AC5. In the legacy run the Created tab is reached two ways
      // at once: a real Created parcel (H2-7) and Lost parcels the backend
      // persists as Created. A BNG Service template habitat is only ever
      // Created as such. The unit test hands the tab a literal 'Created'.
      test(`the Created grid carries the same columns${GRID.lostAsCreatedRef ? ', including Lost parcels imported as Created' : ''}`, async ({
        areaPostInterventionPage
      }) => {
        const grid = areaPostInterventionPage
        await grid.open(project.id)
        await grid.tab(CREATED).click()

        await expect(grid.panelHeading(CREATED)).toBeVisible()
        expect(await grid.columnHeadings(CREATED)).toEqual(TARGET_COLUMNS)
        expect(await grid.columnValues(CREATED, 'Ref')).toEqual(
          GRID.createdRefs
        )

        const created = await grid.rowByRef(CREATED, GRID.created.ref)
        await expectTargetBlock(created)
        expect(created['Broad habitat']).toBe(GRID.created.broadHabitat)
        expect(created['Habitat type']).toBe(GRID.created.habitatType)

        // A Lost parcel still renders a full row — the shape BMD-534 settled.
        if (GRID.lostAsCreatedRef) {
          const lost = await grid.rowByRef(CREATED, GRID.lostAsCreatedRef)
          expect(lost.Units).toMatch(GRID_UNITS_2DP)
          expect(lost.Size).toMatch(HECTARES)
          expect(lost['Habitat type']).not.toBe('')
        }

        await expectTotalsRow(grid, CREATED)
      })

      // BMD-1051 AC2: a Retained feature's strategic significance in the file
      // is ignored and it is priced at Low (×1). The column's "Low (1)" is a
      // frontend constant for Retained rows, so the witness is the arithmetic
      // on ON-SITE parcels (so it holds once spatial risk — stored on import,
      // not yet priced — is applied to off-site ones): H046 carries High and
      // H002 Medium in the legacy all-unit-types file, and H002 High in the
      // BNG Service template's baseline-significance-high.gpkg, which would
      // put their units 15% / 10% above size × distinctiveness × condition.
      //
      // Sole real-data witness: the backend proves it only on built test data
      // (enrich-post-intervention-strategic-significance.test.js:249).
      test('a Retained parcel is priced at Low (×1) whatever strategic significance the file carried', async ({
        areaPostInterventionPage
      }) => {
        const grid = areaPostInterventionPage
        await grid.open(retainedSignificanceProject.id)

        for (const reference of RETAINED_ON_SITE_NON_LOW_REFS) {
          const row = await grid.rowByRef(RETAINED, reference)
          const product =
            Number.parseFloat(row.Size) *
            score(row.Distinctiveness) *
            score(row.Condition)
          expect(Number(row.Units), `${reference} Units`).toBeGreaterThan(0)
          expect(
            Math.abs(Number(row.Units) - product),
            `${reference}: ${row.Units} vs ${row.Size} × ${row.Distinctiveness} × ${row.Condition}`
          ).toBeLessThanOrEqual(unitsTolerance(product))
        }
      })

      // BMD-1051 AC4, backend PR #465: an Enhanced parcel whose Proposed
      // Strategic Significance is Medium is nulled on import. Since BMD-1070
      // (backend PR #498) it is saved with null units and status Incomplete
      // instead of being priced at zero. Since BMD-1046 (frontend PR #532) its
      // Units cell shows 0.00, display only. The hedgerow grid has its own
      // witness; this is the area pricing path's.
      // Legacy only: the BNG Service template offers no Medium.
      test(
        'an Enhanced parcel with a rejected strategic significance is left unpriced',
        { tag: LEGACY_ONLY },
        async ({ areaPostInterventionPage }) => {
          const grid = areaPostInterventionPage
          await grid.open(manyRowProject.id)
          await grid.tab(ENHANCED).click()

          const row = await grid.rowByRef(ENHANCED, ENHANCED_REJECTED_REF)
          expect(row.Units).toBe('0.00')
          expect(row.Distinctiveness).toBe('')
          expect(row['Strategic significance']).toBe('')
          expect(row['Standard difficulty']).toBe('')
        }
      )

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
          expect(refs, `${label} rows`).toHaveLength(GRID.manyRowCounts[label])
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
          expect(ascending).toHaveLength(GRID.manyRowCounts[RETAINED])
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
      // overflows is a layout fact. Run on the 14-column Enhanced grid — the
      // 9-column Retained one is the narrow case.
      test('a fourteen-column grid sits in a pane that overflows horizontally', async ({
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
            [RETAINED, GRID.retained.ref],
            [ENHANCED, GRID.enhanced.ref],
            [CREATED, GRID.created.ref]
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
              page.getByRole('heading', {
                name: new RegExp(`(^|\\s)${reference}$`),
                level: 1
              })
            ).toBeVisible()
          }
        }
      )
    }
  )
  // ─── BNG Service template values (BMD-1088 AC5) ───────────────────────────────
  //
  // What only a BNG Service template project shows on these grids. Its
  // strategic significance is Low or High, the two the template offers (a
  // legacy file could give Medium, which the service rejects, tested above);
  // a tree can be Enhanced; and a habitat the file removes has no
  // post-intervention row at all, rather than a row marked Lost.

  test.describe(
    'Area post-intervention — BNG Service template values',
    { tag: ['@regression', SERVICE_TEMPLATE_ONLY] },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getRunAreaInterventionTypesProject(browser)
      })

      test('Enhanced and Created habitats carry a Low or High strategic significance, and never Medium', async ({
        areaPostInterventionPage
      }) => {
        const grid = areaPostInterventionPage
        await grid.open(project.id)

        const seen = new Set()
        for (const label of [ENHANCED, CREATED]) {
          await grid.tab(label).click()
          const values = await grid.columnValues(
            label,
            'Strategic significance'
          )
          expect(values, `${label} rows`).toHaveLength(
            GRID.manyRowCounts[label]
          )
          for (const value of values) {
            expect(
              SERVICE_TEMPLATE_SIGNIFICANCES,
              `${label} ${value}`
            ).toContain(value)
            seen.add(value)
          }
        }
        // Both, so the High multiplier is shown and priced somewhere.
        expect([...seen].sort()).toEqual(
          [...SERVICE_TEMPLATE_SIGNIFICANCES].sort()
        )
      })

      test('an Enhanced tree is listed on the Enhanced tab with its target values', async ({
        areaPostInterventionPage
      }) => {
        const grid = areaPostInterventionPage
        await grid.open(project.id)
        await grid.tab(ENHANCED).click()

        const trees = (await grid.columnValues(ENHANCED, 'Ref')).filter((ref) =>
          TREE_REF.test(ref)
        )
        expect(trees).toEqual(ENHANCED_TREE_REFS)
        await expectTargetBlock(
          await grid.rowByRef(ENHANCED, ENHANCED_TREE_REF)
        )
      })

      test('a habitat or tree the file removes is on no tab', async ({
        areaPostInterventionPage
      }) => {
        const grid = areaPostInterventionPage
        await grid.open(project.id)

        const listed = []
        for (const label of ALL_TABS) {
          await grid.tab(label).click()
          listed.push(...(await grid.columnValues(label, 'Ref')))
        }
        for (const ref of REMOVED_REFS) {
          expect(listed, ref).not.toContain(ref)
        }
      })
    }
  )

  // ─── Individual trees (BNG-587) ──────────────────────────────────────────────
  //
  // Moved from the post-intervention habitat list, which BMD-1043 (frontend
  // PR#352) removed. The tree fixture is paired with a baseline, because a
  // project without one is redirected off this page. The Lost-tree exclusion
  // is covered by the many-row grid test above; per-tree size bands and the
  // tree-inclusive / tree-exclusive area tiles had no other witness.

  test.describe(
    'Area post-intervention — individual trees (BNG-587)',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getRunTreesPostInterventionProject(browser)
      })

      test('AC1/AC3 — each individual tree shows the area for its size band and a calculated unit value', async ({
        page
      }) => {
        for (const [ref, area] of TREES.bands) {
          const { unitPage, label } = await openPiTabFor(
            page,
            project.id,
            'area',
            ref
          )
          const row = await unitPage.rowByRef(label, ref)
          expect(row.Size, `${ref} size`).toBe(`${area}ha`)
          expect(row.Units, `${ref} units`).toMatch(GRID_UNITS_2DP)
          expect(Number(row.Units), `${ref} units`).toBeGreaterThan(0)
        }
      })

      test('AC5/AC6 — the post intervention area includes the trees and the Site Area excludes them', async ({
        areaPostInterventionPage
      }) => {
        await areaPostInterventionPage.open(project.id)
        const [postInterventionArea, siteArea] = hectares([
          await areaPostInterventionPage.areaSizeTileValue(
            POST_INTERVENTION_AREA_LABEL
          ),
          await areaPostInterventionPage.areaSizeTileValue(SITE_AREA_LABEL)
        ])

        // Sum every grid row, and the tree rows on their own, across the tabs.
        const gridSizes = []
        const treeSizes = []
        for (const label of ALL_TABS) {
          if ((await areaPostInterventionPage.tab(label).count()) === 0) {
            continue
          }
          await areaPostInterventionPage.tab(label).click()
          const refs = await areaPostInterventionPage.columnValues(label, 'Ref')
          const sizes = hectares(
            await areaPostInterventionPage.columnValues(label, 'Size')
          )
          gridSizes.push(...sizes)
          treeSizes.push(...sizes.filter((_, i) => TREE_REF.test(refs[i])))
        }
        expect(treeSizes).toHaveLength(TREES.count)

        // AC5: the area tile is the tree-inclusive grid total.
        expect(Math.abs(postInterventionArea - sum(gridSizes))).toBeLessThan(
          AREA_TILE_TOLERANCE_HA
        )
        // AC6: the Site Area drops exactly the tree hectares.
        expect(siteArea).toBeLessThan(postInterventionArea)
        expect(
          Math.abs(postInterventionArea - siteArea - sum(treeSizes))
        ).toBeLessThan(AREA_TILE_TOLERANCE_HA)
      })
    }
  )

  // BMD-1102. The Status column on real uploaded data. The frontend renders it
  // only from hand-built features (post-intervention-habitat-grid.test.js:246,
  // area-post-intervention/controller.test.js:663) and sorts it in jsdom
  // (habitat-details-sortable-table.test.js:58,66). The backend stores the
  // status on upload (import-combinations.test.js:154,168) but never renders
  // it. The heading order and the unhighlighted default are asserted by the
  // grid tests above and in the hedgerow and watercourse specs.
  test.describe(
    'Post-intervention grids — Status column',
    // The BNG Service template run reads its own files' rows, below.
    { tag: ['@regression', LEGACY_ONLY] },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getAllUnitTypesPostInterventionProject(browser)
      })

      // AC2, AC3 and AC4. Sole witness that the status saved on upload
      // reaches a post-intervention grid as its tag, for each unit type.
      // Deleting it leaves the tags proven only against made-up features.
      test('each grid tags a Complete row grey and an Incomplete row blue, with no status in the totals', async ({
        areaPostInterventionPage,
        hedgerowsPostInterventionPage,
        watercoursesPostInterventionPage
      }) => {
        const grids = [
          [areaPostInterventionPage, STATUS_ROWS.area],
          [hedgerowsPostInterventionPage, STATUS_ROWS.hedgerows],
          [watercoursesPostInterventionPage, STATUS_ROWS.watercourses]
        ]
        for (const [grid, refs] of grids) {
          await grid.open(project.id)
          await grid.tab(ENHANCED).click()

          await expect(
            statusTag(grid, ENHANCED, refs.complete, STATUS_COMPLETE)
          ).toHaveClass(/govuk-tag--grey/)
          await expect(
            statusTag(grid, ENHANCED, refs.incomplete, STATUS_INCOMPLETE)
          ).toHaveClass(/govuk-tag--blue/)
          await expect(
            await grid.totalsCell(ENHANCED, STATUS_HEADING)
          ).toHaveText('')
        }
      })

      // AC5 and AC6. Sole witness that a post-intervention grid, sitting in a
      // tab panel, is bound to the tie-by-Ref Status sort: the jsdom tests
      // drive the class on a hand-built table, and area-baseline.spec.js only
      // sorts the baseline grids.
      test('clicking Status sorts Complete first, then Incomplete first, with ties in Ref order', async ({
        hedgerowsPostInterventionPage
      }) => {
        const grid = hedgerowsPostInterventionPage
        await grid.open(project.id)
        const retainedRefs = await grid.columnValues(RETAINED, 'Ref')
        await grid.tab(ENHANCED).click()

        const statusHeader = grid
          .columnHeaders(ENHANCED)
          .nth(await grid.columnIndex(ENHANCED, STATUS_HEADING))
        const sortButton = grid.sortButton(ENHANCED, STATUS_HEADING)

        await sortButton.click()
        await expect(statusHeader).toHaveAttribute('aria-sort', 'ascending')
        expect(await grid.columnValues(ENHANCED, 'Ref')).toEqual(
          HEDGEROW_STATUS_ASCENDING
        )

        await sortButton.click()
        await expect(statusHeader).toHaveAttribute('aria-sort', 'descending')
        expect(await grid.columnValues(ENHANCED, 'Ref')).toEqual(
          HEDGEROW_STATUS_DESCENDING
        )
        await expect(
          grid.table(ENHANCED).getByRole('row').last()
        ).toContainText('Total')

        // The other tabs' grids are not re-sorted.
        await grid.tab(RETAINED).click()
        expect(await grid.columnValues(RETAINED, 'Ref')).toEqual(retainedRefs)
      })
    }
  )

  // The Status column in the BNG Service template run. Its corpus has no
  // project with a Complete and an Incomplete row on one tab of every grid, so
  // each grid is read on the project that has them: an Enhanced parcel or
  // hedgerow the import left unpriced, and the default site's Created R005.
  test.describe(
    'Post-intervention grids — BNG Service template Status column',
    { tag: ['@regression', SERVICE_TEMPLATE_ONLY] },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let areaProject
      let createdIncompleteProject
      let hedgerowProject
      let watercourseProject
      test.beforeAll(async ({ browser }) => {
        createdIncompleteProject =
          await getServiceTemplateCreatedIncompleteProject(browser)
        areaProject =
          await getServiceTemplateIncompleteEnhancementsProject(browser)
        hedgerowProject =
          await getServiceTemplateHedgerowInvalidEnhancementProject(browser)
        watercourseProject =
          await getRunWatercourseInterventionTypesProject(browser)
      })

      test('each grid tags a Complete row grey and an Incomplete row blue, with no status in the totals', async ({
        areaPostInterventionPage,
        hedgerowsPostInterventionPage,
        watercoursesPostInterventionPage
      }) => {
        const grids = [
          [
            areaPostInterventionPage,
            areaProject,
            SERVICE_TEMPLATE_STATUS_ROWS.area
          ],
          [
            hedgerowsPostInterventionPage,
            hedgerowProject,
            SERVICE_TEMPLATE_STATUS_ROWS.hedgerows
          ],
          [
            watercoursesPostInterventionPage,
            watercourseProject,
            SERVICE_TEMPLATE_STATUS_ROWS.watercourses
          ]
        ]
        for (const [grid, project, { tab, complete, incomplete }] of grids) {
          await grid.open(project.id)
          await grid.tab(tab).click()

          await expect(
            statusTag(grid, tab, complete, STATUS_COMPLETE)
          ).toHaveClass(/govuk-tag--grey/)
          await expect(
            statusTag(grid, tab, incomplete, STATUS_INCOMPLETE)
          ).toHaveClass(/govuk-tag--blue/)
          await expect(await grid.totalsCell(tab, STATUS_HEADING)).toHaveText(
            ''
          )
        }
      })

      // The default site's Created tab, with H005 its one Incomplete row: the
      // 31 Complete rows tie, so a descending sort that reversed the ascending
      // one would list them backwards. The Retained tab, sorted by nobody,
      // must keep its order.
      test('clicking Status sorts Complete first, then Incomplete first, with ties in Ref order', async ({
        areaPostInterventionPage
      }) => {
        const grid = areaPostInterventionPage
        await grid.open(createdIncompleteProject.id)
        const retainedRefs = await grid.columnValues(RETAINED, 'Ref')
        expect(retainedRefs.length).toBeGreaterThan(1)
        await grid.tab(CREATED).click()
        const complete = (await grid.columnValues(CREATED, 'Ref')).filter(
          (ref) => ref !== CREATED_INCOMPLETE_REF
        )
        expect(complete.length).toBeGreaterThan(1)

        const statusHeader = grid
          .columnHeaders(CREATED)
          .nth(await grid.columnIndex(CREATED, STATUS_HEADING))
        const sortButton = grid.sortButton(CREATED, STATUS_HEADING)

        await sortButton.click()
        await expect(statusHeader).toHaveAttribute('aria-sort', 'ascending')
        expect(await grid.columnValues(CREATED, 'Ref')).toEqual([
          ...complete,
          CREATED_INCOMPLETE_REF
        ])

        await sortButton.click()
        await expect(statusHeader).toHaveAttribute('aria-sort', 'descending')
        expect(await grid.columnValues(CREATED, 'Ref')).toEqual([
          CREATED_INCOMPLETE_REF,
          ...complete
        ])
        await expect(grid.table(CREATED).getByRole('row').last()).toContainText(
          'Total'
        )

        // The other tabs' grids are not re-sorted.
        await grid.tab(RETAINED).click()
        expect(await grid.columnValues(RETAINED, 'Ref')).toEqual(retainedRefs)
      })

      // The nearest the BNG Service template comes to a rejected strategic
      // significance: it offers no Medium, but a file can leave an
      // enhancement's proposed condition and strategic significance blank.
      // The import saves the parcel Incomplete with null units, which the grid
      // shows as 0.00, display only, with no value the engine would derive.
      test('an Enhanced parcel with no proposed condition or strategic significance is left unpriced', async ({
        areaPostInterventionPage
      }) => {
        const grid = areaPostInterventionPage
        await grid.open(areaProject.id)
        await grid.tab(ENHANCED).click()

        const row = await grid.rowByRef(ENHANCED, ENHANCED_UNPRICED_REF)
        expect(row.Units).toBe('0.00')
        expect(row.Distinctiveness).toBe('')
        expect(row['Strategic significance']).toBe('')
        expect(row['Target condition']).toBe('')
        expect(row['Standard difficulty']).toBe('')
      })

      // A strategic significance missing on its own: the condition is valid,
      // so only the missing significance can leave the parcel unpriced. The
      // grid shows the condition the file gives, with no score, since nothing
      // was priced.
      test('an Enhanced parcel with only its proposed strategic significance blank is left unpriced, keeping its condition', async ({
        browser,
        areaPostInterventionPage
      }) => {
        const blankProject =
          await getServiceTemplateAreaSignificanceBlankProject(browser)
        const grid = areaPostInterventionPage
        await grid.open(blankProject.id)
        await grid.tab(ENHANCED).click()

        const row = await grid.rowByRef(ENHANCED, SIGNIFICANCE_BLANK_REF)
        expect(row.Units).toBe('0.00')
        expect(row.Status).toBe(STATUS_INCOMPLETE)
        expect(row['Strategic significance']).toBe('')
        expect(row['Target condition']).toBe(
          SIGNIFICANCE_BLANK_KEPT.targetCondition
        )
        expect(row.Advance).toBe(SIGNIFICANCE_BLANK_KEPT.years)
        expect(row.Delay).toBe(SIGNIFICANCE_BLANK_KEPT.years)
        expect(row.Distinctiveness).toBe('')
        expect(row['Standard difficulty']).toBe('')
      })
    }
  )

  // BMD-1058 AC6. Post-intervention refs reach this grid from their own backend
  // path (extract-post-intervention.js), and no frontend unit test covers the
  // cut on the post-intervention grids. ' Café–Ω H003' in the file is 11
  // characters once trimmed, so the grid shows 'Café–Ω H00…'.
  test.describe(
    'Area post-intervention — long references',
    // The long and padded refs are cut into a legacy file by
    // fixture-mutations.py; the BNG Service template corpus has none yet.
    { tag: ['@regression', LEGACY_ONLY] },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getLongPaddedRefsProject(browser)
      })

      test('shows only the first 10 characters of a longer ref', async ({
        areaPostInterventionPage
      }) => {
        await areaPostInterventionPage.open(project.id)
        await areaPostInterventionPage.tab(RETAINED).click()

        await expectRefCut(
          areaPostInterventionPage.refLink(
            RETAINED,
            gridRefName(LONG_PADDED_REFS.nonAscii)
          ),
          LONG_PADDED_REFS.nonAscii
        )
        await expectRefWhole(
          areaPostInterventionPage.refLink(RETAINED, LONG_PADDED_REFS.padded),
          LONG_PADDED_REFS.padded
        )
      })
    }
  )

  test.describe(
    'Area post-intervention — BNG Service template long references',
    { tag: ['@regression', SERVICE_TEMPLATE_ONLY] },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getServiceTemplateLongRefsProject(browser)
      })

      test('shows only the first 10 characters of a longer ref', async ({
        areaPostInterventionPage
      }) => {
        await areaPostInterventionPage.open(project.id)
        await areaPostInterventionPage.tab(RETAINED).click()

        for (const ref of SERVICE_TEMPLATE_LONG_REFS) {
          const link = areaPostInterventionPage.refLink(
            RETAINED,
            gridRefName(ref)
          )
          await expectRefCut(link, ref)
          await expectRefTailHidden(link, ref)
        }
        await expectRefWhole(
          areaPostInterventionPage.refLink(
            RETAINED,
            SERVICE_TEMPLATE_PADDED_REF
          ),
          SERVICE_TEMPLATE_PADDED_REF
        )
      })
    }
  )
})
