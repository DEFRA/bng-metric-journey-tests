import { BasePage } from './base.page.js'

export class UploadReceivedPage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', { name: 'Checking your file' })
  }

  async open(id) {
    await super.open(`/projects/${id}/upload-received`)
  }
}
