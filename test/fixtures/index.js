import { test as base, expect } from '@playwright/test'
import { HomePage } from '@pages/home.page.js'

export const test = base.extend({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page))
  }
})

export { expect }
