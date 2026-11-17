import { setTimeout as sleep } from 'timers/promises'
import { DefraIdLoginPage } from '@pages/defra-id-login.page.js'
import { totp, msUntilNextTotpStep } from '@utils/totp.js'

// One Login may reject a code that expires while the form is being submitted,
// so a code this close to rolling over is not used.
const MIN_TOTP_LIFETIME_MS = 5000

// Where the browser can land after the password: back on the service, or on a
// One Login security-code page (/enter-authenticator-app-code).
const SERVICE_LANDING = /\/manage-projects|\/project-name/
const SECURITY_CODE_PAGE = /^signin\..*account\.gov\.uk$/

// Drives the real Defra ID (GOV.UK One Login) sign-in journey used in e2e mode.
// Equivalent to a user clicking the home page "Sign in" button, which links to
// /auth/login and triggers the OIDC redirect to Defra ID.
export class DefraIdLoginFlow {
  constructor(page) {
    this.page = page
    this.loginPage = new DefraIdLoginPage(page)
  }

  // totpSecret is only needed when One Login asks for a security code. Defra ID
  // dev/test currently request password-only sign-in, so the code step is
  // skipped; it runs if Defra ID starts requiring two-factor authentication.
  async login(email, password, totpSecret) {
    await this.loginPage.open()
    await this.loginPage.chooseSignIn()
    await this.loginPage.enterEmail(email)
    await this.loginPage.clickContinue()
    await this.loginPage.enterPassword(password)
    await this.loginPage.clickContinue()

    await this.page.waitForURL(
      (url) =>
        SERVICE_LANDING.test(url.pathname) ||
        (SECURITY_CODE_PAGE.test(url.hostname) &&
          url.pathname.includes('code')),
      { timeout: 60000, waitUntil: 'domcontentloaded' }
    )
    if (!SERVICE_LANDING.test(new URL(this.page.url()).pathname)) {
      await this.enterSecurityCode(totpSecret)
    }

    // The external sign-in redirects through Defra ID back to /auth/callback and
    // on to either the dashboard (/manage-projects) or, for a completer with no
    // projects yet, the create-first-project page (/project-name). Either means
    // we're authenticated — allow extra time for the round trip.
    await this.page.waitForURL(SERVICE_LANDING, {
      timeout: 60000,
      waitUntil: 'domcontentloaded'
    })
  }

  // The e2e account uses an authenticator app, so the code is generated from
  // its setup key.
  async enterSecurityCode(totpSecret) {
    if (!totpSecret) {
      throw new Error(
        'One Login asked for a security code but DEFRA_ID_TOTP_SECRET is not set'
      )
    }
    // Waiting on the clock, not the page, so this is a timer rather than a
    // Playwright wait.
    if (msUntilNextTotpStep() < MIN_TOTP_LIFETIME_MS) {
      await sleep(msUntilNextTotpStep())
    }
    await this.loginPage.enterSecurityCode(totp(totpSecret))
    await this.loginPage.clickContinue()
  }
}
