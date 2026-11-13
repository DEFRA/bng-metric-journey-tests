import { expect } from '@playwright/test'
import { BasePage } from './base.page.js'

// BMD-849 replaced the BMD-276 form: the page sits in the project's left
// navigation, edits the project name with the other details, and Save and
// Cancel return to the page its "Project details" link was followed from.
export const PROJECT_DETAILS_NAV_ITEM = 'Project details'
export const LPA_PLACEHOLDER = 'Choose local planning authority'
export const HELP_TEXT =
  'Enter the details for the project. You do not need to add them all straight away, but you will need to complete all of these details before you can export your metric.'

export class ProjectDetailsPage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', {
      name: 'Project details',
      level: 1
    })
    this.helpText = page.getByText(HELP_TEXT)
    this.navigation = page.getByRole('navigation', { name: 'Project details' })
    this.currentNavItem = this.navigation.getByText(PROJECT_DETAILS_NAV_ITEM, {
      exact: true
    })
    this.projectNameInput = page.getByLabel('Project name', { exact: true })
    this.surveyCompletersInput = page.getByLabel('Survey completed by')
    this.surveyDateFieldset = page.getByRole('group', { name: 'Survey date' })
    this.dayInput = this.surveyDateFieldset.getByLabel('Day')
    this.monthInput = this.surveyDateFieldset.getByLabel('Month')
    this.yearInput = this.surveyDateFieldset.getByLabel('Year')
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
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true })
    this.cancelLink = page.getByRole('link', { name: 'Cancel', exact: true })
    this.errorSummary = page.getByRole('alert')
  }

  async open(id, returnUrl) {
    const query = returnUrl
      ? `?${new URLSearchParams({ returnUrl }).toString()}`
      : ''
    return super.open(`/project-details/${id}${query}`)
  }

  // Every field, in the order AC2 lists them.
  fieldsInOrder() {
    return [
      this.projectNameInput,
      this.surveyCompletersInput,
      this.dayInput,
      this.monthInput,
      this.yearInput,
      this.applicantInput,
      this.localPlanningAuthoritySelect,
      this.planningApplicationReferenceInput,
      this.planningApplicationTypeInput
    ]
  }

  localPlanningAuthorityOption(name) {
    return this.localPlanningAuthoritySelect.getByRole('option', {
      name,
      exact: true
    })
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
    surveyCompleters,
    day,
    month,
    year,
    applicant,
    localPlanningAuthority,
    planningApplicationReference,
    planningApplicationType
  }) {
    await this.#fillIfDefined(this.projectNameInput, projectName)
    await this.#fillIfDefined(this.surveyCompletersInput, surveyCompleters)
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

  // GOV.UK Frontend's ErrorSummary moves focus to the summary's wrapper, the
  // element around its role="alert" content, which has no role of its own.
  async assertErrorSummaryFocused() {
    await expect
      .poll(() =>
        this.errorSummary.evaluate((alert) =>
          document.activeElement.contains(alert)
        )
      )
      .toBe(true)
  }

  async assertFieldError(text) {
    await expect(this.errorSummary).toBeVisible()
    await expect(
      this.errorSummary.getByRole('link', { name: text })
    ).toBeVisible()
  }
}
