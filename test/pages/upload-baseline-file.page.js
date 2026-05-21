import { BasePage } from './base.page.js'

export class UploadBaselineFilePage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', {
      name: 'Upload a GeoPackage (.gpkg) file'
    })
    // The GOV.UK enhanced file upload replaces the input with a visible button;
    // setInputFiles must target the real hidden input, not the button.
    this.fileInput = page.locator('input[type="file"]')
    this.noFileChosenText = page.getByText('No file chosen')
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
