import { expect } from '@playwright/test'
import { BasePage } from './base.page.js'

export class ProjectDetailsPage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', { name: 'Project details' })
    this.backLink = page.getByRole('link', { name: 'Back' })
    this.localPlanningAuthoritySelect = page.getByLabel(
      'Local Planning Authority'
    )
    this.surveyCompletersInput = page.getByLabel('Survey completer(s)')
    this.dayInput = page.getByLabel('Day')
    this.monthInput = page.getByLabel('Month')
    this.yearInput = page.getByLabel('Year')
    this.smallSiteRadio = page.getByRole('radio', { name: 'Small site' })
    this.largeSiteRadio = page.getByRole('radio', { name: 'Large site' })
    this.nsipsYesRadio = page.getByRole('radio', { name: 'Yes' })
    this.nsipsNoRadio = page.getByRole('radio', { name: 'No' })
    this.applicantInput = page.getByLabel('Applicant')
    this.saveAndContinueButton = page.getByRole('button', {
      name: 'Save and continue'
    })
    this.errorSummary = page.getByRole('alert')
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

  // Check the radio whose label maps to `value`; a nullish or unrecognised
  // value leaves the group untouched.
  async #checkRadio(value, radiosByValue) {
    const radio = radiosByValue[value]
    if (radio) {
      await radio.check()
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
    localPlanningAuthority,
    surveyCompleters,
    day,
    month,
    year,
    developmentType,
    nsips,
    applicant
  }) {
    await this.#selectIfDefined(
      this.localPlanningAuthoritySelect,
      localPlanningAuthority
    )
    await this.#fillIfDefined(this.surveyCompletersInput, surveyCompleters)
    await this.#fillIfDefined(this.dayInput, day)
    await this.#fillIfDefined(this.monthInput, month)
    await this.#fillIfDefined(this.yearInput, year)
    await this.#checkRadio(developmentType, {
      'Small site': this.smallSiteRadio,
      'Large site': this.largeSiteRadio
    })
    await this.#checkRadio(nsips, {
      Yes: this.nsipsYesRadio,
      No: this.nsipsNoRadio
    })
    await this.#fillIfDefined(this.applicantInput, applicant)
  }

  async submit() {
    await this.saveAndContinueButton.click()
  }

  async assertFieldError(text) {
    await expect(this.errorSummary).toBeVisible()
    await expect(this.page.getByRole('link', { name: text })).toBeVisible()
  }
}
