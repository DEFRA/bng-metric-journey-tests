import { DefraIdLoginPage } from '@pages/defra-id-login.page.js'

// Drives the real Defra ID (Government Gateway) sign-in journey used in e2e
// mode. Equivalent to a user clicking the home page "Sign in" button, which
// links to /auth/login and triggers the OIDC redirect to Defra ID.
export class DefraIdLoginFlow {
  constructor(page) {
    this.page = page
    this.loginPage = new DefraIdLoginPage(page)
  }

  async login(username, password) {
    await this.loginPage.open()
    await this.loginPage.selectGovernmentGateway()
    await this.loginPage.clickContinue()
    await this.loginPage.enterUserId(username)
    await this.loginPage.enterPassword(password)
    await this.loginPage.submit()

    // The external sign-in redirects through Defra ID back to /auth/callback and
    // on to either the dashboard (/manage-projects) or, for a completer with no
    // projects yet, the create-first-project page (/project-name). Either means
    // we're authenticated — allow extra time for the round trip.
    await this.page.waitForURL(/\/manage-projects|\/project-name/, {
      timeout: 60000,
      waitUntil: 'domcontentloaded'
    })
  }
}
