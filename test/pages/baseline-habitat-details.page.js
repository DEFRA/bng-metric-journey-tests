import { BasePage } from './base.page.js'

export class BaselineHabitatDetailsPage extends BasePage {
  constructor(page) {
    super(page)
    // Heading is dynamic: "Habitat {ref}" or "Hedgerow {ref}"
    this.heading = page.getByRole('heading', { name: /^(Habitat|Hedgerow)/ })
    this.baselineDetailsHeading = page.getByRole('heading', {
      name: 'Baseline Details'
    })
    this.broadHabitatSelect = page.getByLabel('Broad habitat')
    this.habitatTypeSelect = page.getByLabel('Habitat type')
    this.conditionSelect = page.getByLabel('Condition')
    this.saveButton = page.getByRole('button', { name: 'Save' })
    this.cancelLink = page.getByRole('link', { name: 'Cancel' })
    this.backLink = page.getByRole('link', { name: 'Back' })
  }

  async open(projectId, featureId) {
    await super.open(
      `/baseline-habitat-details?projectId=${projectId}&featureId=${featureId}`
    )
  }
}
