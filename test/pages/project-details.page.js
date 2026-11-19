import { expect } from '@playwright/test'
import { BasePage } from './base.page.js'

export const PROJECT_DETAILS = 'Project details'
export const LPA_DEFAULT_OPTION = 'Choose local planning authority'

// The project details page as BMD-849 (frontend PR#514) rebuilt it: the left
// navigation, seven fields, and Save / Cancel back to the page its nav link
// was followed from.
export class ProjectDetailsPage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', {
      name: PROJECT_DETAILS,
      level: 1
    })
    this.helpText = page.getByText(
      'Enter the details for the project. You do not need to add them all straight away, but you will need to complete all of these details before you can export your metric.'
    )
    // Labelled with the page heading; its own item is text, not a link.
    this.navigation = page.getByRole('navigation', { name: PROJECT_DETAILS })
    this.currentNavItem = this.navigation.getByText(PROJECT_DETAILS, {
      exact: true
    })
    this.projectNameInput = page.getByRole('textbox', {
      name: 'Project name',
      exact: true
    })
    this.surveyCompletedByInput = page.getByLabel('Survey completed by')
    this.surveyDateGroup = page.getByRole('group', { name: 'Survey date' })
    this.dayInput = page.getByLabel('Day')
    this.monthInput = page.getByLabel('Month')
    this.yearInput = page.getByLabel('Year')
    this.applicantInput = page.getByLabel('Planning permission applicant name')
    this.localPlanningAuthoritySelect = page.getByLabel(
      'Local planning authority'
    )
    this.planningApplicationReferenceInput = page.getByLabel(
      'Planning application reference (optional)'
    )
    this.planningApplicationTypeInput = page.getByLabel(
      'Planning application type (optional)'
    )
    this.saveButton = page.getByRole('button', { name: 'Save' })
    this.cancelLink = page.getByRole('link', { name: 'Cancel' })
    this.errorSummary = page.getByRole('alert')
    this.errorSummaryLinks = this.errorSummary.getByRole('link')
  }

  async open(id) {
    await super.open(`/project-details/${id}`)
  }

  localPlanningAuthorityOption(name) {
    return this.localPlanningAuthoritySelect.getByRole('option', {
      name,
      exact: true
    })
  }

  /**
   * An inline field error. GOV.UK prefixes it with a visually hidden
   * "Error:", which tells it apart from the summary link with the same words.
   */
  inlineError(text) {
    return this.page.getByRole('main').getByText(`Error: ${text}`)
  }

  // Point an option at a reference the backend does not hold, as a form loaded
  // before an LPA list refresh removed that authority would.
  async makeLocalPlanningAuthorityStale(name, reference) {
    await this.localPlanningAuthorityOption(name).evaluate((option, value) => {
      option.value = value
    }, reference)
  }

  async #fillIfDefined(locator, value) {
    if (value !== undefined) {
      await locator.fill(value)
    }
  }

  // Choose an LPA by its visible name, as a user would; the option's value is
  // its Planning Data reference.
  async #selectIfDefined(locator, label) {
    if (label !== undefined) {
      await locator.selectOption({ label })
    }
  }

  async fill({
    projectName,
    surveyCompletedBy,
    day,
    month,
    year,
    applicant,
    localPlanningAuthority,
    planningApplicationReference,
    planningApplicationType
  }) {
    await this.#fillIfDefined(this.projectNameInput, projectName)
    await this.#fillIfDefined(this.surveyCompletedByInput, surveyCompletedBy)
    await this.#fillIfDefined(this.dayInput, day)
    await this.#fillIfDefined(this.monthInput, month)
    await this.#fillIfDefined(this.yearInput, year)
    await this.#fillIfDefined(this.applicantInput, applicant)
    await this.#selectIfDefined(
      this.localPlanningAuthoritySelect,
      localPlanningAuthority
    )
    await this.#fillIfDefined(
      this.planningApplicationReferenceInput,
      planningApplicationReference
    )
    await this.#fillIfDefined(
      this.planningApplicationTypeInput,
      planningApplicationType
    )
  }

  async submit() {
    await this.saveButton.click()
  }

  /** GOV.UK focuses the summary's wrapper, around the role="alert" element. */
  async assertErrorSummaryFocused() {
    await expect
      .poll(() =>
        this.errorSummary.evaluate(
          (alert) => alert.parentElement === document.activeElement
        )
      )
      .toBe(true)
  }

  /** Every field, in the order the ACs list them, from the top of the page. */
  async assertFieldsInOrder() {
    const fields = [
      this.projectNameInput,
      this.surveyCompletedByInput,
      this.surveyDateGroup,
      this.applicantInput,
      this.localPlanningAuthoritySelect,
      this.planningApplicationReferenceInput,
      this.planningApplicationTypeInput
    ]
    const tops = []
    for (const field of fields) {
      await expect(field).toBeVisible()
      tops.push((await field.boundingBox()).y)
    }
    expect(tops).toEqual([...tops].sort((a, b) => a - b))
  }

  /** Every field as the page shows it, the authority by its option text. */
  async assertValues({
    projectName,
    surveyCompletedBy = '',
    day = '',
    month = '',
    year = '',
    applicant = '',
    localPlanningAuthority = LPA_DEFAULT_OPTION,
    planningApplicationReference = '',
    planningApplicationType = ''
  }) {
    await expect(this.projectNameInput).toHaveValue(projectName)
    await expect(this.surveyCompletedByInput).toHaveValue(surveyCompletedBy)
    await expect(this.dayInput).toHaveValue(day)
    await expect(this.monthInput).toHaveValue(month)
    await expect(this.yearInput).toHaveValue(year)
    await expect(this.applicantInput).toHaveValue(applicant)
    await expect(
      this.localPlanningAuthorityOption(localPlanningAuthority)
    ).toHaveJSProperty('selected', true)
    await expect(this.planningApplicationReferenceInput).toHaveValue(
      planningApplicationReference
    )
    await expect(this.planningApplicationTypeInput).toHaveValue(
      planningApplicationType
    )
  }
}
