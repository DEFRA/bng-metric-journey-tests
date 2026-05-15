import { test as base, expect } from '@playwright/test'
import { HomePage } from '@pages/home.page.js'
import { LayoutPage } from '@pages/layout.page.js'
import { ProjectDashboardPage } from '@pages/project-dashboard.page.js'
import { DefineProjectNamePage } from '@pages/define-project-name.page.js'
import { ProjectTaskListPage } from '@pages/project-task-list.page.js'
import { ChangeProjectNamePage } from '@pages/change-project-name.page.js'
import { CreateProjectFlow } from '@flows/project-management/create-project.flow.js'

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
  createProjectFlow: async ({ page }, use) => {
    await use(new CreateProjectFlow(page))
  }
})

export { expect }
