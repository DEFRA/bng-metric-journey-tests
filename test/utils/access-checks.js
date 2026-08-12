import { test, expect } from '@fixtures'
import { NO_ROLE_STORAGE_STATE, skipInE2e } from './env.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const STUB_PROJECT_ID = '00000000-0000-0000-0000-000000000000'

/**
 * Assert an authenticated user without the BNG Completer role is bounced to
 * /auth/forbidden.
 *
 * Pass `projectId` for any route whose `{id}` param is validated as a **uuidv4**
 * (e.g. `upload-file`, `baseline-habitat-list`). Hapi runs route validation
 * *before* `pre` handlers, so the all-zeros default — which is a valid UUID but
 * not a v4 one — would 400 on those routes before the role gate ever fires, and
 * the test would pass or fail for the wrong reason.
 */
export function describeRoleEnforcement(
  label,
  route,
  { smoke = false, projectId = STUB_PROJECT_ID } = {}
) {
  const url = `/projects/${projectId}/${route}`
  test.describe(`${label} — role enforcement`, () => {
    test.use({ storageState: NO_ROLE_STORAGE_STATE })
    test.skip(skipInE2e(NO_ROLE_STORAGE_STATE), E2E_SKIP_REASON)
    test(
      'authenticated user without BNG Completer role is redirected to /auth/forbidden',
      { tag: smoke ? '@smoke' : '@regression' },
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
      { tag: smoke ? '@smoke' : '@regression' },
      async ({ page }) => {
        await page.goto(url)
        await expect(page).not.toHaveURL(new RegExp(`/${route}`))
        await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
      }
    )
  })
}
