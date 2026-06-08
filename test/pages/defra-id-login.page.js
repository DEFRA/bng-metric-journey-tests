import { BasePage } from './base.page.js'

// Defra ID / Government Gateway sign-in pages. These screens are served by Defra
// ID (Azure AD B2C → Government Gateway), not the frontend under test. Selectors
// are verified against the dev environment and the test account has no MFA step;
// re-confirm with a headed run against dev/test if the hosted pages change.
export class DefraIdLoginPage extends BasePage {
  constructor(page) {
    super(page)
    this.governmentGatewayOption = page.getByRole('radio', {
      name: 'Sign in with Government Gateway'
    })
    this.continueButton = page.getByRole('button', { name: 'Continue' })
    this.userIdInput = page.getByLabel('Government Gateway user ID')
    // exact: true — the GOV.UK password field has a "Show current password"
    // toggle whose name also contains "password".
    this.passwordInput = page.getByLabel('Password', { exact: true })
    this.signInButton = page.getByRole('button', { name: 'Sign in' })
  }

  async open() {
    // /auth/login is the frontend entry point (the home "Sign in" button links
    // here); it redirects to the Defra ID authorize endpoint.
    await super.open('/auth/login')
  }

  async selectGovernmentGateway() {
    await this.governmentGatewayOption.check()
  }

  async clickContinue() {
    await this.continueButton.click()
  }

  async enterUserId(userId) {
    await this.userIdInput.fill(userId)
  }

  async enterPassword(password) {
    await this.passwordInput.fill(password)
  }

  async submit() {
    await this.signInButton.click()
  }
}
