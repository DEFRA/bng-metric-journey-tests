import { expect } from '@playwright/test'
import { BasePage } from './base.page.js'

export class ProjectDetailsPage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', { name: 'Project details' })
    this.backLink = page.getByRole('link', { name: 'Back' })
    this.localPlanningAuthorityInput = page.getByLabel(
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
    if (localPlanningAuthority !== undefined) {
      await this.localPlanningAuthorityInput.fill(localPlanningAuthority)
    }
    if (surveyCompleters !== undefined) {
      await this.surveyCompletersInput.fill(surveyCompleters)
    }
    if (day !== undefined) {
      await this.dayInput.fill(day)
    }
    if (month !== undefined) {
      await this.monthInput.fill(month)
    }
    if (year !== undefined) {
      await this.yearInput.fill(year)
    }
    if (developmentType === 'Small site') {
      await this.smallSiteRadio.check()
    } else if (developmentType === 'Large site') {
      await this.largeSiteRadio.check()
    }
    if (nsips === 'Yes') {
      await this.nsipsYesRadio.check()
    } else if (nsips === 'No') {
      await this.nsipsNoRadio.check()
    }
    if (applicant !== undefined) {
      await this.applicantInput.fill(applicant)
    }
  }

  async submit() {
    await this.saveAndContinueButton.click()
  }

  async assertFieldError(text) {
    await expect(this.errorSummary).toBeVisible()
    await expect(this.page.getByRole('link', { name: text })).toBeVisible()
  }
}
