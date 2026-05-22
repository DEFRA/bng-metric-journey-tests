import { BasePage } from './base.page.js'

export class UploadResultPage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', {
      name: 'File uploaded successfully'
    })
    this.returnToProjectLink = page.getByRole('link', {
      name: 'Return to project'
    })
  }

  async open(id) {
    await super.open(`/projects/${id}/upload-result`)
  }
}
