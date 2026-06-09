import { BasePage } from './base.page.js'

export class ForbiddenPage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', { name: 'Access denied' })
    this.body = page.getByTestId('forbidden-body')
    this.returnHomeLink = page.getByRole('link', {
      name: 'Return to the home page'
    })
  }

  async open() {
    await super.open('/auth/forbidden')
  }
}
