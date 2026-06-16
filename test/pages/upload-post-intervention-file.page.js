import { BasePage } from './base.page.js'

export class UploadPostInterventionFilePage extends BasePage {
  constructor(page) {
    super(page)
    this.fileInput = page.locator('input[type="file"]')
    this.continueButton = page.getByRole('button', { name: 'Continue' })
  }

  async open(id) {
    await super.open(`/projects/${id}/upload-post-intervention-file`)
  }
}
