import { expect } from '@playwright/test'
import { BasePage } from './base.page.js'

export class ChangeProjectNamePage extends BasePage {
  constructor(page) {
    super(page)
    this.nameInput = page.getByLabel('Project Name')
    this.saveAndContinueButton = page.getByRole('button', {
      name: 'Save and continue'
    })
    this.backLink = page.getByRole('link', { name: 'Back' })
    this.errorSummary = page.getByRole('alert')
  }

  async open(id) {
    await super.open(`/change-project-name/${id}`)
  }

  async enterName(name) {
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
