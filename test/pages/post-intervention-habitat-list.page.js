import { BasePage } from './base.page.js'

export class PostInterventionHabitatListPage extends BasePage {
  constructor(page) {
    super(page)
    this.caption = page.getByTestId('app-heading-caption')
    this.heading = page.getByTestId('app-heading-title')
    this.summaryHeading = page.getByRole('heading', {
      name: 'Summary',
      level: 2
    })
    this.summaryTable = page.getByRole('table').first()
    this.continueButton = page.getByRole('button', { name: 'Continue' })
    this.uploadDifferentFileButton = page.getByRole('button', {
      name: 'Upload a different file'
    })
    this.areasTab = page.getByRole('tab', { name: 'Areas' })
    this.hedgerowsTab = page.getByRole('tab', { name: 'Hedgerows' })
    this.watercoursesTab = page.getByRole('tab', { name: 'Watercourses' })
    this.backLink = page.getByRole('link', { name: 'Back' })
  }

  async open(id) {
    await super.open(`/projects/${id}/post-intervention-habitat-list`)
  }
}
