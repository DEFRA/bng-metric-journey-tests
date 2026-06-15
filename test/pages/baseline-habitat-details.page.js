import { BasePage } from './base.page.js'

export class BaselineHabitatDetailsPage extends BasePage {
  constructor(page) {
    super(page)
    // Heading is dynamic: "Habitat {ref}", "Hedgerow {ref}" or "Watercourse {ref}"
    this.heading = page.getByRole('heading', {
      name: /^(Habitat|Hedgerow|Watercourse)/
    })
    this.baselineDetailsHeading = page.getByRole('heading', {
      name: 'Baseline Details'
    })
    this.broadHabitatSelect = page.getByLabel('Broad habitat')
    this.habitatTypeSelect = page.getByLabel('Habitat type')
    this.conditionSelect = page.getByLabel('Condition')
    // Read-only dropdowns rendered only for watercourse features.
    this.watercourseEncroachmentSelect = page.getByLabel(
      'Watercourse encroachment'
    )
    this.riparianEncroachmentSelect = page.getByLabel('Riparian encroachment')
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
    // "Units in this habitat" is the final summary-list row, so its value is
    // the last definition (<dd>) on the page — used to assert the units value
    // is unchanged by display-only dropdown actions.
    this.habitatUnitsValue = page.getByRole('definition').last()
    // Read-only derived spans the client JS rewrites as the dropdowns change.
    this.distinctivenessDisplay = page.locator('#distinctivenessDisplay')
    this.tradingRuleDisplay = page.locator('#tradingRuleDisplay')
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

  async habitatUnitsText() {
    return (await this.habitatUnitsValue.textContent()).trim()
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

  async selectDifferentBroadHabitat() {
    return this.selectDifferentOption(this.broadHabitatSelect)
  }
}
