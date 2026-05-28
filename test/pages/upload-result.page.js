import { BasePage } from './base.page.js'

export class UploadResultPage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', {
      name: 'File uploaded successfully'
    })
    this.checkBaselineDataLink = page.getByRole('link', {
      name: 'Check your on-site baseline data'
    })
  }

  async open(id) {
    await super.open(`/projects/${id}/upload-result`)
  }
}
