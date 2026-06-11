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

    // Read-only summary rows. The page renders these inside a GOV.UK summary
    // list (a <dl>, not a table), so the keys are matched by their visible
    // text. Strategic Significance is a fixed "Low (1)" in MVS.
    this.referenceKey = page.getByText('Reference', { exact: true })
    this.distinctivenessKey = page.getByText('Distinctiveness', { exact: true })
    this.strategicSignificanceKey = page.getByText('Strategic Significance', {
      exact: true
    })
    this.strategicSignificanceValue = page.getByText('Low (1)', { exact: true })
    this.tradingRulesKey = page.getByText(
      'Required action to meet trading rules',
      {
        exact: true
      }
    )
    this.habitatUnitsKey = page.getByText('Units in this habitat', {
      exact: true
    })
  }

  async open(projectId, featureId) {
    await super.open(
      `/baseline-habitat-details?projectId=${projectId}&featureId=${featureId}`
    )
  }

  async optionValues(select) {
    const options = await select.getByRole('option').all()
    const values = []
    for (const option of options) {
      values.push(await option.getAttribute('value'))
    }
    return values
  }

  async conditionOptionValues() {
    return this.optionValues(this.conditionSelect)
  }

  // Selects an option whose value differs from the current selection and
  // returns the chosen value, so the caller can assert it was persisted.
  async selectDifferentOption(select) {
    const current = await select.inputValue()
    for (const value of await this.optionValues(select)) {
      if (value && value !== current) {
        await select.selectOption(value)
        return value
      }
    }
    throw new Error('No alternative option available to select')
  }

  async selectDifferentCondition() {
    return this.selectDifferentOption(this.conditionSelect)
  }

  async selectDifferentHabitatType() {
    return this.selectDifferentOption(this.habitatTypeSelect)
  }
}
