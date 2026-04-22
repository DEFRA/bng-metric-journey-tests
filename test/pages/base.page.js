export class BasePage {
  constructor(page) {
    this.page = page
  }

  async open(path = '/') {
    await this.page.goto(path)
    await this.page.waitForLoadState('domcontentloaded')
  }
}
