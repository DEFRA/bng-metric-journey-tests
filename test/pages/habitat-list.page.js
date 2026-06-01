import { BasePage } from './base.page.js'

export class HabitatListPage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', {
      name: 'On-site baseline habitats'
    })
    this.areasTab = page.getByRole('tab', { name: 'Areas' })
    this.hedgerowsTab = page.getByRole('tab', { name: 'Hedgerows' })
    this.watercoursesTab = page.getByRole('tab', { name: 'Watercourses' })
    this.continueButton = page.getByRole('link', { name: 'Continue' })
    this.uploadDifferentFileLink = page.getByRole('button', {
      name: 'Upload a different file'
    })
    this.backLink = page.getByRole('link', { name: 'Back' })
    this.firstAreaHabitatLink = page
      .getByRole('table')
      .getByRole('link')
      .first()
    this.firstCompleteStatus = page
      .getByRole('cell', { name: 'Complete' })
      .first()
  }

  async open(id) {
    await super.open(`/projects/${id}/habitat-list`)
  }
}
