export class BasePage {
  constructor(page) {
    this.page = page
  }

  // Returns the navigation response so a spec can assert on response-level
  // behaviour (status, headers) without bypassing the page object.
  async open(path = '/') {
    const response = await this.page.goto(path)
    await this.page.waitForLoadState('domcontentloaded')
    return response
  }
}
