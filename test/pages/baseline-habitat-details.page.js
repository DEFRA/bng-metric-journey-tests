import { BasePage } from './base.page.js'

export class BaselineHabitatDetailsPage extends BasePage {
  constructor(page) {
    super(page)
    // Heading is dynamic: "Habitat {ref}", "Hedgerow {ref}" or "Watercourse {ref}"
    this.heading = page.getByRole('heading', {
      name: /^(Habitat|Hedgerow|Watercourse)/
    })
    // The appHeading macro's <h1>, on this page and on the post-intervention
    // view-only pages. Its text is the ref as stored, with no trimming of its own.
    this.headingTitle = page.getByTestId('app-heading-title')
    this.baselineDetailsHeading = page.getByRole('heading', {
      name: 'Baseline Details'
    })
    this.habitatReferenceInput = page.getByRole('textbox', {
      name: 'Habitat reference',
      exact: true
    })
    this.broadHabitatSelect = page.getByLabel('Broad habitat')
    this.habitatTypeSelect = page.getByLabel('Habitat type')
    this.conditionSelect = page.getByLabel('Condition')
    // Encroachment controls rendered only for watercourse features.
    this.watercourseEncroachmentSelect = page.getByLabel(
      'Watercourse encroachment'
    )
    this.riparianEncroachmentSelect = page.getByLabel('Riparian encroachment')
    this.saveButton = page.getByRole('button', { name: 'Save' })
    this.cancelLink = page.getByRole('link', { name: 'Cancel' })
    this.backLink = page.getByRole('link', { name: 'Back' })

    // Baseline values use stacked fields. Keep the old Reference label locator
    // for read-only post-intervention assertions; baseline refs use the input.
    this.referenceKey = page.getByText('Reference', { exact: true })
    this.distinctivenessKey = page.getByText('Distinctiveness', { exact: true })
    this.strategicSignificanceKey = page.getByRole('heading', {
      name: 'Strategic significance',
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

    // The habitat's comment (BMD-1112): a GOV.UK textarea on every baseline
    // feature type, absent from the post-intervention pages.
    this.commentInput = page.getByRole('textbox', {
      name: 'Supporting information'
    })
    this.commentHint = page.locator('#comment-hint')

    // A refused save re-renders the form with a GOV.UK error summary.
    this.errorSummary = page.getByRole('alert')
    this.errorSummaryLinks = this.errorSummary.getByRole('link')
  }

  errorSummaryLink(text) {
    return this.errorSummary.getByRole('link', { name: text })
  }

  /**
   * An inline field error. Not exact: GOV.UK prefixes it with a visually
   * hidden "Error:". Its wording differs from the summary entry's, so the
   * text alone cannot resolve to the summary link.
   */
  inlineError(text) {
    return this.page.getByRole('main').getByText(text)
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

  /**
   * The <h1>'s text exactly as rendered, untrimmed. `toHaveText` normalises
   * whitespace, so it would pass a ref saved with its padding (BMD-1058).
   */
  async rawHeadingText() {
    await this.headingTitle.waitFor()
    return this.headingTitle.textContent()
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
