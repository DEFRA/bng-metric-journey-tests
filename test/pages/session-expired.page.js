import { BasePage } from './base.page.js'

export class SessionExpiredPage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', {
      name: 'You have been signed out'
    })
    this.body = page.getByTestId('session-expired-body')
    this.signInAgainButton = page.getByTestId('sign-in-again-button')
    this.returnHomeLink = page.getByRole('link', {
      name: 'Return to the home page'
    })
  }

  async open() {
    await super.open('/auth/session-expired')
  }
}
