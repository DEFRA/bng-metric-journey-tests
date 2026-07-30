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

  // ─── Blocked: interactive session-expired redirect ───────────────────────────
  // The auth scheme (auth-scheme.js) redirects an authenticated user to
  // /auth/session-expired when their tokens expire and the silent refresh fails
  // (or succeeds but the renewed token has lost the approved role). Reproducing
  // live token expiry requires expireSession()'s yar.reset(), which tears down
  // the SHARED completer STORAGE_STATE server-side and cascades failures across
  // every other authenticated test in the run — the same constraint as the
  // interactive sign-out click-through.
  //
  // NOTE: session-timeout.spec.js clears the session cookie CLIENT-side, which
  // leaves no `sessionEnded` breadcrumb and so redirects to /auth/forbidden, not
  // here — it does NOT cover this path.
  //
  // Unblock: mint a dedicated throwaway completer session in auth.setup.js (so
  // resetting it cannot affect other tests), or add a stub hook to expire a
  // single session's tokens, then assert the protected-route redirect to
  // /auth/session-expired and the "Sign in again" round-trip.
  test.skip('expired session on a protected route redirects to /auth/session-expired', async ({
    page
  }) => {
    // Ready-to-run once a disposable expired session exists:
    // await page.goto('/manage-projects')
    // await expect(page).toHaveURL(/\/auth\/session-expired/)
  })
})
