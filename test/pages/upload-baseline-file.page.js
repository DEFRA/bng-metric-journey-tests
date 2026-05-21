import { BasePage } from './base.page.js'

export class UploadBaselineFilePage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', {
      name: 'Upload a GeoPackage (.gpkg) file'
    })
    this.fileInput = page.getByLabel('Upload a file')
    this.continueButton = page.getByRole('button', { name: 'Continue' })
    this.backLink = page.getByRole('link', { name: 'Back' })
    this.errorSummary = page.getByRole('alert')
    this.instructionText = page.getByText(
      'Upload a GeoPackage (.gpkg) file containing a red line boundary and baseline habitat parcels.'
    )
  }

  async open(id) {
    await super.open(`/projects/${id}/upload-baseline-file`)
  }
}
