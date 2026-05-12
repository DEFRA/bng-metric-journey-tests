import { ProjectDashboardPage } from '@pages/project-dashboard.page.js'
import { DefineProjectNamePage } from '@pages/define-project-name.page.js'
import { ProjectTaskListPage } from '@pages/project-task-list.page.js'

export class CreateProjectFlow {
  constructor(page) {
    this.page = page
    this.dashboard = new ProjectDashboardPage(page)
    this.defineProjectNamePage = new DefineProjectNamePage(page)
    this.taskListPage = new ProjectTaskListPage(page)
  }

  async createProject(name) {
    await this.dashboard.open()
    // When the user has no projects, /project-dashboard redirects straight to
    // /define-project-name — skip the button click in that case.
    if (!this.page.url().includes('/define-project-name')) {
      await this.dashboard.createProjectButton.click()
    }
    await this.defineProjectNamePage.enterProjectName(name)
    await this.defineProjectNamePage.submit()
  }
}
