import { test, expect } from '@fixtures'
import { STORAGE_STATE, NO_ROLE_STORAGE_STATE } from '@utils/env.js'

const HTTP_BAD_REQUEST = 400

// ─── Sort order ───────────────────────────────────────────────────────────────

test.describe('Project dashboard — default sort order', () => {
  test.use({ storageState: STORAGE_STATE })

  test('projects are sorted by last modified descending', async ({
    createProjectFlow,
    page
  }) => {
    const nameA = `Sort-A ${Date.now()}`
    await createProjectFlow.createProject(nameA)

    const nameB = `Sort-B ${Date.now()}`
    await createProjectFlow.createProject(nameB)

    const projectLinks = page.getByTestId('projects-table').getByRole('link')
    const names = await projectLinks.allTextContents()
    const indexA = names.findIndex((n) => n.includes('Sort-A'))
    const indexB = names.findIndex((n) => n.includes('Sort-B'))
    expect(indexB).toBeLessThan(indexA)
  })
})

// ─── Role enforcement ─────────────────────────────────────────────────────────

test.describe('Project dashboard — role enforcement', () => {
  test.use({ storageState: NO_ROLE_STORAGE_STATE })

  test('authenticated user without bng completer role is redirected to /auth/forbidden', async ({
    page
  }) => {
    await page.goto('/project-dashboard')

    await expect(page).toHaveURL(/\/auth\/forbidden/)
  })

  test('authenticated user without bng completer role visiting task list is redirected to /auth/forbidden', async ({
    page
  }) => {
    await page.goto('/project-task-list/00000000-0000-0000-0000-000000000000')

    await expect(page).toHaveURL(/\/auth\/forbidden/)
  })
})

// ─── Route parameter validation ───────────────────────────────────────────────

test.describe('Project task list — invalid route parameter', () => {
  test.use({ storageState: STORAGE_STATE })

  test('non-UUID id path param returns 400', async ({ page }) => {
    const response = await page.goto('/project-task-list/not-a-uuid')

    expect(response.status()).toBe(HTTP_BAD_REQUEST)
  })
})

// ─── Backend error ────────────────────────────────────────────────────────────

test.describe('Project dashboard — backend error', () => {
  test.use({ storageState: STORAGE_STATE })

  test.skip('backend error ≥ 400 on GET /users/{userId}/projects renders an error page', async () => {
    // The frontend calls GET /users/{userId}/projects server-side via wreck.
    // Playwright page.route() only intercepts browser-initiated requests, so
    // this backend call cannot be mocked at the E2E layer. A network-level
    // proxy or a test-specific backend stub endpoint is needed to reproduce
    // this path reliably.
  })
})
