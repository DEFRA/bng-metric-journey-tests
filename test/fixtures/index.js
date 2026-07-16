import { test as base, expect } from '@playwright/test'
import { HomePage } from '@pages/home.page.js'
import { LayoutPage } from '@pages/layout.page.js'
import { ProjectDashboardPage } from '@pages/project-dashboard.page.js'
import { DefineProjectNamePage } from '@pages/define-project-name.page.js'
import { ProjectTaskListPage } from '@pages/project-task-list.page.js'
import { ChangeProjectNamePage } from '@pages/change-project-name.page.js'
import { UploadBaselineFilePage } from '@pages/upload-baseline-file.page.js'
import { UploadReceivedPage } from '@pages/upload-received.page.js'
import { ErrorFilePage } from '@pages/error-file.page.js'
import { HabitatListPage } from '@pages/habitat-list.page.js'
import { BaselineHabitatDetailsPage } from '@pages/baseline-habitat-details.page.js'
import { ForbiddenPage } from '@pages/forbidden.page.js'
import { SignedOutPage } from '@pages/signed-out.page.js'
import { UploadPostInterventionFilePage } from '@pages/upload-post-intervention-file.page.js'
import { PostInterventionHabitatListPage } from '@pages/post-intervention-habitat-list.page.js'
import { PostInterventionHabitatDetailsPage } from '@pages/post-intervention-habitat-details.page.js'
import { CreateProjectFlow } from '@flows/project-management/create-project.flow.js'
import { UploadBaselineFileFlow } from '@flows/upload-baseline/upload-baseline-file.flow.js'
import { UploadPostInterventionFileFlow } from '@flows/upload-post-intervention/upload-post-intervention-file.flow.js'

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
  errorFilePage: async ({ page }, use) => {
    await use(new ErrorFilePage(page))
  },
  habitatListPage: async ({ page }, use) => {
    await use(new HabitatListPage(page))
  },
  baselineHabitatDetailsPage: async ({ page }, use) => {
    await use(new BaselineHabitatDetailsPage(page))
  },
  forbiddenPage: async ({ page }, use) => {
    await use(new ForbiddenPage(page))
  },
  signedOutPage: async ({ page }, use) => {
    await use(new SignedOutPage(page))
  },
  uploadPostInterventionFilePage: async ({ page }, use) => {
    await use(new UploadPostInterventionFilePage(page))
  },
  postInterventionHabitatListPage: async ({ page }, use) => {
    await use(new PostInterventionHabitatListPage(page))
  },
  postInterventionHabitatDetailsPage: async ({ page }, use) => {
    await use(new PostInterventionHabitatDetailsPage(page))
  },
  createProjectFlow: async ({ page }, use) => {
    await use(new CreateProjectFlow(page))
  },
  uploadBaselineFileFlow: async ({ page }, use) => {
    await use(new UploadBaselineFileFlow(page))
  },
  uploadPostInterventionFileFlow: async ({ page }, use) => {
    await use(new UploadPostInterventionFileFlow(page))
  }
})

export { expect }
