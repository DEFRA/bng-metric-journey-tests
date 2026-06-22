import { BasePage } from './base.page.js'

/**
 * Shared page object for the habitat file-upload form. The frontend renders both
 * the baseline and post-intervention upload pages from one Nunjucks template
 * (`habitat-upload-file.njk`), so the locators are identical — only the
 * instruction copy and the route differ per upload type.
 */
export class UploadHabitatFilePage extends BasePage {
  constructor(page, { instructionText, uploadRoute }) {
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
    this.instructionText = page.getByText(instructionText)
    this.uploadRoute = uploadRoute
  }

  async open(id) {
    await super.open(`/projects/${id}/${this.uploadRoute}`)
  }
}
