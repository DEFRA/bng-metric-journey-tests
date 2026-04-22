import { BasePage } from './base.page.js'

export class HomePage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', { name: 'Home' })
    this.pageBody = page.getByTestId('app-page-body')
    this.signInButton = page.getByTestId('sign-in-button')
    this.signedInAs = page.getByTestId('signed-in-as')
  }

  async open() {
    await super.open('/')
  }
}
