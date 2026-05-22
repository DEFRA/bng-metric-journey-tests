import { test as base, expect } from '@playwright/test'
import { HomePage } from '@pages/home.page.js'
import { LayoutPage } from '@pages/layout.page.js'
import { ProjectDashboardPage } from '@pages/project-dashboard.page.js'
import { DefineProjectNamePage } from '@pages/define-project-name.page.js'
import { ProjectTaskListPage } from '@pages/project-task-list.page.js'
import { ChangeProjectNamePage } from '@pages/change-project-name.page.js'
import { UploadBaselineFilePage } from '@pages/upload-baseline-file.page.js'
import { UploadReceivedPage } from '@pages/upload-received.page.js'
import { UploadResultPage } from '@pages/upload-result.page.js'
import { ErrorFilePage } from '@pages/error-file.page.js'
import { CheckBaselineImportPage } from '@pages/check-baseline-import.page.js'
import { CreateProjectFlow } from '@flows/project-management/create-project.flow.js'
import { UploadBaselineFileFlow } from '@flows/upload-baseline/upload-baseline-file.flow.js'

export const test = base.extend({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page))
  },
  layoutPage: async ({ page }, use) => {
    await use(new LayoutPage(page))
  },
  projectDashboardPage: async ({ page }, use) => {
    await use(new ProjectDashboardPage(page))
  },
  defineProjectNamePage: async ({ page }, use) => {
    await use(new DefineProjectNamePage(page))
  },
  projectTaskListPage: async ({ page }, use) => {
    await use(new ProjectTaskListPage(page))
  },
  changeProjectNamePage: async ({ page }, use) => {
    await use(new ChangeProjectNamePage(page))
  },
  uploadBaselineFilePage: async ({ page }, use) => {
    await use(new UploadBaselineFilePage(page))
  },
  uploadReceivedPage: async ({ page }, use) => {
    await use(new UploadReceivedPage(page))
  },
  uploadResultPage: async ({ page }, use) => {
    await use(new UploadResultPage(page))
  },
  errorFilePage: async ({ page }, use) => {
    await use(new ErrorFilePage(page))
  },
  checkBaselineImportPage: async ({ page }, use) => {
    await use(new CheckBaselineImportPage(page))
  },
  createProjectFlow: async ({ page }, use) => {
    await use(new CreateProjectFlow(page))
  },
  uploadBaselineFileFlow: async ({ page }, use) => {
    await use(new UploadBaselineFileFlow(page))
  }
})

export { expect }
