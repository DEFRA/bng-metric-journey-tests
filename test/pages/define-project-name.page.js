import { expect } from '@playwright/test'
import { BasePage } from './base.page.js'

export class DefineProjectNamePage extends BasePage {
  constructor(page) {
    super(page)
    this.nameInput = page.getByLabel(
      'Add a name for your Biodiversity Net Gain project'
    )
    this.saveAndContinueButton = page.getByRole('button', {
      name: 'Save and continue'
    })
    this.backLink = page.getByRole('link', { name: 'Back' })
    this.errorSummary = page.getByRole('alert')
    this.nameHint = page.getByText(
      'Give your project a unique name so you can find it later.'
    )
  }

  async open() {
    await super.open('/define-project-name')
  }

  async enterProjectName(name) {
    await this.nameInput.evaluate((el) => el.removeAttribute('maxlength'))
    await this.nameInput.fill(name)
  }

  async submit() {
    await this.saveAndContinueButton.click()
  }

  async assertNameError(text) {
    await expect(this.errorSummary).toBeVisible()
    await expect(this.page.getByRole('link', { name: text })).toBeVisible()
  }
}
