import { BasePage } from './base.page.js'

export class CheckBaselineImportPage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', {
      name: 'Check your on-site baseline data'
    })
    this.backLink = page.getByRole('link', { name: 'Back' })
  }

  async open(id) {
    await super.open(`/projects/${id}/check-baseline-import`)
  }
}
