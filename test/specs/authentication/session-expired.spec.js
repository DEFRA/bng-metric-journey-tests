import { test, expect } from '@fixtures'

test.describe('authentication', { tag: '@authentication' }, () => {
  // ─── Page content ────────────────────────────────────────────────────────────
  // /auth/session-expired is a public GET (no session) — the page an
  // expired-then-ended session is redirected to. It is distinct from
  // /auth/forbidden: it offers a "Sign in again" button rather than a plain
  // access-denied message. Asserted directly here, independently of the expiry
  // redirect (which is blocked — see below).

  test.describe(
    'Session expired page — page content',
    { tag: '@smoke' },
    () => {
      test('renders the signed-out message with heading, body, sign-in button and return link', async ({
        sessionExpiredPage,
        page
      }) => {
        await sessionExpiredPage.open()

        await expect(page).toHaveTitle(
          'You have been signed out - Biodiversity Net Gain'
        )
        await expect(sessionExpiredPage.heading).toBeVisible()
        await expect(sessionExpiredPage.body).toBeVisible()
        await expect(sessionExpiredPage.signInAgainButton).toBeVisible()
        await expect(sessionExpiredPage.signInAgainButton).toHaveAttribute(
          'href',
          '/auth/login'
        )
        await expect(sessionExpiredPage.returnHomeLink).toBeVisible()
      })
    }
  )

  // ─── Navigation ──────────────────────────────────────────────────────────────

  test.describe(
    'Session expired page — navigation',
    { tag: '@regression' },
    () => {
      test('"Sign in again" button navigates to /auth/login', async ({
        sessionExpiredPage,
        page
      }) => {
        await sessionExpiredPage.open()
        await sessionExpiredPage.signInAgainButton.click()

        // /auth/login initiates the OIDC authorization code flow and redirects
        // straight out to the identity provider, so we assert the browser leaves
        // /auth/session-expired rather than landing on an in-service page.
        await expect(page).not.toHaveURL(/\/auth\/session-expired/)
      })

      test('return link navigates to the home page', async ({
        sessionExpiredPage,
        page
      }) => {
        await sessionExpiredPage.open()
        await sessionExpiredPage.returnHomeLink.click()

        await expect(page).toHaveTitle('Home - Biodiversity Net Gain')
      })
    }
  )

  // ─── Interactive session-expired redirect ───────────────────────────────────
  // Covered in test/specs/resilience/session-expiry.spec.js, which signs in a
  // throwaway user and expires that user's session in Redis. Expiring the shared
  // STORAGE_STATE session here would sign out every later test in the run.
})
