import { BasePage } from './base.page.js'

export class SignedOutPage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', {
      name: 'You have been signed out'
    })
    this.body = page.getByTestId('signed-out-body')
    this.returnHomeLink = page.getByRole('link', {
      name: 'Return to the home page'
    })
  }

  async open() {
    await super.open('/auth/signed-out')
  }
}
