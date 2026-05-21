import { BasePage } from './base.page.js'

export class ProjectTaskListPage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', {
      name: 'Add your Biodiversity Net Gain project details'
    })
    this.taskList = page.getByTestId('project-task-list-component')
    this.informationParagraph = page.getByTestId(
      'project-task-list-information'
    )
  }

  async open(id) {
    await super.open(`/add-project-details/${id}`)
  }

  taskItem(name) {
    return this.taskList.getByRole('link', { name })
  }

  taskStatus(name) {
    return this.taskList.getByText(name)
  }
}
