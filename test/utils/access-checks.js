import { test, expect } from '@fixtures'
import { NO_ROLE_STORAGE_STATE, runMode } from './env.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const STUB_PROJECT_ID = '00000000-0000-0000-0000-000000000000'

export function describeRoleEnforcement(label, route, { smoke = false } = {}) {
  const url = `/projects/${STUB_PROJECT_ID}/${route}`
  test.describe(`${label} — role enforcement`, () => {
    test.use({ storageState: NO_ROLE_STORAGE_STATE })
    test.skip(runMode === 'e2e', E2E_SKIP_REASON)
    test(
      'authenticated user without BNG Completer role is redirected to /auth/forbidden',
      { tag: smoke ? '@smoke' : undefined },
      async ({ page }) => {
        await page.goto(url)
        await expect(page).toHaveURL(/\/auth\/forbidden/)
      }
    )
  })
}

export function describeUnauthenticatedAccess(
  label,
  route,
  { smoke = true } = {}
) {
  const url = `/projects/${STUB_PROJECT_ID}/${route}`
  test.describe(`${label} — unauthenticated access`, () => {
    test(
      `GET /projects/{id}/${route} redirects to sign-in`,
      { tag: smoke ? '@smoke' : undefined },
      async ({ page }) => {
        await page.goto(url)
        await expect(page).not.toHaveURL(new RegExp(`/${route}`))
        await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
      }
    )
  })
}
