import { test, expect } from '@fixtures'
import { STORAGE_STATE, NO_ROLE_STORAGE_STATE, runMode } from '@utils/env.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const HTTP_BAD_REQUEST = 400
const HTTP_NOT_FOUND = 404
const STUB_UUID = '00000000-0000-0000-0000-000000000000'
const VALID_UUID_V4 = 'aaaaaaaa-bbbb-4ccc-bddd-eeeeeeeeeeee'
const STUB_HABITAT_TYPE = 'Grassland - Modified grassland'

test.describe('upload-baseline', { tag: '@upload-baseline' }, () => {
  // ─── Query parameter validation ───────────────────────────────────────────────

  test.describe('Baseline habitat details — query parameter validation', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test('missing habitatId query param returns 400', async ({ page }) => {
      const response = await page.goto(
        `/baseline-habitat-details?projectId=${STUB_UUID}`
      )
      expect(response.status()).toBe(HTTP_BAD_REQUEST)
    })

    test('missing projectId query param returns 400', async ({ page }) => {
      const response = await page.goto(
        `/baseline-habitat-details?habitatId=${STUB_UUID}`
      )
      expect(response.status()).toBe(HTTP_BAD_REQUEST)
    })

    test('non-UUID habitatId query param returns 400', async ({ page }) => {
      const response = await page.goto(
        `/baseline-habitat-details?projectId=${STUB_UUID}&habitatId=not-a-uuid`
      )
      expect(response.status()).toBe(HTTP_BAD_REQUEST)
    })

    test('non-UUID projectId query param returns 400', async ({ page }) => {
      const response = await page.goto(
        `/baseline-habitat-details?projectId=not-a-uuid&habitatId=${STUB_UUID}`
      )
      expect(response.status()).toBe(HTTP_BAD_REQUEST)
    })
  })

  // ─── Habitat not found ───────────────────────────────────────────────────────

  test.describe('Baseline habitat details — habitat not found', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test('valid UUIDs for non-existent habitat returns 404', async ({
      page
    }) => {
      const response = await page.goto(
        `/baseline-habitat-details?projectId=${VALID_UUID_V4}&habitatId=${VALID_UUID_V4}`
      )
      expect(response.status()).toBe(HTTP_NOT_FOUND)
    })
  })

  // ─── Role enforcement ────────────────────────────────────────────────────────

  test.describe('Baseline habitat details — role enforcement', () => {
    test.use({ storageState: NO_ROLE_STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test(
      'authenticated user without BNG Completer role is redirected to /auth/forbidden',
      { tag: '@smoke' },
      async ({ page }) => {
        await page.goto(
          `/baseline-habitat-details?projectId=${STUB_UUID}&habitatId=${STUB_UUID}`
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
          `/baseline-habitat-details?projectId=${STUB_UUID}&habitatId=${STUB_UUID}`
        )
        await expect(page).not.toHaveURL(/\/baseline-habitat-details/)
        await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
      }
    )
  })

  // ─── Conditions proxy — query parameter validation ───────────────────────────

  test.describe('Conditions proxy — query parameter validation', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test('missing habitatType query param returns 400', async ({ page }) => {
      const response = await page.goto('/api/reference/conditions')
      expect(response.status()).toBe(HTTP_BAD_REQUEST)
    })
  })

  // ─── Conditions proxy — role enforcement ─────────────────────────────────────

  test.describe('Conditions proxy — role enforcement', () => {
    test.use({ storageState: NO_ROLE_STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)

    test(
      'authenticated user without BNG Completer role is redirected to /auth/forbidden',
      { tag: '@smoke' },
      async ({ page }) => {
        await page.goto(
          `/api/reference/conditions?habitatType=${encodeURIComponent(STUB_HABITAT_TYPE)}`
        )
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
        await page.goto(
          `/api/reference/conditions?habitatType=${encodeURIComponent(STUB_HABITAT_TYPE)}`
        )
        await expect(page).not.toHaveURL(/\/api\/reference\/conditions/)
        await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
      }
    )
  })
})
