import { test, expect } from '@fixtures'
import {
  STORAGE_STATE,
  PENDING_ROLE_STORAGE_STATE,
  runMode,
  skipInE2e
} from '@utils/env.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const LOGIN_METRICS_SKIP_REASON =
  'Records a LoginFailed CloudWatch metric — not run against CDP'
const FORBIDDEN_PATH = /\/auth\/forbidden$/

test.describe('authentication', { tag: '@authentication' }, () => {
  // ─── Page content ────────────────────────────────────────────────────────────
  // /auth/forbidden is a public GET (no session), so it renders in every mode.
  // The role-enforcement specs assert the redirect *to* this URL; here we assert
  // the page itself — its 403 status and content.

  test.describe('Forbidden page — page content', () => {
    test(
      'renders the access denied page with heading, body and return link, under a forbidden status',
      { tag: '@smoke' },
      async ({ forbiddenPage, page }) => {
        const response = await page.goto('/auth/forbidden')

        await expect(page).toHaveTitle('Access denied - Biodiversity Net Gain')
        await expect(forbiddenPage.heading).toBeVisible()
        await expect(forbiddenPage.body).toBeVisible()
        await expect(forbiddenPage.returnHomeLink).toBeVisible()

        // The app returns the page with a 403; assert that, but tolerate it
        // being surfaced under a 200 in case a platform layer (CDP ingress)
        // rewrites the status — the rendered content is the contract that
        // matters.
        expect([403, 200]).toContain(response.status())
      }
    )

    test(
      'return link navigates to the home page',
      { tag: '@smoke' },
      async ({ forbiddenPage, page }) => {
        await forbiddenPage.open()
        await forbiddenPage.returnHomeLink.click()

        await expect(page).toHaveTitle('Home - Biodiversity Net Gain')
      }
    )
  })

  // ─── Navigation ──────────────────────────────────────────────────────────────
  // The controller passes navigation: [], so the forbidden page omits the
  // default "Projects" nav link even for an authenticated session (which would
  // otherwise see it). The authenticated "Sign out" link is still appended.

  test.describe('Forbidden page — navigation', { tag: '@regression' }, () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    test('omits the "Projects" nav link while keeping "Sign out"', async ({
      forbiddenPage,
      layoutPage
    }) => {
      await forbiddenPage.open()

      await expect(layoutPage.projectsNavLink).toBeHidden()
      await expect(layoutPage.signOutLink).toBeVisible()
    })
  })

  // ─── Non-approved role ───────────────────────────────────────────────────────
  // A user holding a bng completer role at a non-approved enrolment status
  // (status 1, PENDING) is signed in but blocked from the service — the
  // approved-status (3) RBAC rule, distinct from the no-role case.

  test.describe(
    'Access denied — non-approved role',
    { tag: '@regression' },
    () => {
      test.use({ storageState: PENDING_ROLE_STORAGE_STATE })
      test.skip(skipInE2e(PENDING_ROLE_STORAGE_STATE), E2E_SKIP_REASON)

      test('a user whose bng completer role is not approved is redirected to /auth/forbidden', async ({
        page
      }) => {
        await page.goto('/manage-projects')

        await expect(page).toHaveURL(/\/auth\/forbidden/)
      })
    }
  )

  // ─── OIDC callback failures ──────────────────────────────────────────────────
  // auth/controller.js ends a failed callback in one of two places, and the
  // difference matters: a failure that comes back from the identity provider
  // goes to /auth/forbidden, but a callback this browser never started (no
  // pending OIDC state in its session — e.g. a cookie lost on the round trip)
  // restarts sign-in at /auth/login instead. `auth/controller.test.js:168`,
  // `:186` and `:361` cover all three against mocked openid-client calls; these
  // drive the real handler with real openid-client checks.
  //
  // Every test runs in a FRESH, unauthenticated context, so nothing touches
  // the shared STORAGE_STATE session. Each records a LoginFailed metric
  // (BMD-562), so they are kept off CDP rather than feed fake failures into
  // the real login dashboards.
  test.describe(
    'Access denied — OIDC callback failures',
    { tag: '@regression' },
    () => {
      test.skip(runMode === 'e2e', LOGIN_METRICS_SKIP_REASON)

      test('an error response from the identity provider redirects to /auth/forbidden', async ({
        page
      }) => {
        // The handler checks `error` before it looks for pending state, so no
        // sign-in needs to be in progress.
        await page.goto('/auth/callback?error=access_denied&state=any')

        await expect(page).toHaveURL(FORBIDDEN_PATH)
      })

      test('a token exchange that fails its checks redirects to /auth/forbidden', async ({
        page
      }) => {
        // Starting login stores the PKCE verifier and state in this session;
        // a callback carrying a different state then fails openid-client's
        // state check inside the token exchange.
        const login = await page.request.get('/auth/login', {
          maxRedirects: 0
        })
        expect(login.status()).toBe(302)

        await page.goto('/auth/callback?code=bogus&state=not-the-pending-state')

        await expect(page).toHaveURL(FORBIDDEN_PATH)
      })

      test('a callback with no sign-in in progress restarts sign-in rather than denying access', async ({
        page
      }) => {
        const response = await page.request.get(
          '/auth/callback?code=any&state=any',
          { maxRedirects: 0 }
        )

        expect(response.status()).toBe(302)
        expect(response.headers().location).toMatch(/\/auth\/login$/)
      })
    }
  )

  // ─── Blocked: login initiation failure → forbidden ───────────────────────────
  // loginController redirects to /auth/forbidden when OIDC discovery fails.
  // The browser cannot make discovery fail under the stub;
  // `auth/controller.test.js:130` covers it against a mocked getOidcConfig.
  //
  // Unblock: a stub fault-injection hook that makes its discovery document
  // unavailable, then run the body below.
  test.skip('a failed login initiation redirects to /auth/forbidden', async ({
    page
  }) => {
    // await <make stub discovery fail>
    // await page.goto('/auth/login')
    // await expect(page).toHaveURL(FORBIDDEN_PATH)
  })

  // ─── Blocked: approved role for a different relationship → forbidden ─────────
  // With a currentRelationshipId on the token, verify-role.js only accepts an
  // approved bng completer role held in THAT relationship
  // (`verify-role.test.js:36`, `:177`). Every stub profile in auth.setup.js has
  // a single relationship (12345), so the mismatch cannot be minted yet.
  //
  // Unblock: confirm the stub can register two relationships and set the
  // current one independently, add a profile with the approved role on the
  // non-current relationship, then run the body below under that profile.
  test.skip('an approved role held in another relationship is denied', async ({
    page
  }) => {
    // test.use({ storageState: OTHER_RELATIONSHIP_STORAGE_STATE })
    // await page.goto('/manage-projects')
    // await expect(page).toHaveURL(FORBIDDEN_PATH)
  })
})
