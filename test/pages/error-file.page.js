import { BasePage } from './base.page.js'

export class ErrorFilePage extends BasePage {
  constructor(page) {
    super(page)
    this.errorSummary = page.getByRole('alert')
    this.genericHeading = page.getByRole('heading', {
      name: 'There is a problem with your file'
    })
    this.uploadDifferentFileLink = page.getByRole('button', {
      name: 'Upload a different file'
    })
    this.backToStartLink = page.getByRole('link', { name: 'Back to start' })
    this.backToProjectLink = page.getByRole('link', { name: 'Back to project' })
  }

  async open() {
    await super.open('/error-file')
  }
}
