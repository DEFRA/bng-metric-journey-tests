import { BasePage } from './base.page.js'

// Defra ID / GOV.UK One Login sign-in pages. These screens are served by Defra
// ID (Azure AD B2C → GOV.UK One Login integration), not the frontend under
// test. Defra ID offers One Login only since BMD-1174, so B2C redirects straight
// to One Login's "Create your GOV.UK One Login or sign in" page. Selectors are
// verified against dev/test; re-confirm with a headed run if the hosted pages
// change.
export class DefraIdLoginPage extends BasePage {
  constructor(page) {
    super(page)
    this.signInButton = page.getByRole('button', { name: 'Sign in' })
    this.emailInput = page.getByRole('textbox', { name: /email address/i })
    this.passwordInput = page.getByLabel('Enter your password')
    this.securityCodeInput = page.getByRole('textbox', {
      name: /security code/i
    })
    this.continueButton = page.getByRole('button', { name: 'Continue' })
  }

  async open() {
    // /auth/login (the home "Sign in" link) redirects to the external Defra ID
    // pages. Wait for the document only, not full 'load' — those pages pull many
    // sub-resources through the CDP proxy and may not fire 'load' in time; the
    // locators below auto-wait for the controls once they render.
    await this.page.goto('/auth/login', { waitUntil: 'domcontentloaded' })
  }

  async chooseSignIn() {
    await this.signInButton.click()
  }

  async enterEmail(email) {
    await this.emailInput.fill(email)
  }

  async enterPassword(password) {
    await this.passwordInput.fill(password)
  }

  async enterSecurityCode(code) {
    await this.securityCodeInput.fill(code)
  }

  async clickContinue() {
    await this.continueButton.click()
  }
}
