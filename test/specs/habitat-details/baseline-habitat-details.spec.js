import { test, expect } from '@fixtures'
import { STORAGE_STATE, NO_ROLE_STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const HTTP_OK = 200
const HTTP_BAD_REQUEST = 400
const HTTP_NOT_FOUND = 404
const HTTP_SERVER_ERROR = 500
const STUB_UUID = '00000000-0000-0000-0000-000000000000'
const VALID_UUID_V4 = 'aaaaaaaa-bbbb-4ccc-bddd-eeeeeeeeeeee'
const STUB_HABITAT_TYPE = 'Grassland - Modified grassland'
const UPLOAD_TIMEOUT = 120_000
const COMPLETE_BASELINE_FILE = 'Baseline - complete with area refs.gpkg'
const PROJECT_LABEL = 'Habitat details test'

// Habitat-list table column order (buildHabitatRow): ref, type, size,
// distinctiveness, condition, units, status.
const CONDITION_COLUMN = 4
const STATUS_COLUMN = 6

async function uploadAndGetProjectId(
  createProjectFlow,
  projectDashboardPage,
  uploadBaselineFileFlow,
  page
) {
  const { id } = await setupProject(
    createProjectFlow,
    projectDashboardPage,
    PROJECT_LABEL
  )
  await uploadBaselineFileFlow.uploadFile(id, COMPLETE_BASELINE_FILE)
  await page.waitForURL(new RegExp(`/projects/${id}/baseline-habitat-list`), {
    timeout: UPLOAD_TIMEOUT
  })
  return id
}

async function getRowRefAndFeatureId(page, panelId) {
  const link = page.locator(`#${panelId}`).getByRole('link').first()
  const href = await link.getAttribute('href')
  const featureId = new URL(href, 'http://localhost').searchParams.get(
    'featureId'
  )
  const ref = (await link.textContent()).trim()
  return { ref, featureId }
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

  // ─── Watercourse not editable ────────────────────────────────────────────────

  test.describe(
    'Baseline habitat details — watercourse not editable',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('navigating to a watercourse feature returns 500', async ({
        createProjectFlow,
        projectDashboardPage,
        uploadBaselineFileFlow,
        habitatListPage,
        page
      }) => {
        const projectId = await uploadAndGetProjectId(
          createProjectFlow,
          projectDashboardPage,
          uploadBaselineFileFlow,
          page
        )
        // The Watercourses panel is hidden by GOV.UK Tabs JS until clicked.
        await habitatListPage.watercoursesTab.click()
        const featureId = await getFeatureIdFromTable(page, 'watercourses')

        const response = await page.goto(
          `/baseline-habitat-details?projectId=${projectId}&featureId=${featureId}`
        )
        expect(response.status()).toBe(HTTP_SERVER_ERROR)
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
      const response = await page.goto(conditionsProxyUrl(STUB_HABITAT_TYPE))
      expect(response.status()).toBe(HTTP_OK)
      const body = await response.json()
      expect(Array.isArray(body)).toBe(true)
      expect(body.length).toBeGreaterThan(0)
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
      test.describe.configure({ mode: 'serial' })

      let projectId
      let areaFeatureId
      let areaRef

      test('changing the condition and saving persists the new value on the habitat list', async ({
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
        const area = await getRowRefAndFeatureId(page, 'area-habitats')
        areaFeatureId = area.featureId
        areaRef = area.ref

        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)
        const newCondition =
          await baselineHabitatDetailsPage.selectDifferentCondition()
        await baselineHabitatDetailsPage.saveButton.click()
        await page.waitForURL(
          new RegExp(`/projects/${projectId}/baseline-habitat-list`)
        )

        const row = habitatListPage.areaHabitatsTable
          .getByRole('row')
          .filter({ hasText: areaRef })
        await expect(row.getByRole('cell').nth(CONDITION_COLUMN)).toHaveText(
          newCondition
        )
        await expect(row.getByRole('cell').nth(STATUS_COLUMN)).toHaveText(
          'Complete'
        )
      })

      test('changing the habitat type refreshes the condition options', async ({
        baselineHabitatDetailsPage
      }) => {
        await baselineHabitatDetailsPage.open(projectId, areaFeatureId)
        const before = await baselineHabitatDetailsPage.conditionOptionValues()

        await baselineHabitatDetailsPage.selectDifferentHabitatType()

        // The client JS fetches conditions for the new type via the proxy and
        // repopulates the Condition select, so the option set changes.
        await expect
          .poll(() => baselineHabitatDetailsPage.conditionOptionValues())
          .not.toEqual(before)
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
})
