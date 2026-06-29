import { test, expect } from '@fixtures'
import {
  STORAGE_STATE,
  NO_ROLE_STORAGE_STATE,
  skipInE2e,
  runMode
} from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'

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
const HTTP_BAD_GATEWAY = 502
const STUB_UUID = '00000000-0000-0000-0000-000000000000'
const VALID_UUID_V4 = 'aaaaaaaa-bbbb-4ccc-bddd-eeeeeeeeeeee'
const STUB_HABITAT_TYPE = 'Grassland - Modified grassland'
const STUB_HEDGEROW_HABITAT_TYPE = 'Native hedgerow'
const STUB_WATERCOURSE_HABITAT_TYPE = 'Ditches'
const UPLOAD_TIMEOUT = 120_000
const COMPLETE_BASELINE_FILE = 'Baseline - complete with area refs.gpkg'
const PROJECT_LABEL = 'Habitat details test'

// Habitat-list table column order (buildHabitatRow): ref, type, size,
// distinctiveness, condition, units, status.
const SIZE_COLUMN = 2
const DISTINCTIVENESS_COLUMN = 3
const CONDITION_COLUMN = 4
const UNITS_COLUMN = 5
const STATUS_COLUMN = 6

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
  uploadBaselineFileFlow,
  page
) {
  const project = await setupProject(
    createProjectFlow,
    projectDashboardPage,
    PROJECT_LABEL
  )
  await uploadBaselineFileFlow.uploadFile(project.id, COMPLETE_BASELINE_FILE)
  await page.waitForURL(
    new RegExp(`/projects/${project.id}/baseline-habitat-list`),
    { timeout: UPLOAD_TIMEOUT }
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

async function getRowRefAndFeatureId(page, panelId) {
  const link = page.locator(`#${panelId}`).getByRole('link').first()
  return refAndFeatureIdFromLink(link)
}

async function getFeatureIdFromTable(page, panelId) {
  const { featureId } = await getRowRefAndFeatureId(page, panelId)
  return featureId
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

async function expectDerivedValuesHidden(detailsPage) {
  await expect(detailsPage.distinctivenessDisplay).toHaveText('')
  await expect(detailsPage.tradingRuleDisplay).toHaveText('')
}

// Pick the first area habitat above V.Low distinctiveness so the content ACs
// exercise a fully-populated habitat (real broad/type/condition data); fall
// back to the first area habitat.
async function pickRichAreaHabitat(page) {
  const rows = page
    .locator('#area-habitats')
    .getByRole('table')
    .getByRole('row')
  const count = await rows.count()
  let firstRow = null
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i)
    const link = row.getByRole('link').first()
    if ((await link.count()) === 0) {
      continue
    }
    const { ref, featureId } = await refAndFeatureIdFromLink(link)
    const cells = row.getByRole('cell')
    const size = (await cells.nth(SIZE_COLUMN).textContent()).trim()
    const distinctiveness = (
      await cells.nth(DISTINCTIVENESS_COLUMN).textContent()
    ).trim()
    const candidate = { ref, featureId, size }
    if (!firstRow) {
      firstRow = candidate
    }
    if (distinctiveness && !distinctiveness.startsWith('V.Low')) {
      return candidate
    }
  }
  return firstRow
}

// Pick a linear feature (hedgerow or watercourse) from its habitat-list panel
// for the content ACs, preferring one with a saved condition so AC8a's
// "selected" value can be verified; fall back to the first. Assumes the
// feature's tab is already active (its panel is otherwise hidden).
async function pickLinearFeature(page, panelId) {
  const rows = page.locator(`#${panelId}`).getByRole('table').getByRole('row')
  const count = await rows.count()
  let firstRow = null
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i)
    const link = row.getByRole('link').first()
    if ((await link.count()) === 0) {
      continue
    }
    const { ref, featureId } = await refAndFeatureIdFromLink(link)
    const cells = row.getByRole('cell')
    // The list cell carries a "km" suffix (e.g. "0.123km"); the details page
    // shows the bare number under the "Length (km)" label, so strip the unit
    // to compare like-for-like.
    const length = (await cells.nth(SIZE_COLUMN).textContent())
      .trim()
      .replace(/km$/, '')
    const condition = (await cells.nth(CONDITION_COLUMN).textContent()).trim()
    const candidate = { ref, featureId, length }
    if (!firstRow) {
      firstRow = candidate
    }
    if (condition) {
      return candidate
    }
  }
  return firstRow
}

async function pickHedgerow(page) {
  return pickLinearFeature(page, 'hedgerows')
}

async function pickWatercourse(page) {
  return pickLinearFeature(page, 'watercourses')
}

// Some area habitats (e.g. the baseline's "N/A - Other" type) have a single
// condition option, so once the saved condition is pre-selected there is no
// alternative to choose. Walk the area habitats and return the first one that
// offers an alternative condition, so the edit-and-persist path can run. Hrefs
// are collected up front because opening each detail page navigates away from
// the list.
async function findEditableAreaHabitat(
  page,
  baselineHabitatDetailsPage,
  projectId
) {
  const links = await page.locator('#area-habitats').getByRole('link').all()
  const habitats = []
  for (const link of links) {
    const habitat = await refAndFeatureIdFromLink(link)
    if (habitat.featureId) {
      habitats.push(habitat)
    }
  }

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
  habitatListPage,
  page
}) {
  const project = await uploadAndGetProject(
    createProjectFlow,
    projectDashboardPage,
    uploadBaselineFileFlow,
    page
  )
  const area = await pickRichAreaHabitat(page)
  await habitatListPage.hedgerowsTab.click()
  const hedgerow = await pickHedgerow(page)
  await habitatListPage.watercoursesTab.click()
  const watercourse = await pickWatercourse(page)
  return { id: project.id, name: project.name, area, hedgerow, watercourse }
}

test.describe('habitat-details', { tag: '@habitat-details' }, () => {
  // ─── Query parameter validation ───────────────────────────────────────────────

  test.describe(
    'Baseline habitat details — query parameter validation',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('missing featureId query param returns 400', async ({ page }) => {
        const response = await page.goto(
          `/baseline-habitat-details?projectId=${STUB_UUID}`
        )
        expect(response.status()).toBe(HTTP_BAD_REQUEST)
      })

      test('missing projectId query param returns 400', async ({ page }) => {
        const response = await page.goto(
          `/baseline-habitat-details?featureId=${STUB_UUID}`
        )
        expect(response.status()).toBe(HTTP_BAD_REQUEST)
      })

      test('non-UUID featureId query param returns 400', async ({ page }) => {
        const response = await page.goto(
          `/baseline-habitat-details?projectId=${STUB_UUID}&featureId=not-a-uuid`
        )
        expect(response.status()).toBe(HTTP_BAD_REQUEST)
      })

      test('non-UUID projectId query param returns 400', async ({ page }) => {
        const response = await page.goto(
          `/baseline-habitat-details?projectId=not-a-uuid&featureId=${STUB_UUID}`
        )
        expect(response.status()).toBe(HTTP_BAD_REQUEST)
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

      test('navigating to a watercourse feature renders the details page', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        habitatListPage,
        baselineHabitatDetailsPage,
        page
      }) => {
        const shared = await getSharedBaseline({
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow,
          habitatListPage,
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
      })
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
        projectId = await uploadAndGetProjectId(
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow,
          page
        )
        areaFeatureId = await getFeatureIdFromTable(page, 'area-habitats')

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

      test('save area habitat selections redirects to habitat list with area anchor', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)
        await baselineHabitatDetailsPage.saveButton.click()
        await expect(page).toHaveURL(
          new RegExp(
            `/projects/${projectId}/baseline-habitat-list#habitat-${areaFeatureId}`
          )
        )
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

      function areaRow(habitatListPage) {
        return habitatListPage.areaHabitatsTable
          .getByRole('row')
          .filter({ hasText: areaRef })
      }

      // AC6 (Scenario A — all options selected): saving a changed selection
      // persists it, recalculates the habitat units + sets status Complete, and
      // returns to the Habitat List (Areas tab) with the row and the summary
      // total reflecting the new calculation.
      test('AC6 Scenario A — saving with all options selected recalculates units and sets Complete', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        baselineHabitatDetailsPage,
        habitatListPage,
        page
      }) => {
        projectId = await uploadAndGetProjectId(
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow,
          page
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
        await page.waitForURL(
          new RegExp(`/projects/${projectId}/baseline-habitat-list`)
        )

        const row = areaRow(habitatListPage)
        await expect(row.getByRole('cell').nth(CONDITION_COLUMN)).toHaveText(
          newCondition
        )
        await expect(row.getByRole('cell').nth(STATUS_COLUMN)).toHaveText(
          'Complete'
        )
        // Units recalculated for the row and reflected in the summary total.
        await expect(row.getByRole('cell').nth(UNITS_COLUMN)).toHaveText(
          HABITAT_UNITS_PATTERN
        )
        await expect(habitatListPage.areaHabitatUnitsCell).toHaveText(
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
      // the user returns to the Areas tab and the row's condition + units are
      // unchanged from before the edit (no UI or DB update).
      test('AC7 — cancelling after a change discards it and leaves the row unchanged', async ({
        baselineHabitatDetailsPage,
        habitatListPage,
        page
      }) => {
        // Capture the currently-persisted row state fresh from the list.
        await page.goto(`/projects/${projectId}/baseline-habitat-list`)
        const rowBefore = areaRow(habitatListPage)
        const conditionBefore = (
          await rowBefore.getByRole('cell').nth(CONDITION_COLUMN).textContent()
        ).trim()
        const unitsBefore = (
          await rowBefore.getByRole('cell').nth(UNITS_COLUMN).textContent()
        ).trim()

        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)
        await baselineHabitatDetailsPage.selectDifferentCondition()
        await baselineHabitatDetailsPage.cancelLink.click()
        await page.waitForURL(
          new RegExp(`/projects/${projectId}/baseline-habitat-list`)
        )

        await expect(habitatListPage.areaHabitatsTable).toBeVisible()
        const rowAfter = areaRow(habitatListPage)
        await expect(
          rowAfter.getByRole('cell').nth(CONDITION_COLUMN)
        ).toHaveText(conditionBefore)
        await expect(rowAfter.getByRole('cell').nth(UNITS_COLUMN)).toHaveText(
          unitsBefore
        )
      })

      // AC6 (Scenario B — not all options selected): saving with a dropdown
      // deselected zeroes the units and sets status Incomplete. Runs last in
      // the serial block because it leaves the shared habitat Incomplete.
      test('AC6 Scenario B — saving with a deselected dropdown zeroes units and sets Incomplete', async ({
        baselineHabitatDetailsPage,
        habitatListPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)
        await baselineHabitatDetailsPage.conditionSelect.selectOption('')
        await baselineHabitatDetailsPage.saveButton.click()
        await page.waitForURL(
          new RegExp(`/projects/${projectId}/baseline-habitat-list`)
        )

        const row = areaRow(habitatListPage)
        await expect(row.getByRole('cell').nth(STATUS_COLUMN)).toHaveText(
          'Incomplete'
        )
        await expect(row.getByRole('cell').nth(UNITS_COLUMN)).toHaveText(
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

      test('AC1 — page pathname is /baseline-habitat-details after click-through', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        habitatListPage,
        page
      }) => {
        const shared = await getSharedBaseline({
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow,
          habitatListPage,
          page
        })
        projectId = shared.id
        projectName = shared.name
        areaFeatureId = shared.area.featureId
        areaRef = shared.area.ref
        areaSize = shared.area.size

        await habitatListPage.open(projectId)
        await page
          .locator('#area-habitats')
          .getByRole('link', { name: areaRef, exact: true })
          .click()
        await expect(page).toHaveURL(/\/baseline-habitat-details/)
      })

      test('AC2 — header shows Back link, project caption, "Habitat {ref}" heading, "Baseline Details"', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)

        await expect(baselineHabitatDetailsPage.backLink).toBeVisible()
        await expect(page.getByText(projectName)).toBeVisible()
        await expect(baselineHabitatDetailsPage.heading).toHaveText(
          `Habitat ${areaRef}`
        )
        await expect(
          baselineHabitatDetailsPage.baselineDetailsHeading
        ).toBeVisible()
      })

      test('AC3 — Reference label and the saved reference value are displayed', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)

        await expect(baselineHabitatDetailsPage.referenceKey).toBeVisible()
        // Exact match scopes this to the Reference row value, not the
        // "Habitat {ref}" page heading.
        await expect(page.getByText(areaRef, { exact: true })).toBeVisible()
      })

      test('AC4 — Area (hectares) label and the value carried from the list are displayed', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)

        await expect(
          page.getByText('Area (hectares)', { exact: true })
        ).toBeVisible()
        await expect(page.getByText(areaSize, { exact: true })).toBeVisible()
      })

      test('AC5a — Broad habitat dropdown shows the saved value as selected', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)

        await expect(
          baselineHabitatDetailsPage.broadHabitatSelect
        ).toBeVisible()
        expect(
          await baselineHabitatDetailsPage.broadHabitatSelect.inputValue()
        ).not.toBe('')
      })

      test('AC5b — Broad habitat options start with the default and are sorted ascending', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)
        const texts = await optionTexts(
          baselineHabitatDetailsPage.broadHabitatSelect
        )

        expect(texts[0]).toBe('Choose broad habitat')
        expect(isSortedAscending(texts.slice(1))).toBe(true)
      })

      test('AC6a — Habitat type dropdown shows the saved value as selected', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)

        await expect(baselineHabitatDetailsPage.habitatTypeSelect).toBeVisible()
        expect(
          await baselineHabitatDetailsPage.habitatTypeSelect.inputValue()
        ).not.toBe('')
      })

      test('AC6b — Habitat type options start with the default and are sorted ascending', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)
        const texts = await optionTexts(
          baselineHabitatDetailsPage.habitatTypeSelect
        )

        expect(texts[0]).toBe('Choose habitat type')
        expect(texts.length).toBeGreaterThan(1)
        expect(isSortedAscending(texts.slice(1))).toBe(true)
      })

      test('AC7 — Distinctiveness shows the band and score', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)

        await expect(
          baselineHabitatDetailsPage.distinctivenessKey
        ).toBeVisible()
        await expect(
          page.getByText(DISTINCTIVENESS_PATTERN).first()
        ).toBeVisible()
      })

      test('AC8a — Condition dropdown shows the saved condition as selected', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)

        await expect(baselineHabitatDetailsPage.conditionSelect).toBeVisible()
        expect(
          await baselineHabitatDetailsPage.conditionSelect.inputValue()
        ).not.toBe('')
      })

      test('AC8b — Condition options start with the default and are ordered by score descending', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)
        const texts = await optionTexts(
          baselineHabitatDetailsPage.conditionSelect
        )

        expect(texts[0]).toBe('Choose condition')
        const scores = conditionScores(texts.slice(1))
        expect(scores.length).toBeGreaterThan(0)
        expect(scores).toEqual([...scores].sort((a, b) => b - a))
      })

      test('AC10 — "Required action to meet trading rules" label is displayed', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)

        await expect(baselineHabitatDetailsPage.tradingRulesKey).toBeVisible()
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

      test('AC11 — "Units in this habitat" label is displayed', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)

        await expect(baselineHabitatDetailsPage.habitatUnitsKey).toBeVisible()
      })

      test('AC14 — Back link returns to the habitat list Areas tab', async ({
        baselineHabitatDetailsPage,
        habitatListPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)
        await baselineHabitatDetailsPage.backLink.click()

        await expect(page).toHaveURL(
          new RegExp(`/projects/${projectId}/baseline-habitat-list`)
        )
        await expect(habitatListPage.areaHabitatsTable).toBeVisible()
      })

      test('AC15 — Cancel link returns to the habitat list Areas tab anchored to the habitat', async ({
        baselineHabitatDetailsPage,
        habitatListPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)
        await baselineHabitatDetailsPage.cancelLink.click()

        await expect(page).toHaveURL(
          new RegExp(
            `/projects/${projectId}/baseline-habitat-list#habitat-${areaFeatureId}`
          )
        )
        await expect(habitatListPage.areaHabitatsTable).toBeVisible()
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
        habitatListPage,
        page
      }) => {
        projectId = await uploadAndGetProjectId(
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow,
          page
        )
        // The Hedgerows panel is hidden by GOV.UK Tabs JS until the tab is clicked;
        // clicking first makes the links visible so getByRole can find them.
        await habitatListPage.hedgerowsTab.click()
        hedgerowFeatureId = await getFeatureIdFromTable(page, 'hedgerows')

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

      test('save hedgerow selections redirects to habitat list with hedgerows anchor', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)
        await baselineHabitatDetailsPage.saveButton.click()
        await expect(page).toHaveURL(
          new RegExp(`/projects/${projectId}/baseline-habitat-list#hedgerows`)
        )
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

      function hedgerowRow(habitatListPage) {
        return habitatListPage.hedgerowsTable
          .getByRole('row')
          .filter({ hasText: hedgerowRef })
      }

      // AC6 (Scenario A — all options selected): saving a changed selection
      // persists it, recalculates the hedgerow units + sets status Complete, and
      // returns to the Habitat List (Hedgerows tab) with the row and the summary
      // total reflecting the new calculation.
      test('AC6 Scenario A — saving with all options selected recalculates units and sets Complete', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        baselineHabitatDetailsPage,
        habitatListPage,
        page
      }) => {
        projectId = await uploadAndGetProjectId(
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow,
          page
        )
        // The Hedgerows panel is hidden by GOV.UK Tabs JS until the tab is clicked;
        // clicking first makes the links visible so getByRole can find them.
        await habitatListPage.hedgerowsTab.click()
        const hedgerow = await getRowRefAndFeatureId(page, 'hedgerows')
        hedgerowFeatureId = hedgerow.featureId
        hedgerowRef = hedgerow.ref

        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)
        const newCondition =
          await baselineHabitatDetailsPage.selectDifferentCondition()
        await baselineHabitatDetailsPage.saveButton.click()
        await page.waitForURL(
          new RegExp(`/projects/${projectId}/baseline-habitat-list`)
        )

        await habitatListPage.hedgerowsTab.click()
        const row = hedgerowRow(habitatListPage)
        await expect(row.getByRole('cell').nth(CONDITION_COLUMN)).toHaveText(
          newCondition
        )
        await expect(row.getByRole('cell').nth(STATUS_COLUMN)).toHaveText(
          'Complete'
        )
        // Units recalculated for the row and reflected in the summary total.
        await expect(row.getByRole('cell').nth(UNITS_COLUMN)).toHaveText(
          HABITAT_UNITS_PATTERN
        )
        await expect(habitatListPage.hedgerowUnitsCell).toHaveText(
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
      // user returns to the Hedgerows tab and the row's condition + units are
      // unchanged from before the edit (no UI or DB update).
      test('AC7 — cancelling after a change discards it and leaves the row unchanged', async ({
        baselineHabitatDetailsPage,
        habitatListPage,
        page
      }) => {
        // Capture the currently-persisted row state fresh from the list.
        await page.goto(`/projects/${projectId}/baseline-habitat-list`)
        await habitatListPage.hedgerowsTab.click()
        const rowBefore = hedgerowRow(habitatListPage)
        const conditionBefore = (
          await rowBefore.getByRole('cell').nth(CONDITION_COLUMN).textContent()
        ).trim()
        const unitsBefore = (
          await rowBefore.getByRole('cell').nth(UNITS_COLUMN).textContent()
        ).trim()

        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)
        await baselineHabitatDetailsPage.selectDifferentCondition()
        await baselineHabitatDetailsPage.cancelLink.click()
        await page.waitForURL(
          new RegExp(`/projects/${projectId}/baseline-habitat-list#hedgerows`)
        )

        await habitatListPage.hedgerowsTab.click()
        const rowAfter = hedgerowRow(habitatListPage)
        await expect(
          rowAfter.getByRole('cell').nth(CONDITION_COLUMN)
        ).toHaveText(conditionBefore)
        await expect(rowAfter.getByRole('cell').nth(UNITS_COLUMN)).toHaveText(
          unitsBefore
        )
      })

      // AC6 (Scenario B — not all options selected): saving with the condition
      // deselected zeroes the units and sets status Incomplete. Runs last in the
      // serial block because it leaves the shared hedgerow Incomplete.
      test('AC6 Scenario B — saving with a deselected dropdown zeroes units and sets Incomplete', async ({
        baselineHabitatDetailsPage,
        habitatListPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)
        await baselineHabitatDetailsPage.conditionSelect.selectOption('')
        await baselineHabitatDetailsPage.saveButton.click()
        await page.waitForURL(
          new RegExp(`/projects/${projectId}/baseline-habitat-list`)
        )

        await habitatListPage.hedgerowsTab.click()
        const row = hedgerowRow(habitatListPage)
        await expect(row.getByRole('cell').nth(STATUS_COLUMN)).toHaveText(
          'Incomplete'
        )
        await expect(row.getByRole('cell').nth(UNITS_COLUMN)).toHaveText(
          ZERO_UNITS
        )
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
        habitatListPage,
        page
      }) => {
        const shared = await getSharedBaseline({
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow,
          habitatListPage,
          page
        })
        projectId = shared.id
        projectName = shared.name
        hedgerowFeatureId = shared.hedgerow.featureId
        hedgerowRef = shared.hedgerow.ref
        hedgerowLength = shared.hedgerow.length

        await habitatListPage.open(projectId)
        await habitatListPage.hedgerowsTab.click()
        await page
          .locator('#hedgerows')
          .getByRole('link', { name: hedgerowRef, exact: true })
          .click()
        await expect(page).toHaveURL(/\/baseline-habitat-details/)
      })

      test('AC2 — header shows Back link, project caption, "Hedgerow {ref}" heading, "Baseline Details"', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)

        await expect(baselineHabitatDetailsPage.backLink).toBeVisible()
        await expect(page.getByText(projectName)).toBeVisible()
        await expect(baselineHabitatDetailsPage.heading).toHaveText(
          `Hedgerow ${hedgerowRef}`
        )
        await expect(
          baselineHabitatDetailsPage.baselineDetailsHeading
        ).toBeVisible()
      })

      test('AC3 — Reference label and the saved reference value are displayed', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)

        await expect(baselineHabitatDetailsPage.referenceKey).toBeVisible()
        // Exact match scopes this to the Reference row value, not the
        // "Hedgerow {ref}" page heading.
        await expect(page.getByText(hedgerowRef, { exact: true })).toBeVisible()
      })

      test('AC4 — Length (km) label and the value carried from the list are displayed', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)

        await expect(
          page.getByText('Length (km)', { exact: true })
        ).toBeVisible()
        await expect(
          page.getByText(hedgerowLength, { exact: true })
        ).toBeVisible()
      })

      test('AC6a — Habitat type dropdown shows the saved value as selected', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)

        await expect(baselineHabitatDetailsPage.habitatTypeSelect).toBeVisible()
        expect(
          await baselineHabitatDetailsPage.habitatTypeSelect.inputValue()
        ).not.toBe('')
      })

      test('AC6b — Habitat type options start with the default and are sorted ascending', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)
        const texts = await optionTexts(
          baselineHabitatDetailsPage.habitatTypeSelect
        )

        expect(texts[0]).toBe('Choose habitat type')
        expect(texts.length).toBeGreaterThan(1)
        expect(isSortedAscending(texts.slice(1))).toBe(true)
      })

      test('AC7 — Distinctiveness shows the band and score', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)

        await expect(
          baselineHabitatDetailsPage.distinctivenessKey
        ).toBeVisible()
        await expect(
          page.getByText(DISTINCTIVENESS_PATTERN).first()
        ).toBeVisible()
      })

      test('AC8a — Condition dropdown shows the saved condition as selected', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)

        await expect(baselineHabitatDetailsPage.conditionSelect).toBeVisible()
        expect(
          await baselineHabitatDetailsPage.conditionSelect.inputValue()
        ).not.toBe('')
      })

      test('AC8b — Condition options start with the default and are ordered by score descending', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)
        const texts = await optionTexts(
          baselineHabitatDetailsPage.conditionSelect
        )

        expect(texts[0]).toBe('Choose condition')
        const scores = conditionScores(texts.slice(1))
        expect(scores.length).toBeGreaterThan(0)
        expect(scores).toEqual([...scores].sort((a, b) => b - a))
      })

      test('AC9 — Strategic Significance shows the fixed "Low (1)" value', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)

        await expect(
          baselineHabitatDetailsPage.strategicSignificanceKey
        ).toBeVisible()
        await expect(
          baselineHabitatDetailsPage.strategicSignificanceValue
        ).toBeVisible()
      })

      test('AC10 — "Required action to meet trading rules" label is displayed', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)

        await expect(baselineHabitatDetailsPage.tradingRulesKey).toBeVisible()
      })

      test('AC11 — "Units in this habitat" label is displayed', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)

        await expect(baselineHabitatDetailsPage.habitatUnitsKey).toBeVisible()
      })

      test('AC14 — Back link returns to the habitat list Hedgerows tab', async ({
        baselineHabitatDetailsPage,
        habitatListPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)
        await baselineHabitatDetailsPage.backLink.click()

        await expect(page).toHaveURL(
          new RegExp(`/projects/${projectId}/baseline-habitat-list#hedgerows`)
        )
        await expect(habitatListPage.hedgerowsTable).toBeVisible()
      })

      test('AC15 — Cancel link returns to the habitat list Hedgerows tab', async ({
        baselineHabitatDetailsPage,
        habitatListPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, hedgerowFeatureId)
        await baselineHabitatDetailsPage.cancelLink.click()

        await expect(page).toHaveURL(
          new RegExp(`/projects/${projectId}/baseline-habitat-list#hedgerows`)
        )
        await expect(habitatListPage.hedgerowsTable).toBeVisible()
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
        habitatListPage,
        page
      }) => {
        const shared = await getSharedBaseline({
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow,
          habitatListPage,
          page
        })
        projectId = shared.id
        projectName = shared.name
        watercourseFeatureId = shared.watercourse.featureId
        watercourseRef = shared.watercourse.ref
        watercourseLength = shared.watercourse.length

        await habitatListPage.open(projectId)
        await habitatListPage.watercoursesTab.click()
        await page
          .locator('#watercourses')
          .getByRole('link', { name: watercourseRef, exact: true })
          .click()
        await expect(page).toHaveURL(/\/baseline-habitat-details/)
      })

      test('AC2 — header shows Back link, project caption, "Watercourse {ref}" heading, "Baseline Details"', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)

        await expect(baselineHabitatDetailsPage.backLink).toBeVisible()
        await expect(page.getByText(projectName)).toBeVisible()
        await expect(baselineHabitatDetailsPage.heading).toHaveText(
          `Watercourse ${watercourseRef}`
        )
        await expect(
          baselineHabitatDetailsPage.baselineDetailsHeading
        ).toBeVisible()
      })

      test('AC3 — Reference label and the saved reference value are displayed', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)

        await expect(baselineHabitatDetailsPage.referenceKey).toBeVisible()
        await expect(
          page.getByText(watercourseRef, { exact: true })
        ).toBeVisible()
      })

      test('AC4 — Length (km) label and the value carried from the list are displayed', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)

        await expect(
          page.getByText('Length (km)', { exact: true })
        ).toBeVisible()
        await expect(
          page.getByText(watercourseLength, { exact: true })
        ).toBeVisible()
      })

      test('AC5 — Broad habitat dropdown is not rendered for watercourses', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)

        await expect(baselineHabitatDetailsPage.broadHabitatSelect).toHaveCount(
          0
        )
      })

      test('AC6a — Habitat type dropdown shows the saved value as selected', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)

        await expect(baselineHabitatDetailsPage.habitatTypeSelect).toBeVisible()
        expect(
          await baselineHabitatDetailsPage.habitatTypeSelect.inputValue()
        ).not.toBe('')
      })

      test('AC6b — Habitat type options start with the default and are sorted ascending', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)
        const texts = await optionTexts(
          baselineHabitatDetailsPage.habitatTypeSelect
        )

        expect(texts[0]).toBe('Choose habitat type')
        expect(texts.length).toBeGreaterThan(1)
        expect(isSortedAscending(texts.slice(1))).toBe(true)
      })

      test('AC7 — Distinctiveness shows the band and score', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)

        await expect(
          baselineHabitatDetailsPage.distinctivenessKey
        ).toBeVisible()
        await expect(
          page.getByText(DISTINCTIVENESS_PATTERN).first()
        ).toBeVisible()
      })

      test('AC8a — Condition dropdown shows the saved condition as selected', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)

        await expect(baselineHabitatDetailsPage.conditionSelect).toBeVisible()
        expect(
          await baselineHabitatDetailsPage.conditionSelect.inputValue()
        ).not.toBe('')
      })

      test('AC8b — Condition options start with the default and are ordered by score descending', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)
        const texts = await optionTexts(
          baselineHabitatDetailsPage.conditionSelect
        )

        expect(texts[0]).toBe('Choose condition')
        const scores = conditionScores(texts.slice(1))
        expect(scores.length).toBeGreaterThan(0)
        expect(scores).toEqual([...scores].sort((a, b) => b - a))
      })

      test('AC9 — Strategic Significance shows the fixed "Low (1)" value', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)

        await expect(
          baselineHabitatDetailsPage.strategicSignificanceKey
        ).toBeVisible()
        await expect(
          baselineHabitatDetailsPage.strategicSignificanceValue
        ).toBeVisible()
      })

      test('AC10 — "Required action to meet trading rules" label is displayed', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)

        await expect(baselineHabitatDetailsPage.tradingRulesKey).toBeVisible()
      })

      test('AC11 — "Units in this habitat" label is displayed', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)

        await expect(baselineHabitatDetailsPage.habitatUnitsKey).toBeVisible()
      })

      test('ACW — Watercourse encroachment dropdown shows the default and options', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)
        await expect(
          baselineHabitatDetailsPage.watercourseEncroachmentSelect
        ).toBeVisible()
        const texts = await optionTexts(
          baselineHabitatDetailsPage.watercourseEncroachmentSelect
        )

        expect(texts[0]).toBe('Choose watercourse encroachment')
        expect(texts.length).toBeGreaterThan(1)
      })

      test('ACR — Riparian encroachment dropdown shows the default and options', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)
        await expect(
          baselineHabitatDetailsPage.riparianEncroachmentSelect
        ).toBeVisible()
        const texts = await optionTexts(
          baselineHabitatDetailsPage.riparianEncroachmentSelect
        )

        expect(texts[0]).toBe('Choose riparian encroachment')
        expect(texts.length).toBeGreaterThan(1)
      })

      test('Encroachment order — Watercourse encroachment is shown before Riparian encroachment', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)
        const rowKeys = (await page.getByRole('term').allTextContents()).map(
          (t) => t.trim()
        )
        const watercourseIdx = rowKeys.indexOf('Watercourse encroachment')
        const riparianIdx = rowKeys.indexOf('Riparian encroachment')

        expect(watercourseIdx).toBeGreaterThan(-1)
        expect(riparianIdx).toBeGreaterThan(-1)
        expect(watercourseIdx).toBeLessThan(riparianIdx)
      })

      test('AC12 — Save button is displayed', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)
        await expect(baselineHabitatDetailsPage.saveButton).toBeVisible()
      })

      test('AC13 — Cancel link is displayed', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)
        await expect(baselineHabitatDetailsPage.cancelLink).toBeVisible()
      })

      test('AC14 — Back link returns to the habitat list Watercourses tab', async ({
        baselineHabitatDetailsPage,
        habitatListPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)
        await baselineHabitatDetailsPage.backLink.click()

        await expect(page).toHaveURL(
          new RegExp(
            `/projects/${projectId}/baseline-habitat-list#watercourses`
          )
        )
        await expect(habitatListPage.watercoursesTable).toBeVisible()
      })

      test('AC15 — Cancel link returns to the habitat list Watercourses tab', async ({
        baselineHabitatDetailsPage,
        habitatListPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)
        await baselineHabitatDetailsPage.cancelLink.click()

        await expect(page).toHaveURL(
          new RegExp(
            `/projects/${projectId}/baseline-habitat-list#watercourses`
          )
        )
        await expect(habitatListPage.watercoursesTable).toBeVisible()
      })

      test('Save on a watercourse returns 502 (editing unsupported)', async ({
        baselineHabitatDetailsPage,
        page
      }) => {
        await baselineHabitatDetailsPage.open(projectId, watercourseFeatureId)

        // The backend rejects watercourse PUTs (feature type not editable -> 400),
        // which the frontend surfaces as a 502 Bad Gateway.
        const [response] = await Promise.all([
          page.waitForResponse(
            (r) =>
              r.url().includes('/baseline-habitat-details') &&
              r.request().method() === 'POST'
          ),
          baselineHabitatDetailsPage.saveButton.click()
        ])
        expect(response.status()).toBe(HTTP_BAD_GATEWAY)
      })
    }
  )
})
