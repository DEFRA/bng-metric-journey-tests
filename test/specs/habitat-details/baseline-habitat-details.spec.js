import { test, expect } from '@fixtures'
import {
  STORAGE_STATE,
  NO_ROLE_STORAGE_STATE,
  skipInE2e,
  runMode
} from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'
import { AreaBaselinePage } from '@pages/area-baseline.page.js'
import { HedgerowsBaselinePage } from '@pages/hedgerows-baseline.page.js'
import { WatercoursesBaselinePage } from '@pages/watercourses-baseline.page.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
// The edit/save describes each run their own real-CDP upload; under e2e load the
// real uploader can exceed the frontend's 120s polling budget (MAX_WAIT_SECONDS),
// which is an environment/timing flake, not a functional failure. Full coverage
// runs in github (stub uploader); skip these in e2e to keep the daily run green.
const E2E_UPLOAD_SKIP_REASON =
  'Real CDP upload exceeds the frontend 120s budget under e2e load — covered in github (stub uploader)'
const HTTP_OK = 200
const HTTP_BAD_REQUEST = 400
const HTTP_NOT_FOUND = 404
const STUB_UUID = '00000000-0000-0000-0000-000000000000'
const VALID_UUID_V4 = 'aaaaaaaa-bbbb-4ccc-bddd-eeeeeeeeeeee'
const STUB_HABITAT_TYPE = 'Grassland - Modified grassland'
const STUB_HEDGEROW_HABITAT_TYPE = 'Native hedgerow'
const STUB_WATERCOURSE_HABITAT_TYPE = 'Ditches'
// Culvert handling (BMD-597): culverts carry a single "N/A - Culvert" value on
// both encroachment dropdowns; every other watercourse type excludes it and
// shows the graded options (engine order).
const CULVERT_TYPE = 'Culvert'
const CULVERT_ENCROACHMENT = 'N/A - Culvert'
const WATERCOURSE_ENCROACHMENT_PLACEHOLDER = 'Choose watercourse encroachment'
const RIPARIAN_ENCROACHMENT_PLACEHOLDER = 'Choose riparian encroachment'
const NON_CULVERT_WATERCOURSE_ENCROACHMENTS = [
  'No Encroachment',
  'Minor',
  'Major'
]
const NON_CULVERT_RIPARIAN_ENCROACHMENTS = [
  'Major/Major',
  'Major/Moderate',
  'Major/Minor',
  'Major/No Encroachment',
  'Moderate/Moderate',
  'Moderate/Minor',
  'Moderate/No Encroachment',
  'Minor/Minor',
  'Minor/No Encroachment',
  'No Encroachment/No Encroachment'
]
// Distinctiveness scope (BMD-597): the Habitat type dropdown is filtered to
// the in-scope V.Low/Low/Medium bands; High/V.High engine types are excluded
// (bng-metric-engine/src/reference/watercourse-distinctiveness-categories.json).
const OUT_OF_SCOPE_WATERCOURSE_TYPES = [
  'Priority habitat',
  'Other rivers and streams'
]
const IN_SCOPE_WATERCOURSE_TYPES = ['Canals', 'Culvert', 'Ditches']
const COMPLETE_BASELINE_FILE = 'Baseline - complete with area refs.gpkg'
const PROJECT_LABEL = 'Habitat details test'

// BMD-1043 (frontend PR#352) removed the baseline habitat list. Each feature
// type's grid now lives on its own unit-type baseline page, and that page is
// where the details page's Back, Cancel and Save all lead. Column indexes follow
// buildBaselineHabitatGrid: ref, units, size, [broad habitat — area only],
// habitat type, distinctiveness, condition, strategic significance. The grid
// has no Status column, so Complete/Incomplete is not observable there.
const BASELINE_PAGES = {
  area: {
    path: 'area-baseline',
    Page: AreaBaselinePage,
    columns: { units: 1, size: 2, distinctiveness: 5, condition: 6 }
  },
  hedgerow: {
    path: 'hedgerows-baseline',
    Page: HedgerowsBaselinePage,
    columns: { units: 1, size: 2, distinctiveness: 4, condition: 5 }
  },
  watercourse: {
    path: 'watercourses-baseline-summary',
    Page: WatercoursesBaselinePage,
    columns: { units: 1, size: 2, distinctiveness: 4, condition: 5 }
  }
}

function baselinePagePath(projectId, type) {
  return `/projects/${projectId}/${BASELINE_PAGES[type].path}`
}

// Anchored so `area-baseline` cannot match a longer path.
function baselinePageUrl(projectId, type) {
  return new RegExp(`${baselinePagePath(projectId, type)}(?:[?#]|$)`)
}

function baselineGridPage(page, type) {
  return new BASELINE_PAGES[type].Page(page)
}

async function openBaselineGrid(page, projectId, type) {
  await page.goto(baselinePagePath(projectId, type))
  return baselineGridPage(page, type)
}

function gridRow(page, type, ref) {
  return baselineGridPage(page, type)
    .featureRows()
    .filter({ has: page.getByRole('link', { name: ref, exact: true }) })
}

function gridCell(page, type, ref, column) {
  return gridRow(page, type, ref)
    .locator('td')
    .nth(BASELINE_PAGES[type].columns[column])
}

// The grid renders condition as label and score — "Good (3)" — where the
// details page's select holds the bare label.
function gridConditionPattern(condition) {
  const escaped = condition.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escaped} \\([\\d.]+\\)$`)
}

function gridUnitsTotal(page, type) {
  return baselineGridPage(page, type).totalsCell('units')
}

// Habitat units render to two decimal places (formatHabitatUnits); a saved
// (Complete) habitat shows a non-empty value, an Incomplete habitat shows 0.00.
const HABITAT_UNITS_PATTERN = /^\d+\.\d{2}$/
const ZERO_UNITS = '0.00'

// Distinctiveness renders the band abbreviated (e.g. "V.Low") followed by its
// score in brackets.
const DISTINCTIVENESS_PATTERN =
  /^(V\.High|High|Medium|Low|V\.Low) \(\d+(\.\d+)?\)$/

async function uploadAndGetProject(
  createProjectFlow,
  projectDashboardPage,
  uploadBaselineFileFlow
) {
  const project = await setupProject(
    createProjectFlow,
    projectDashboardPage,
    PROJECT_LABEL
  )
  await uploadBaselineFileFlow.uploadFileAndWaitForSummary(
    project.id,
    COMPLETE_BASELINE_FILE
  )
  return project
}

async function uploadAndGetProjectId(...args) {
  const { id } = await uploadAndGetProject(...args)
  return id
}

async function refAndFeatureIdFromLink(link) {
  const href = await link.getAttribute('href')
  return {
    ref: (await link.textContent()).trim(),
    featureId: new URL(href, 'http://localhost').searchParams.get('featureId')
  }
}

async function firstGridFeature(page, projectId, type) {
  const grid = await openBaselineGrid(page, projectId, type)
  return refAndFeatureIdFromLink(grid.table().getByRole('link').first())
}

function conditionsProxyUrl(habitatType, featureType) {
  let url = `/api/reference/conditions?habitatType=${encodeURIComponent(habitatType)}`
  if (featureType) {
    url += `&featureType=${featureType}`
  }
  return url
}

async function expectConditionsProxyOk(page, habitatType, featureType) {
  const response = await page.goto(conditionsProxyUrl(habitatType, featureType))
  expect(response.status()).toBe(HTTP_OK)
  const body = await response.json()
  expect(Array.isArray(body)).toBe(true)
  expect(body.length).toBeGreaterThan(0)
}

async function optionTexts(select) {
  return (await select.getByRole('option').allTextContents()).map((t) =>
    t.trim()
  )
}

function isSortedAscending(values) {
  const sorted = [...values].sort((a, b) => a.localeCompare(b))
  return JSON.stringify(values) === JSON.stringify(sorted)
}

// Condition option text is "Label (score)" — pull the trailing bracketed score.
function conditionScores(texts) {
  return texts
    .map((t) => t.match(/\(([\d.]+)\)\s*$/))
    .filter(Boolean)
    .map((m) => Number(m[1]))
}

async function expectConditionOptionsOrderedByScore(conditionSelect) {
  const texts = await optionTexts(conditionSelect)
  expect(texts[0]).toBe('Choose condition')
  const scores = conditionScores(texts.slice(1))
  expect(scores.length).toBeGreaterThan(0)
  expect(scores).toEqual([...scores].sort((a, b) => b - a))
}

async function expectDerivedValuesHidden(detailsPage) {
  await expect(detailsPage.distinctivenessDisplay).toHaveText('')
  await expect(detailsPage.tradingRuleDisplay).toHaveText('')
}

// Read every linked row of a baseline grid. A linear size cell carries a "km"
// suffix ("0.123km") that the details page drops under its "Length (km)" label,
// so strip it to compare like-for-like; area size reads "1.36ha" on both.
async function readGridFeatures(page, projectId, type) {
  const grid = await openBaselineGrid(page, projectId, type)
  const { columns } = BASELINE_PAGES[type]
  const features = []
  for (const row of await grid.featureRows().all()) {
    const link = row.getByRole('link').first()
    if ((await link.count()) === 0) {
      continue
    }
    const cells = row.locator('td')
    const text = async (column) =>
      (await cells.nth(columns[column]).textContent()).trim()
    features.push({
      ...(await refAndFeatureIdFromLink(link)),
      size: (await text('size')).replace(/km$/, ''),
      distinctiveness: await text('distinctiveness'),
      condition: await text('condition')
    })
  }
  return features
}

// Pick the first area habitat above V.Low distinctiveness so the content ACs
// exercise a fully-populated habitat (real broad/type/condition data); fall
// back to the first area habitat.
async function pickRichAreaHabitat(page, projectId) {
  const features = await readGridFeatures(page, projectId, 'area')
  const { ref, featureId, size } =
    features.find(
      (f) => f.distinctiveness && !f.distinctiveness.startsWith('V.Low')
    ) ?? features[0]
  return { ref, featureId, size }
}

// Pick a linear feature (hedgerow or watercourse) for the content ACs,
// preferring one with a saved condition so AC8a's "selected" value can be
// verified; fall back to the first.
async function pickLinearFeature(page, projectId, type) {
  const features = await readGridFeatures(page, projectId, type)
  const { ref, featureId, size } =
    features.find((f) => f.condition) ?? features[0]
  return { ref, featureId, length: size }
}

// Some area habitats (e.g. the baseline's "N/A - Other" type) have a single
// condition option, so once the saved condition is pre-selected there is no
// alternative to choose. Walk the area habitats and return the first one that
// offers an alternative condition, so the edit-and-persist path can run. Hrefs
// are collected up front because opening each detail page navigates away from
// the grid.
async function findEditableAreaHabitat(
  page,
  baselineHabitatDetailsPage,
  projectId
) {
  const habitats = (await readGridFeatures(page, projectId, 'area')).filter(
    (habitat) => habitat.featureId
  )

  for (const habitat of habitats) {
    await baselineHabitatDetailsPage.open(projectId, habitat.featureId)
    const conditions = (
      await baselineHabitatDetailsPage.conditionOptionValues()
    ).filter(Boolean)
    if (conditions.length >= 2) {
      return habitat
    }
  }
  throw new Error('No area habitat with multiple condition options found')
}

// The read-only display / content-AC describes don't mutate the baseline, so
// they share a single uploaded project (and its picked area / hedgerow /
// watercourse features) rather than each running a fresh real-CDP upload. Those
// per-describe uploads were the bottleneck: in e2e they overload the shared CDP
// uploader and individual uploads tip past the frontend's 120 s budget. Edit /
// save describes still upload their own project so their mutations stay isolated.
//
// Memoised per worker: the first read-only test pays the upload + picks; the
// rest reuse the returned ids. A failed build is not cached, so a transient
// upload failure can retry on the next caller.
let sharedBaselinePromise = null

function getSharedBaseline(deps) {
  if (!sharedBaselinePromise) {
    sharedBaselinePromise = buildSharedBaseline(deps).catch((err) => {
      sharedBaselinePromise = null
      throw err
    })
  }
  return sharedBaselinePromise
}

async function buildSharedBaseline({
  createProjectFlow,
  projectDashboardPage,
  uploadBaselineFileFlow,
  page
}) {
  const project = await uploadAndGetProject(
    createProjectFlow,
    projectDashboardPage,
    uploadBaselineFileFlow
  )
  const area = await pickRichAreaHabitat(page, project.id)
  const hedgerow = await pickLinearFeature(page, project.id, 'hedgerow')
  const watercourse = await pickLinearFeature(page, project.id, 'watercourse')
  return { id: project.id, name: project.name, area, hedgerow, watercourse }
}

async function expectBackAndCancelReturnToBaseline(
  page,
  detailsPage,
  { projectId, featureId, type }
) {
  for (const link of [detailsPage.backLink, detailsPage.cancelLink]) {
    await detailsPage.open(projectId, featureId)
    await link.click()
    await expect(page).toHaveURL(baselinePageUrl(projectId, type))
    await expect(baselineGridPage(page, type).table()).toBeVisible()
  }
}

test.describe('habitat-details', { tag: '@habitat-details' }, () => {
  // ─── Query parameter validation ───────────────────────────────────────────────

  test.describe(
    'Baseline habitat details — query parameter validation',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // Four route-level Joi rejections, merged into one test — each is a bare
      // goto + status check with no shared setup, so running them separately
      // bought nothing. The featureId cases are also unit-tested
      // (../bng-metric-frontend/src/server/baseline-habitat-details/controller.test.js,
      // "#baselineHabitatDetails - validation"); the projectId cases are not,
      // so all four are asserted here.
      test('missing or non-UUID projectId/featureId query params return 400', async ({
        page
      }) => {
        const badUrls = [
          `/baseline-habitat-details?projectId=${STUB_UUID}`,
          `/baseline-habitat-details?featureId=${STUB_UUID}`,
          `/baseline-habitat-details?projectId=${STUB_UUID}&featureId=not-a-uuid`,
          `/baseline-habitat-details?projectId=not-a-uuid&featureId=${STUB_UUID}`
        ]

        for (const url of badUrls) {
          const response = await page.goto(url)
          expect(response.status(), url).toBe(HTTP_BAD_REQUEST)
        }
      })
    }
  )

  // ─── Habitat not found ───────────────────────────────────────────────────────

  test.describe(
    'Baseline habitat details — habitat not found',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('valid UUIDs for non-existent habitat returns 404', async ({
        page
      }) => {
        const response = await page.goto(
          `/baseline-habitat-details?projectId=${VALID_UUID_V4}&featureId=${VALID_UUID_V4}`
        )
        expect(response.status()).toBe(HTTP_NOT_FOUND)
      })
    }
  )

  // ─── Watercourse viewable ─────────────────────────────────────────────────────

  test.describe(
    'Baseline habitat details — watercourse viewable',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test(
        'navigating to a watercourse feature renders the details page',
        { tag: ['@happy-path'] },
        async ({
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow,
          baselineHabitatDetailsPage,
          page
        }) => {
          const shared = await getSharedBaseline({
            createProjectFlow,
            projectDashboardPage,
            uploadBaselineFileFlow,
            page
          })

          // BMD-502 registered the watercourse strategy, so the page now renders
          // (200) instead of throwing in the strategy lookup (500). Watercourse
          // editing/saving remains unsupported (the backend rejects the PUT).
          const response = await page.goto(
            `/baseline-habitat-details?projectId=${shared.id}&featureId=${shared.watercourse.featureId}`
          )
          expect(response.status()).toBe(HTTP_OK)
          await expect(
            baselineHabitatDetailsPage.baselineDetailsHeading
          ).toBeVisible()
        }
      )
    }
  )

  // ─── Role enforcement ────────────────────────────────────────────────────────

  test.describe('Baseline habitat details — role enforcement', () => {
    test.use({ storageState: NO_ROLE_STORAGE_STATE })
    test.skip(skipInE2e(NO_ROLE_STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'authenticated user without BNG Completer role is redirected to /auth/forbidden',
      { tag: '@smoke' },
      async ({ page }) => {
        await page.goto(
          `/baseline-habitat-details?projectId=${STUB_UUID}&featureId=${STUB_UUID}`
        )
        await expect(page).toHaveURL(/\/auth\/forbidden/)
      }
    )
  })

  // ─── Unauthenticated access ──────────────────────────────────────────────────

  test.describe('Baseline habitat details — unauthenticated access', () => {
    test(
      'GET /baseline-habitat-details redirects to sign-in',
      { tag: '@smoke' },
      async ({ page }) => {
        await page.goto(
          `/baseline-habitat-details?projectId=${STUB_UUID}&featureId=${STUB_UUID}`
        )
        await expect(page).not.toHaveURL(/\/baseline-habitat-details/)
        await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
      }
    )
  })

  // ─── Conditions proxy — query parameter validation ───────────────────────────

  test.describe(
    'Conditions proxy — query parameter validation',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('missing habitatType query param returns 400', async ({ page }) => {
        const response = await page.goto('/api/reference/conditions')
        expect(response.status()).toBe(HTTP_BAD_REQUEST)
      })
    }
  )

  // ─── Conditions proxy — happy path ───────────────────────────────────────────

  test.describe('Conditions proxy — happy path', { tag: '@regression' }, () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    test('valid habitatType returns 200 with condition options', async ({
      page
    }) => {
      await expectConditionsProxyOk(page, STUB_HABITAT_TYPE)
    })

    test('valid hedgerow habitatType with featureType=hedgerow returns 200 with condition options', async ({
      page
    }) => {
      await expectConditionsProxyOk(
        page,
        STUB_HEDGEROW_HABITAT_TYPE,
        'hedgerow'
      )
    })

    test('valid watercourse habitatType with featureType=watercourse returns 200 with condition options', async ({
      page
    }) => {
      await expectConditionsProxyOk(
        page,
        STUB_WATERCOURSE_HABITAT_TYPE,
        'watercourse'
      )
    })
  })

  // ─── Conditions proxy — role enforcement ─────────────────────────────────────

  test.describe('Conditions proxy — role enforcement', () => {
    test.use({ storageState: NO_ROLE_STORAGE_STATE })
    test.skip(skipInE2e(NO_ROLE_STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'authenticated user without BNG Completer role is redirected to /auth/forbidden',
      { tag: '@smoke' },
      async ({ page }) => {
        await page.goto(conditionsProxyUrl(STUB_HABITAT_TYPE))
        await expect(page).toHaveURL(/\/auth\/forbidden/)
      }
    )
  })

  // ─── Conditions proxy — unauthenticated access ───────────────────────────────

  test.describe('Conditions proxy — unauthenticated access', () => {
    test(
      'GET /api/reference/conditions redirects to sign-in',
      { tag: '@smoke' },
      async ({ page }) => {
        await page.goto(conditionsProxyUrl(STUB_HABITAT_TYPE))
        await expect(page).not.toHaveURL(/\/api\/reference\/conditions/)
        await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
      }
    )
  })

  // ─── Conditions proxy — featureType validation ────────────────────────────────

  test.describe(
    'Conditions proxy — featureType validation',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('invalid featureType query param returns 400', async ({ page }) => {
        const response = await page.goto(
          conditionsProxyUrl(STUB_HABITAT_TYPE, 'invalid')
        )
        expect(response.status()).toBe(HTTP_BAD_REQUEST)
      })
    }
  )

  // ─── Area habitat details — page display ─────────────────────────────────────

  test.describe(
    'Baseline habitat details — area habitat page display',
    { tag: '@smoke' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.skip(runMode === 'e2e', E2E_UPLOAD_SKIP_REASON)
      test.describe.configure({ mode: 'serial' })

      let projectId
      let areaFeatureId

      test('area habitat details form renders with all summary rows and dropdowns', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        baselineHabitatDetailsPage,
        page
      }) => {
        const shared = await getSharedBaseline({
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow,
          page
        })
        projectId = shared.id
        areaFeatureId = shared.area.featureId

        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)

        await expect(baselineHabitatDetailsPage.heading).toBeVisible()
        await expect(
          baselineHabitatDetailsPage.baselineDetailsHeading
        ).toBeVisible()
        await expect(
          baselineHabitatDetailsPage.broadHabitatSelect
        ).toBeVisible()
        await expect(baselineHabitatDetailsPage.habitatTypeSelect).toBeVisible()
        await expect(baselineHabitatDetailsPage.conditionSelect).toBeVisible()
        await expect(baselineHabitatDetailsPage.saveButton).toBeVisible()
        await expect(baselineHabitatDetailsPage.cancelLink).toBeVisible()
        await expect(baselineHabitatDetailsPage.backLink).toBeVisible()
        await expect(page.getByText('Area (hectares)')).toBeVisible()

        // Read-only summary rows, including the fixed "Low (1)" strategic
        // significance applied in MVS.
        await expect(baselineHabitatDetailsPage.referenceKey).toBeVisible()
        await expect(
          baselineHabitatDetailsPage.distinctivenessKey
        ).toBeVisible()
        await expect(
          baselineHabitatDetailsPage.strategicSignificanceKey
        ).toBeVisible()
        await expect(
          baselineHabitatDetailsPage.strategicSignificanceValue
        ).toBeVisible()
        await expect(baselineHabitatDetailsPage.tradingRulesKey).toBeVisible()
        await expect(baselineHabitatDetailsPage.habitatUnitsKey).toBeVisible()
      })

      test('save area habitat selections redirects to the area habitats baseline', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)
        await baselineHabitatDetailsPage.saveButton.click()
        await expect(page).toHaveURL(baselinePageUrl(projectId, 'area'))
      })
    }
  )

  // ─── Area habitat details — edit and recompute ───────────────────────────────

  test.describe(
    'Baseline habitat details — area habitat edit',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.skip(runMode === 'e2e', E2E_UPLOAD_SKIP_REASON)
      test.describe.configure({ mode: 'serial' })

      let projectId
      let areaFeatureId
      let areaRef

      // AC6 (Scenario A — all options selected): saving a changed selection
      // persists it, recalculates the habitat units, and returns to the area
      // habitats baseline with the row and the grid total reflecting the new
      // calculation. The grid has no Status column (BMD-1043), so "Complete" is
      // evidenced by the recalculated units rather than a status cell.
      test('AC6 Scenario A — saving with all options selected recalculates units', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        baselineHabitatDetailsPage,
        page
      }) => {
        projectId = await uploadAndGetProjectId(
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow
        )
        const area = await findEditableAreaHabitat(
          page,
          baselineHabitatDetailsPage,
          projectId
        )
        areaFeatureId = area.featureId
        areaRef = area.ref

        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)
        const newCondition =
          await baselineHabitatDetailsPage.selectDifferentCondition()
        await baselineHabitatDetailsPage.saveButton.click()
        await page.waitForURL(baselinePageUrl(projectId, 'area'))

        await expect(gridCell(page, 'area', areaRef, 'condition')).toHaveText(
          gridConditionPattern(newCondition)
        )
        // Units recalculated for the row and reflected in the grid total.
        await expect(gridCell(page, 'area', areaRef, 'units')).toHaveText(
          HABITAT_UNITS_PATTERN
        )
        await expect(gridUnitsTotal(page, 'area')).toHaveText(
          HABITAT_UNITS_PATTERN
        )
      })

      // AC2: selecting a different valid habitat type updates the derived
      // distinctiveness + trading-rules displays, refreshes and resets the
      // condition options to "Choose condition", and leaves units untouched
      // (recalculation only happens on Save).
      test('AC2 — selecting a valid habitat type updates derived values and resets condition', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)
        const before = await baselineHabitatDetailsPage.conditionOptionValues()
        const unitsBefore = await baselineHabitatDetailsPage.habitatUnitsText()

        const newType =
          await baselineHabitatDetailsPage.selectDifferentHabitatType()

        // The client JS fetches conditions for the new type via the proxy and
        // repopulates the Condition select, so the option set changes and the
        // selection resets to the placeholder.
        await expect
          .poll(() => baselineHabitatDetailsPage.conditionOptionValues())
          .not.toEqual(before)
        expect(
          await baselineHabitatDetailsPage.habitatTypeSelect.inputValue()
        ).toBe(newType)
        expect(
          await baselineHabitatDetailsPage.conditionSelect.inputValue()
        ).toBe('')
        await expect(
          baselineHabitatDetailsPage.distinctivenessDisplay
        ).not.toHaveText('')
        await expect(
          baselineHabitatDetailsPage.tradingRuleDisplay
        ).not.toHaveText('')
        await expect(baselineHabitatDetailsPage.habitatUnitsValue).toHaveText(
          unitsBefore
        )
      })

      // AC1: changing the condition shows the new value as the (collapsed)
      // selection with no DB write and no unit recalculation.
      test('AC1 — selecting a new condition shows it without recalculating units', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)
        const unitsBefore = await baselineHabitatDetailsPage.habitatUnitsText()
        const distinctivenessBefore = (
          await baselineHabitatDetailsPage.distinctivenessDisplay.textContent()
        ).trim()

        const newCondition =
          await baselineHabitatDetailsPage.selectDifferentCondition()

        expect(
          await baselineHabitatDetailsPage.conditionSelect.inputValue()
        ).toBe(newCondition)
        // A condition change touches nothing else — derived values and units
        // are unchanged.
        await expect(
          baselineHabitatDetailsPage.distinctivenessDisplay
        ).toHaveText(distinctivenessBefore)
        await expect(baselineHabitatDetailsPage.habitatUnitsValue).toHaveText(
          unitsBefore
        )
      })

      // AC3: deselecting the habitat type ("Choose habitat type") hides the
      // derived displays, resets the condition, and leaves units untouched.
      test('AC3 — deselecting the habitat type hides derived values and resets condition', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)
        const unitsBefore = await baselineHabitatDetailsPage.habitatUnitsText()

        await baselineHabitatDetailsPage.habitatTypeSelect.selectOption('')
        await expect
          .poll(() => baselineHabitatDetailsPage.conditionSelect.inputValue())
          .toBe('')

        expect(
          await baselineHabitatDetailsPage.habitatTypeSelect.inputValue()
        ).toBe('')
        await expectDerivedValuesHidden(baselineHabitatDetailsPage)
        await expect(baselineHabitatDetailsPage.habitatUnitsValue).toHaveText(
          unitsBefore
        )
      })

      // AC4: selecting a new broad habitat hides the derived displays and
      // reverts both the habitat type and condition to their defaults, without
      // recalculating units.
      test('AC4 — selecting a new broad habitat reverts type and condition and hides derived values', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)
        const unitsBefore = await baselineHabitatDetailsPage.habitatUnitsText()

        const newBroad =
          await baselineHabitatDetailsPage.selectDifferentBroadHabitat()

        expect(
          await baselineHabitatDetailsPage.broadHabitatSelect.inputValue()
        ).toBe(newBroad)
        await expectDerivedValuesHidden(baselineHabitatDetailsPage)
        expect(
          await baselineHabitatDetailsPage.habitatTypeSelect.inputValue()
        ).toBe('')
        expect(
          await baselineHabitatDetailsPage.conditionSelect.inputValue()
        ).toBe('')
        await expect(baselineHabitatDetailsPage.habitatUnitsValue).toHaveText(
          unitsBefore
        )
      })

      // AC5: deselecting the broad habitat ("Choose broad habitat") hides the
      // derived displays and reverts the habitat type and condition to their
      // defaults, without recalculating units.
      test('AC5 — deselecting the broad habitat reverts type and condition and hides derived values', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)
        const unitsBefore = await baselineHabitatDetailsPage.habitatUnitsText()

        await baselineHabitatDetailsPage.broadHabitatSelect.selectOption('')

        expect(
          await baselineHabitatDetailsPage.broadHabitatSelect.inputValue()
        ).toBe('')
        await expectDerivedValuesHidden(baselineHabitatDetailsPage)
        expect(
          await baselineHabitatDetailsPage.habitatTypeSelect.inputValue()
        ).toBe('')
        expect(
          await baselineHabitatDetailsPage.conditionSelect.inputValue()
        ).toBe('')
        await expect(baselineHabitatDetailsPage.habitatUnitsValue).toHaveText(
          unitsBefore
        )
      })

      // AC7: changing a dropdown then clicking Cancel discards the change —
      // the user returns to the area habitats baseline and the row's condition
      // + units are unchanged from before the edit (no UI or DB update).
      test('AC7 — cancelling after a change discards it and leaves the row unchanged', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        // Capture the currently-persisted row state fresh from the grid.
        await openBaselineGrid(page, projectId, 'area')
        const conditionBefore = (
          await gridCell(page, 'area', areaRef, 'condition').textContent()
        ).trim()
        const unitsBefore = (
          await gridCell(page, 'area', areaRef, 'units').textContent()
        ).trim()

        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)
        await baselineHabitatDetailsPage.selectDifferentCondition()
        await baselineHabitatDetailsPage.cancelLink.click()
        await page.waitForURL(baselinePageUrl(projectId, 'area'))

        await expect(gridCell(page, 'area', areaRef, 'condition')).toHaveText(
          conditionBefore
        )
        await expect(gridCell(page, 'area', areaRef, 'units')).toHaveText(
          unitsBefore
        )
      })

      // AC6 (Scenario B — not all options selected): saving with a dropdown
      // deselected zeroes the units (the grid has no Status column to show
      // Incomplete — BMD-1043). Runs last in the serial block because it leaves
      // the shared habitat Incomplete.
      test('AC6 Scenario B — saving with a deselected dropdown zeroes units', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)
        await baselineHabitatDetailsPage.conditionSelect.selectOption('')
        await baselineHabitatDetailsPage.saveButton.click()
        await page.waitForURL(baselinePageUrl(projectId, 'area'))

        await expect(gridCell(page, 'area', areaRef, 'units')).toHaveText(
          ZERO_UNITS
        )
      })
    }
  )

  // ─── Area habitat details — page content (ACs) ───────────────────────────────

  test.describe(
    'Baseline habitat details — area habitat content',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.describe.configure({ mode: 'serial' })

      let projectId
      let projectName
      let areaFeatureId
      let areaRef
      let areaSize

      test('AC1 — page pathname is /baseline-habitat-details after click-through, and Back returns to the area habitats baseline', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        baselineHabitatDetailsPage,
        page
      }) => {
        const shared = await getSharedBaseline({
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow,
          page
        })
        projectId = shared.id
        projectName = shared.name
        areaFeatureId = shared.area.featureId
        areaRef = shared.area.ref
        areaSize = shared.area.size

        const grid = await openBaselineGrid(page, projectId, 'area')
        await grid.refLink(areaRef).click()
        await expect(page).toHaveURL(/\/baseline-habitat-details/)

        // BMD-878 AC2, arrived-from-the-grid route. The referrer here is the
        // area habitats baseline: same-host, but not a post-intervention page,
        // so the Back link still falls back to the baseline grid. This is a
        // different branch from the no-referrer case the AC14 tests cover — a
        // referrer that parses and then fails the path/projectId checks, rather
        // than a missing one that throws. The hedgerow and watercourse
        // click-throughs below share this back-link logic, so one feature type
        // covers it.
        await expect(baselineHabitatDetailsPage.backLink).toHaveAttribute(
          'href',
          new RegExp(`^${baselinePagePath(projectId, 'area')}$`)
        )
        await baselineHabitatDetailsPage.backLink.click()
        await expect(page).toHaveURL(baselinePageUrl(projectId, 'area'))
        await expect(grid.table()).toBeVisible()
      })

      // AC2–AC11, consolidated. These were nine separate page loads asserting one
      // label or value each; merged into one panel assertion so the rendered page
      // is described in one place. No assertion was dropped in the merge. The
      // frontend controller unit tests cover the same rows against mocked backend
      // data (../bng-metric-frontend/src/server/baseline-habitat-details/controller.test.js,
      // "#baselineHabitatDetails - GET"); this test's distinct job is to prove the
      // rows render from a *real* uploaded GeoPackage.
      test('AC2–AC11 — renders every summary row and saved value', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)

        // AC2 — header
        await expect.soft(baselineHabitatDetailsPage.backLink).toBeVisible()
        await expect.soft(page.getByText(projectName)).toBeVisible()
        await expect
          .soft(baselineHabitatDetailsPage.heading)
          .toHaveText(`Habitat ${areaRef}`)
        await expect
          .soft(baselineHabitatDetailsPage.baselineDetailsHeading)
          .toBeVisible()

        // AC3 — reference label + saved value. Exact match scopes this to the
        // Reference row value, not the "Habitat {ref}" page heading.
        await expect.soft(baselineHabitatDetailsPage.referenceKey).toBeVisible()
        await expect
          .soft(page.getByText(areaRef, { exact: true }))
          .toBeVisible()

        // AC4 — area label + value carried from the baseline grid
        await expect
          .soft(page.getByText('Area (hectares)', { exact: true }))
          .toBeVisible()
        await expect
          .soft(page.getByText(areaSize, { exact: true }))
          .toBeVisible()

        // AC5a / AC6a / AC8a — dropdowns show the saved values
        await expect
          .soft(baselineHabitatDetailsPage.broadHabitatSelect)
          .toBeVisible()
        expect
          .soft(
            await baselineHabitatDetailsPage.broadHabitatSelect.inputValue()
          )
          .not.toBe('')
        await expect
          .soft(baselineHabitatDetailsPage.habitatTypeSelect)
          .toBeVisible()
        expect
          .soft(await baselineHabitatDetailsPage.habitatTypeSelect.inputValue())
          .not.toBe('')
        await expect
          .soft(baselineHabitatDetailsPage.conditionSelect)
          .toBeVisible()
        expect
          .soft(await baselineHabitatDetailsPage.conditionSelect.inputValue())
          .not.toBe('')

        // AC7 — distinctiveness band and score
        await expect
          .soft(baselineHabitatDetailsPage.distinctivenessKey)
          .toBeVisible()
        await expect
          .soft(page.getByText(DISTINCTIVENESS_PATTERN).first())
          .toBeVisible()

        // AC10 / AC11 — trading rules and units labels
        await expect
          .soft(baselineHabitatDetailsPage.tradingRulesKey)
          .toBeVisible()
        await expect
          .soft(baselineHabitatDetailsPage.habitatUnitsKey)
          .toBeVisible()
      })

      // AC5b, AC6b and AC8b consolidated: every dropdown's option list on one
      // page load.
      test('AC5b/AC6b/AC8b — dropdowns offer correctly ordered options', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)

        const broadTexts = await optionTexts(
          baselineHabitatDetailsPage.broadHabitatSelect
        )
        expect(broadTexts[0]).toBe('Choose broad habitat')
        expect(isSortedAscending(broadTexts.slice(1))).toBe(true)

        const typeTexts = await optionTexts(
          baselineHabitatDetailsPage.habitatTypeSelect
        )
        expect(typeTexts[0]).toBe('Choose habitat type')
        expect(typeTexts.length).toBeGreaterThan(1)
        expect(isSortedAscending(typeTexts.slice(1))).toBe(true)

        await expectConditionOptionsOrderedByScore(
          baselineHabitatDetailsPage.conditionSelect
        )
      })

      test('AC10 — trading-rule guidance value is shown and tracks the distinctiveness band', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)

        // Beyond the AC10 label: the saved habitat shows a populated guidance
        // value for its band on load. The exact wording is owned by the engine
        // reference data, so assert a non-empty guidance string (not a hard-coded
        // sentence) alongside the band.
        await expect(
          baselineHabitatDetailsPage.distinctivenessDisplay
        ).toHaveText(DISTINCTIVENESS_PATTERN)
        const bandBefore = (
          await baselineHabitatDetailsPage.distinctivenessDisplay.textContent()
        ).trim()
        const guidanceBefore = (
          await baselineHabitatDetailsPage.tradingRuleDisplay.textContent()
        ).trim()
        expect(guidanceBefore).not.toBe('')

        // Selecting a habitat type in a different band updates the guidance, proving
        // it is derived per distinctiveness band rather than static.
        await baselineHabitatDetailsPage.selectDifferentHabitatType()
        await expect(
          baselineHabitatDetailsPage.tradingRuleDisplay
        ).not.toHaveText('')
        const bandAfter = (
          await baselineHabitatDetailsPage.distinctivenessDisplay.textContent()
        ).trim()
        const guidanceAfter = (
          await baselineHabitatDetailsPage.tradingRuleDisplay.textContent()
        ).trim()
        if (bandAfter !== bandBefore) {
          expect(guidanceAfter).not.toBe(guidanceBefore)
        }
      })

      // BMD-878 AC2, bookmark route: open() deep-links via page.goto(), which
      // sends no Referer, so the Back link falls back to the area habitats
      // baseline (BMD-1043; it was the habitat list). Do not "improve" this to
      // click through from a post-intervention habitat details page — that
      // sends a Referer and the link would correctly point back there instead,
      // which is AC1, not this test.
      test('AC14/AC15 — Back and Cancel return to the area habitats baseline', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        // Since BMD-1043 Cancel and Back share one destination — the row
        // anchor Cancel used to carry went with the habitat list.
        await expectBackAndCancelReturnToBaseline(
          page,
          baselineHabitatDetailsPage,
          { projectId, featureId: areaFeatureId, type: 'area' }
        )
      })
    }
  )

  // ─── Hedgerow details — page display ─────────────────────────────────────────

  test.describe(
    'Baseline habitat details — hedgerow page display',
    { tag: '@smoke' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.skip(runMode === 'e2e', E2E_UPLOAD_SKIP_REASON)
      test.describe.configure({ mode: 'serial' })

      let projectId
      let hedgerowFeatureId

      test('hedgerow details form renders without Broad habitat row and with Length (km) size', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        baselineHabitatDetailsPage,
        page
      }) => {
        const shared = await getSharedBaseline({
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow,
          page
        })
        projectId = shared.id
        hedgerowFeatureId = shared.hedgerow.featureId

        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)

        await expect(baselineHabitatDetailsPage.heading).toBeVisible()
        await expect(
          baselineHabitatDetailsPage.baselineDetailsHeading
        ).toBeVisible()
        await expect(
          baselineHabitatDetailsPage.broadHabitatSelect
        ).not.toBeVisible()
        await expect(baselineHabitatDetailsPage.habitatTypeSelect).toBeVisible()
        await expect(baselineHabitatDetailsPage.conditionSelect).toBeVisible()
        await expect(baselineHabitatDetailsPage.saveButton).toBeVisible()
        await expect(baselineHabitatDetailsPage.backLink).toBeVisible()
        await expect(baselineHabitatDetailsPage.cancelLink).toBeVisible()
        await expect(page.getByText('Length (km)')).toBeVisible()
      })

      test('save hedgerow selections redirects to the hedgerows baseline', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)
        await baselineHabitatDetailsPage.saveButton.click()
        await expect(page).toHaveURL(baselinePageUrl(projectId, 'hedgerow'))
      })
    }
  )

  // ─── Hedgerow details — edit and recompute ────────────────────────────────────

  test.describe(
    'Baseline habitat details — hedgerow edit',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.skip(runMode === 'e2e', E2E_UPLOAD_SKIP_REASON)
      test.describe.configure({ mode: 'serial' })

      let projectId
      let hedgerowFeatureId
      let hedgerowRef

      // AC6 (Scenario A — all options selected): saving a changed selection
      // persists it, recalculates the hedgerow units, and returns to the
      // hedgerows baseline with the row and the grid total reflecting the new
      // calculation. The grid has no Status column (BMD-1043).
      test('AC6 Scenario A — saving with all options selected recalculates units', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        baselineHabitatDetailsPage,
        page
      }) => {
        projectId = await uploadAndGetProjectId(
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow
        )
        const hedgerow = await firstGridFeature(page, projectId, 'hedgerow')
        hedgerowFeatureId = hedgerow.featureId
        hedgerowRef = hedgerow.ref

        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)
        const newCondition =
          await baselineHabitatDetailsPage.selectDifferentCondition()
        await baselineHabitatDetailsPage.saveButton.click()
        await page.waitForURL(baselinePageUrl(projectId, 'hedgerow'))

        await expect(
          gridCell(page, 'hedgerow', hedgerowRef, 'condition')
        ).toHaveText(gridConditionPattern(newCondition))
        // Units recalculated for the row and reflected in the grid total.
        await expect(
          gridCell(page, 'hedgerow', hedgerowRef, 'units')
        ).toHaveText(HABITAT_UNITS_PATTERN)
        await expect(gridUnitsTotal(page, 'hedgerow')).toHaveText(
          HABITAT_UNITS_PATTERN
        )
      })

      // AC2: selecting a different valid habitat type updates the derived
      // distinctiveness + trading-rules displays and resets the condition to
      // "Choose condition", without recalculating units. (Hedgerow types share
      // the same condition set, so the options are unchanged but the selection
      // still resets.)
      test('AC2 — selecting a habitat type updates derived values and resets condition', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)
        const unitsBefore = await baselineHabitatDetailsPage.habitatUnitsText()

        // Switching from Low to Medium exercises the full client-side update
        // path (showDistinctiveness + showTradingRule + loadConditions).
        await baselineHabitatDetailsPage.habitatTypeSelect.selectOption(
          'Native hedgerow'
        )
        await expect(
          baselineHabitatDetailsPage.distinctivenessDisplay
        ).toContainText('Low (2)')

        await baselineHabitatDetailsPage.habitatTypeSelect.selectOption(
          'Native hedgerow with trees'
        )
        await expect(
          baselineHabitatDetailsPage.distinctivenessDisplay
        ).toContainText('Medium (4)')
        await expect(
          baselineHabitatDetailsPage.tradingRuleDisplay
        ).not.toHaveText('')
        await expect
          .poll(() => baselineHabitatDetailsPage.conditionSelect.inputValue())
          .toBe('')
        await expect(baselineHabitatDetailsPage.habitatUnitsValue).toHaveText(
          unitsBefore
        )
      })

      // AC1: changing the condition shows the new value as the selection with no
      // DB write and no unit recalculation.
      test('AC1 — selecting a new condition shows it without recalculating units', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)
        const unitsBefore = await baselineHabitatDetailsPage.habitatUnitsText()
        const distinctivenessBefore = (
          await baselineHabitatDetailsPage.distinctivenessDisplay.textContent()
        ).trim()

        const newCondition =
          await baselineHabitatDetailsPage.selectDifferentCondition()

        expect(
          await baselineHabitatDetailsPage.conditionSelect.inputValue()
        ).toBe(newCondition)
        // A condition change touches nothing else.
        await expect(
          baselineHabitatDetailsPage.distinctivenessDisplay
        ).toHaveText(distinctivenessBefore)
        await expect(baselineHabitatDetailsPage.habitatUnitsValue).toHaveText(
          unitsBefore
        )
      })

      // AC3: deselecting the habitat type ("Choose habitat type") hides the
      // derived displays, resets the condition, and leaves units untouched.
      test('AC3 — deselecting the habitat type hides derived values and resets condition', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)
        const unitsBefore = await baselineHabitatDetailsPage.habitatUnitsText()

        await baselineHabitatDetailsPage.habitatTypeSelect.selectOption('')
        await expect
          .poll(() => baselineHabitatDetailsPage.conditionSelect.inputValue())
          .toBe('')

        expect(
          await baselineHabitatDetailsPage.habitatTypeSelect.inputValue()
        ).toBe('')
        await expectDerivedValuesHidden(baselineHabitatDetailsPage)
        await expect(baselineHabitatDetailsPage.habitatUnitsValue).toHaveText(
          unitsBefore
        )
      })

      // AC7: changing a dropdown then clicking Cancel discards the change — the
      // user returns to the hedgerows baseline and the row's condition + units
      // are unchanged from before the edit (no UI or DB update).
      test('AC7 — cancelling after a change discards it and leaves the row unchanged', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        // Capture the currently-persisted row state fresh from the grid.
        await openBaselineGrid(page, projectId, 'hedgerow')
        const conditionBefore = (
          await gridCell(
            page,
            'hedgerow',
            hedgerowRef,
            'condition'
          ).textContent()
        ).trim()
        const unitsBefore = (
          await gridCell(page, 'hedgerow', hedgerowRef, 'units').textContent()
        ).trim()

        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)
        await baselineHabitatDetailsPage.selectDifferentCondition()
        await baselineHabitatDetailsPage.cancelLink.click()
        await page.waitForURL(baselinePageUrl(projectId, 'hedgerow'))

        await expect(
          gridCell(page, 'hedgerow', hedgerowRef, 'condition')
        ).toHaveText(conditionBefore)
        await expect(
          gridCell(page, 'hedgerow', hedgerowRef, 'units')
        ).toHaveText(unitsBefore)
      })

      // AC6 (Scenario B — not all options selected): saving with the condition
      // deselected zeroes the units (no Status column — BMD-1043). Runs last in
      // the serial block because it leaves the shared hedgerow Incomplete.
      test('AC6 Scenario B — saving with a deselected dropdown zeroes units', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)
        await baselineHabitatDetailsPage.conditionSelect.selectOption('')
        await baselineHabitatDetailsPage.saveButton.click()
        await page.waitForURL(baselinePageUrl(projectId, 'hedgerow'))

        await expect(
          gridCell(page, 'hedgerow', hedgerowRef, 'units')
        ).toHaveText(ZERO_UNITS)
      })
    }
  )

  // ─── Hedgerow details — page content (ACs) ───────────────────────────────────

  test.describe(
    'Baseline habitat details — hedgerow content',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.describe.configure({ mode: 'serial' })

      let projectId
      let projectName
      let hedgerowFeatureId
      let hedgerowRef
      let hedgerowLength

      test('AC1 — page pathname is /baseline-habitat-details after click-through', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        page
      }) => {
        const shared = await getSharedBaseline({
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow,
          page
        })
        projectId = shared.id
        projectName = shared.name
        hedgerowFeatureId = shared.hedgerow.featureId
        hedgerowRef = shared.hedgerow.ref
        hedgerowLength = shared.hedgerow.length

        const grid = await openBaselineGrid(page, projectId, 'hedgerow')
        await grid.refLink(hedgerowRef).click()
        await expect(page).toHaveURL(/\/baseline-habitat-details/)
      })

      // AC2–AC11, consolidated. These were nine separate page loads asserting one
      // label or value each; merged into one panel assertion so the rendered page
      // is described in one place. No assertion was dropped in the merge. The
      // hedgerow strategy has partial unit coverage
      // (../bng-metric-frontend/src/server/baseline-habitat-details/controller.test.js,
      // "#baselineHabitatDetails - GET (hedgerow strategy)" — heading, Length row,
      // omitted Broad row, conditions source, back/cancel), all against mocked
      // backend data; this test proves the rows render from a real GeoPackage.
      test('AC2–AC11 — renders every summary row and saved value', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)

        // AC2 — header
        await expect.soft(baselineHabitatDetailsPage.backLink).toBeVisible()
        await expect.soft(page.getByText(projectName)).toBeVisible()
        await expect
          .soft(baselineHabitatDetailsPage.heading)
          .toHaveText(`Hedgerow ${hedgerowRef}`)
        await expect
          .soft(baselineHabitatDetailsPage.baselineDetailsHeading)
          .toBeVisible()

        // AC3 — reference label + saved value
        await expect.soft(baselineHabitatDetailsPage.referenceKey).toBeVisible()
        await expect
          .soft(page.getByText(hedgerowRef, { exact: true }))
          .toBeVisible()

        // AC4 — length label + value carried from the baseline grid
        await expect
          .soft(page.getByText('Length (km)', { exact: true }))
          .toBeVisible()
        await expect
          .soft(page.getByText(hedgerowLength, { exact: true }))
          .toBeVisible()

        // AC6a / AC8a — dropdowns show the saved values
        await expect
          .soft(baselineHabitatDetailsPage.habitatTypeSelect)
          .toBeVisible()
        expect
          .soft(await baselineHabitatDetailsPage.habitatTypeSelect.inputValue())
          .not.toBe('')
        await expect
          .soft(baselineHabitatDetailsPage.conditionSelect)
          .toBeVisible()
        expect
          .soft(await baselineHabitatDetailsPage.conditionSelect.inputValue())
          .not.toBe('')

        // AC7 — distinctiveness band and score
        await expect
          .soft(baselineHabitatDetailsPage.distinctivenessKey)
          .toBeVisible()
        await expect
          .soft(page.getByText(DISTINCTIVENESS_PATTERN).first())
          .toBeVisible()

        // AC9 — fixed strategic significance
        await expect
          .soft(baselineHabitatDetailsPage.strategicSignificanceKey)
          .toBeVisible()
        await expect
          .soft(baselineHabitatDetailsPage.strategicSignificanceValue)
          .toBeVisible()

        // AC10 / AC11 — trading rules and units labels
        await expect
          .soft(baselineHabitatDetailsPage.tradingRulesKey)
          .toBeVisible()
        await expect
          .soft(baselineHabitatDetailsPage.habitatUnitsKey)
          .toBeVisible()
      })

      // AC6b and AC8b consolidated: both dropdowns' option lists on one page load.
      test('AC6b/AC8b — dropdowns offer correctly ordered options', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)

        const typeTexts = await optionTexts(
          baselineHabitatDetailsPage.habitatTypeSelect
        )
        expect(typeTexts[0]).toBe('Choose habitat type')
        expect(typeTexts.length).toBeGreaterThan(1)
        expect(isSortedAscending(typeTexts.slice(1))).toBe(true)

        await expectConditionOptionsOrderedByScore(
          baselineHabitatDetailsPage.conditionSelect
        )
      })

      // BMD-878 AC2, bookmark route — see the Areas-tab AC14 test for why these
      // must keep reaching the page via open()/page.goto() (no Referer).
      test('AC14/AC15 — Back and Cancel return to the hedgerows baseline', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await expectBackAndCancelReturnToBaseline(
          page,
          baselineHabitatDetailsPage,
          { projectId, featureId: hedgerowFeatureId, type: 'hedgerow' }
        )
      })
    }
  )

  // ─── Watercourse details — edit and recompute (BMD-597) ──────────────────────

  test.describe(
    'Baseline habitat details — watercourse edit',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.skip(runMode === 'e2e', E2E_UPLOAD_SKIP_REASON)
      test.describe.configure({ mode: 'serial' })

      let projectId
      let watercourseFeatureId
      let watercourseRef

      // AC8/AC8c (Scenario A — all options selected): saving with habitat type,
      // condition and both encroachments set persists them, recalculates the
      // watercourse units, and returns to the watercourses baseline with the
      // row and the grid total reflecting the new calculation. The grid has no
      // Status column (BMD-1043).
      test('Scenario A — saving with all options selected recalculates units', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        baselineHabitatDetailsPage,
        page
      }) => {
        projectId = await uploadAndGetProjectId(
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow
        )
        const watercourse = await firstGridFeature(
          page,
          projectId,
          'watercourse'
        )
        watercourseFeatureId = watercourse.featureId
        watercourseRef = watercourse.ref

        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)
        // Selecting the type resets condition + encroachments, so set all four
        // explicitly. The condition options repopulate asynchronously from the
        // conditions proxy after the type change — a condition selected before
        // that response lands is wiped by the repopulation (the option set may
        // be identical when the saved type is reselected, so option-list polls
        // cannot detect it) — so wait for the proxy response itself.
        await Promise.all([
          page.waitForResponse((response) =>
            response.url().includes('/api/reference/conditions')
          ),
          baselineHabitatDetailsPage.habitatTypeSelect.selectOption(
            STUB_WATERCOURSE_HABITAT_TYPE
          )
        ])
        await expect
          .poll(
            async () =>
              (await baselineHabitatDetailsPage.conditionOptionValues()).length
          )
          .toBeGreaterThan(1)
        const newCondition =
          await baselineHabitatDetailsPage.selectDifferentCondition()
        await baselineHabitatDetailsPage.watercourseEncroachmentSelect.selectOption(
          'Minor'
        )
        await baselineHabitatDetailsPage.riparianEncroachmentSelect.selectOption(
          'Minor/Minor'
        )
        await baselineHabitatDetailsPage.saveButton.click()
        await page.waitForURL(baselinePageUrl(projectId, 'watercourse'))

        await expect(
          gridCell(page, 'watercourse', watercourseRef, 'condition')
        ).toHaveText(gridConditionPattern(newCondition))
        // Units recalculated for the row and reflected in the grid total.
        await expect(
          gridCell(page, 'watercourse', watercourseRef, 'units')
        ).toHaveText(HABITAT_UNITS_PATTERN)
        await expect(gridUnitsTotal(page, 'watercourse')).toHaveText(
          HABITAT_UNITS_PATTERN
        )
      })

      // AC (change condition): changing the condition shows the new value as
      // the selection with no DB write and no unit recalculation.
      test('changing the condition shows it without recalculating units', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)
        const unitsBefore = await baselineHabitatDetailsPage.habitatUnitsText()
        const distinctivenessBefore = (
          await baselineHabitatDetailsPage.distinctivenessDisplay.textContent()
        ).trim()

        const newCondition =
          await baselineHabitatDetailsPage.selectDifferentCondition()

        expect(
          await baselineHabitatDetailsPage.conditionSelect.inputValue()
        ).toBe(newCondition)
        // A condition change touches nothing else.
        await expect(
          baselineHabitatDetailsPage.distinctivenessDisplay
        ).toHaveText(distinctivenessBefore)
        await expect(baselineHabitatDetailsPage.habitatUnitsValue).toHaveText(
          unitsBefore
        )
      })

      // AC (select a valid habitat type): the derived displays update and the
      // condition + both encroachment dropdowns reset to their placeholders,
      // without recalculating units.
      test('selecting a habitat type updates derived values and resets condition and encroachments', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)
        const unitsBefore = await baselineHabitatDetailsPage.habitatUnitsText()

        await baselineHabitatDetailsPage.habitatTypeSelect.selectOption(
          'Canals'
        )
        await expect
          .poll(() => baselineHabitatDetailsPage.conditionSelect.inputValue())
          .toBe('')

        await expect(
          baselineHabitatDetailsPage.distinctivenessDisplay
        ).not.toHaveText('')
        await expect(
          baselineHabitatDetailsPage.tradingRuleDisplay
        ).not.toHaveText('')
        await expect(
          baselineHabitatDetailsPage.watercourseEncroachmentSelect
        ).toHaveValue('')
        await expect(
          baselineHabitatDetailsPage.riparianEncroachmentSelect
        ).toHaveValue('')
        await expect(baselineHabitatDetailsPage.habitatUnitsValue).toHaveText(
          unitsBefore
        )
      })

      // AC (deselect habitat type): the derived displays are hidden and the
      // condition + both encroachment dropdowns reset, without recalculating
      // units.
      test('deselecting the habitat type hides derived values and resets condition and encroachments', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)
        const unitsBefore = await baselineHabitatDetailsPage.habitatUnitsText()

        await baselineHabitatDetailsPage.habitatTypeSelect.selectOption('')
        await expect
          .poll(() => baselineHabitatDetailsPage.conditionSelect.inputValue())
          .toBe('')

        expect(
          await baselineHabitatDetailsPage.habitatTypeSelect.inputValue()
        ).toBe('')
        await expectDerivedValuesHidden(baselineHabitatDetailsPage)
        await expect(
          baselineHabitatDetailsPage.watercourseEncroachmentSelect
        ).toHaveValue('')
        await expect(
          baselineHabitatDetailsPage.riparianEncroachmentSelect
        ).toHaveValue('')
        await expect(baselineHabitatDetailsPage.habitatUnitsValue).toHaveText(
          unitsBefore
        )
      })

      // AC (cancel): changing dropdowns then clicking Cancel discards the
      // changes — the user returns to the watercourses baseline with the row's
      // condition, units and the grid total unchanged.
      test('cancelling after changes discards them and leaves the row and total unchanged', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        // Capture the currently-persisted state fresh from the grid.
        await openBaselineGrid(page, projectId, 'watercourse')
        const conditionBefore = (
          await gridCell(
            page,
            'watercourse',
            watercourseRef,
            'condition'
          ).textContent()
        ).trim()
        const unitsBefore = (
          await gridCell(
            page,
            'watercourse',
            watercourseRef,
            'units'
          ).textContent()
        ).trim()
        const totalBefore = (
          await gridUnitsTotal(page, 'watercourse').textContent()
        ).trim()

        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)
        await baselineHabitatDetailsPage.selectDifferentCondition()
        await baselineHabitatDetailsPage.watercourseEncroachmentSelect.selectOption(
          'Major'
        )
        await baselineHabitatDetailsPage.cancelLink.click()
        await page.waitForURL(baselinePageUrl(projectId, 'watercourse'))

        await expect(
          gridCell(page, 'watercourse', watercourseRef, 'condition')
        ).toHaveText(conditionBefore)
        await expect(
          gridCell(page, 'watercourse', watercourseRef, 'units')
        ).toHaveText(unitsBefore)
        await expect(gridUnitsTotal(page, 'watercourse')).toHaveText(
          totalBefore
        )
      })

      // AC8 (Scenario B — not all options selected): saving with the condition
      // deselected zeroes the units (no Status column — BMD-1043). Runs last in
      // the serial block because it leaves the shared watercourse Incomplete.
      test('Scenario B — saving with a deselected dropdown zeroes units', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)
        await baselineHabitatDetailsPage.conditionSelect.selectOption('')
        await baselineHabitatDetailsPage.saveButton.click()
        await page.waitForURL(baselinePageUrl(projectId, 'watercourse'))

        await expect(
          gridCell(page, 'watercourse', watercourseRef, 'units')
        ).toHaveText(ZERO_UNITS)
      })
    }
  )

  // ─── Watercourse details — page content (ACs) ────────────────────────────────

  test.describe(
    'Baseline habitat details — watercourse content',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.describe.configure({ mode: 'serial' })

      let projectId
      let projectName
      let watercourseFeatureId
      let watercourseRef
      let watercourseLength

      test('AC1 — page pathname is /baseline-habitat-details after click-through', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        page
      }) => {
        const shared = await getSharedBaseline({
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow,
          page
        })
        projectId = shared.id
        projectName = shared.name
        watercourseFeatureId = shared.watercourse.featureId
        watercourseRef = shared.watercourse.ref
        watercourseLength = shared.watercourse.length

        const grid = await openBaselineGrid(page, projectId, 'watercourse')
        await grid.refLink(watercourseRef).click()
        await expect(page).toHaveURL(/\/baseline-habitat-details/)
      })

      // AC2–AC13 + encroachment row order, consolidated. These were 13 separate
      // uploads-shared page loads asserting one label or value each; merged into
      // one panel assertion so the whole rendered page is described in one place.
      // No assertion was dropped in the merge. NOTE: the baseline *watercourse*
      // detail page has no frontend unit coverage at all
      // (../bng-metric-frontend/src/server/baseline-habitat-details/controller.test.js
      // has GET describes for area and hedgerow only), so this test is the sole
      // witness for the whole page — keep it exhaustive.
      test('AC2–AC13 — renders every summary row, saved value and control', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)

        // AC2 — header
        await expect.soft(baselineHabitatDetailsPage.backLink).toBeVisible()
        await expect.soft(page.getByText(projectName)).toBeVisible()
        await expect
          .soft(baselineHabitatDetailsPage.heading)
          .toHaveText(`Watercourse ${watercourseRef}`)
        await expect
          .soft(baselineHabitatDetailsPage.baselineDetailsHeading)
          .toBeVisible()

        // AC3 — reference label + saved value
        await expect.soft(baselineHabitatDetailsPage.referenceKey).toBeVisible()
        await expect
          .soft(page.getByText(watercourseRef, { exact: true }))
          .toBeVisible()

        // AC4 — length label + value carried from the baseline grid
        await expect
          .soft(page.getByText('Length (km)', { exact: true }))
          .toBeVisible()
        await expect
          .soft(page.getByText(watercourseLength, { exact: true }))
          .toBeVisible()

        // AC5 — no Broad habitat dropdown for watercourses
        await expect
          .soft(baselineHabitatDetailsPage.broadHabitatSelect)
          .toHaveCount(0)

        // AC6a / AC8a — habitat type and condition show the saved values
        await expect
          .soft(baselineHabitatDetailsPage.habitatTypeSelect)
          .toBeVisible()
        expect
          .soft(await baselineHabitatDetailsPage.habitatTypeSelect.inputValue())
          .not.toBe('')
        await expect
          .soft(baselineHabitatDetailsPage.conditionSelect)
          .toBeVisible()
        expect
          .soft(await baselineHabitatDetailsPage.conditionSelect.inputValue())
          .not.toBe('')

        // AC7 — distinctiveness band and score
        await expect
          .soft(baselineHabitatDetailsPage.distinctivenessKey)
          .toBeVisible()
        await expect
          .soft(page.getByText(DISTINCTIVENESS_PATTERN).first())
          .toBeVisible()

        // AC9 — fixed strategic significance
        await expect
          .soft(baselineHabitatDetailsPage.strategicSignificanceKey)
          .toBeVisible()
        await expect
          .soft(baselineHabitatDetailsPage.strategicSignificanceValue)
          .toBeVisible()

        // AC10 / AC11 — trading rules and units labels
        await expect
          .soft(baselineHabitatDetailsPage.tradingRulesKey)
          .toBeVisible()
        await expect
          .soft(baselineHabitatDetailsPage.habitatUnitsKey)
          .toBeVisible()

        // Encroachment rows appear, watercourse before riparian
        const rowKeys = (await page.getByRole('term').allTextContents()).map(
          (t) => t.trim()
        )
        const watercourseIdx = rowKeys.indexOf('Watercourse encroachment')
        const riparianIdx = rowKeys.indexOf('Riparian encroachment')
        expect.soft(watercourseIdx).toBeGreaterThan(-1)
        expect.soft(riparianIdx).toBeGreaterThan(-1)
        expect.soft(watercourseIdx).toBeLessThan(riparianIdx)

        // AC12 / AC13 — form controls
        await expect.soft(baselineHabitatDetailsPage.saveButton).toBeVisible()
        await expect.soft(baselineHabitatDetailsPage.cancelLink).toBeVisible()
      })

      // AC6b, AC8b, ACW, ACR and the BMD-597 distinctiveness-scope filter,
      // consolidated: every dropdown's option list on one page load.
      test('AC6b/AC8b/ACW/ACR — dropdowns offer correctly filtered and ordered options', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)

        // AC6b — habitat type: default first, rest sorted ascending
        const typeTexts = await optionTexts(
          baselineHabitatDetailsPage.habitatTypeSelect
        )
        expect(typeTexts[0]).toBe('Choose habitat type')
        expect(typeTexts.length).toBeGreaterThan(1)
        expect(isSortedAscending(typeTexts.slice(1))).toBe(true)

        // BMD-597 retest fix (PR #146): the type list is filtered to the in-scope
        // V.Low/Low/Medium bands, so High ("Other rivers and streams") and V.High
        // ("Priority habitat") engine types must never appear.
        for (const outOfScopeType of OUT_OF_SCOPE_WATERCOURSE_TYPES) {
          expect(typeTexts).not.toContain(outOfScopeType)
        }
        for (const inScopeType of IN_SCOPE_WATERCOURSE_TYPES) {
          expect(typeTexts).toContain(inScopeType)
        }

        // AC8b — condition: default first, rest ordered by score descending
        await expectConditionOptionsOrderedByScore(
          baselineHabitatDetailsPage.conditionSelect
        )

        // BMD-597 AC set 1: a non-culvert type gets the graded encroachment
        // options without "N/A - Culvert" (the shared watercourse's saved type is
        // never Culvert, so the server-side filter takes this branch).
        await expect(
          baselineHabitatDetailsPage.watercourseEncroachmentSelect
        ).toBeVisible()
        const watercourseTexts = await optionTexts(
          baselineHabitatDetailsPage.watercourseEncroachmentSelect
        )
        expect(watercourseTexts).toEqual([
          WATERCOURSE_ENCROACHMENT_PLACEHOLDER,
          ...NON_CULVERT_WATERCOURSE_ENCROACHMENTS
        ])
        expect(watercourseTexts).not.toContain(CULVERT_ENCROACHMENT)

        await expect(
          baselineHabitatDetailsPage.riparianEncroachmentSelect
        ).toBeVisible()
        const riparianTexts = await optionTexts(
          baselineHabitatDetailsPage.riparianEncroachmentSelect
        )
        expect(riparianTexts).toEqual([
          RIPARIAN_ENCROACHMENT_PLACEHOLDER,
          ...NON_CULVERT_RIPARIAN_ENCROACHMENTS
        ])
        expect(riparianTexts).not.toContain(CULVERT_ENCROACHMENT)
      })

      // BMD-597 AC set 1 (culverts): selecting the Culvert type repopulates both
      // encroachment dropdowns client-side with the single culvert value. Kept as
      // its own test — this is client-side JS behaviour, not page render, and it
      // mutates the form so it cannot share a page load with the assertions above.
      test('ACW/ACR-culvert — selecting the Culvert type narrows both encroachments to N/A - Culvert', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)
        await baselineHabitatDetailsPage.habitatTypeSelect.selectOption(
          CULVERT_TYPE
        )

        await expect
          .poll(() =>
            optionTexts(
              baselineHabitatDetailsPage.watercourseEncroachmentSelect
            )
          )
          .toEqual([WATERCOURSE_ENCROACHMENT_PLACEHOLDER, CULVERT_ENCROACHMENT])
        await expect
          .poll(() =>
            optionTexts(baselineHabitatDetailsPage.riparianEncroachmentSelect)
          )
          .toEqual([RIPARIAN_ENCROACHMENT_PLACEHOLDER, CULVERT_ENCROACHMENT])
      })

      // BMD-878 AC2, bookmark route — see the Areas-tab AC14 test for why these
      // must keep reaching the page via open()/page.goto() (no Referer). Each link
      // is clicked from its own page load, so they stay in one test only because
      // the second re-opens the page.
      test('AC14/AC15 — Back and Cancel return to the watercourses baseline', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await expectBackAndCancelReturnToBaseline(
          page,
          baselineHabitatDetailsPage,
          { projectId, featureId: watercourseFeatureId, type: 'watercourse' }
        )
      })

      test('save watercourse selections redirects to the watercourses baseline', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)
        await baselineHabitatDetailsPage.saveButton.click()
        await expect(page).toHaveURL(baselinePageUrl(projectId, 'watercourse'))
      })
    }
  )
})
