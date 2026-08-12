import { expect } from '@playwright/test'

import { BasePage } from './base.page.js'

const BASELINE_RADIO_LABEL =
  'Baseline Biodiversity Net Gain GeoPackage (.gpkg) file'
const POST_INTERVENTION_RADIO_LABEL =
  'Post-intervention Biodiversity Net Gain GeoPackage (.gpkg) file'

/**
 * The shared file-type selection page (`/projects/{id}/upload-file`, BMD-850)
 * that both upload journeys are entered through.
 */
export class UploadFilePage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', {
      name: 'What would you like to upload?'
    })
    this.overwriteWarning = page.getByText(
      'Uploading a file will overwrite any previous files you have uploaded.'
    )
    this.baselineRadio = page.getByLabel(BASELINE_RADIO_LABEL)
    this.postInterventionRadio = page.getByLabel(POST_INTERVENTION_RADIO_LABEL)
    this.continueButton = page.getByRole('button', { name: 'Continue' })
    this.cancelLink = page.getByRole('link', { name: 'Cancel' })
    this.backLink = page.getByRole('link', { name: 'Back' })
    this.errorSummary = page.getByRole('alert')
  }

  // Returns the navigation response so a spec can assert the 400 / 404 status
  // without bypassing the page object.
  async open(id, returnUrl) {
    const query = returnUrl
      ? `?${new URLSearchParams({ returnUrl }).toString()}`
      : ''
    return super.open(`/projects/${id}/upload-file${query}`)
  }

  // The error-summary entry is rendered as a link whose accessible name is the
  // message text; matching by name keeps the assertion off CSS selectors.
  errorLink(text) {
    return this.page.getByRole('link', { name: text })
  }

  async selectBaseline() {
    await this.baselineRadio.check()
  }

  async selectPostIntervention() {
    await this.postInterventionRadio.check()
  }

  async submit() {
    await this.continueButton.click()
  }

  async assertReturnLinks(href) {
    await expect(this.backLink).toHaveAttribute('href', href)
    await expect(this.cancelLink).toHaveAttribute('href', href)
  }
}
