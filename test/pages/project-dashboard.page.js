import { BasePage } from './base.page.js'

export class ProjectDashboardPage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', {
      name: 'Manage your Biodiversity Net Gain projects'
    })
    this.createProjectButton = page.getByRole('button', {
      name: 'Create project'
    })
    this.projectsTable = page.getByTestId('projects-table')
  }

  async open() {
    await super.open('/project-dashboard')
  }

  projectLink(name) {
    return this.page.getByRole('link', { name })
  }
}
