import { BasePage } from './base.page.js'

export class HabitatListPage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', {
      name: 'On-site baseline habitats'
    })
    this.summaryHeading = page.getByRole('heading', {
      name: 'Summary',
      level: 2
    })
    this.habitatDetailsHeading = page.getByRole('heading', {
      name: 'Habitat details',
      level: 2
    })
    this.summaryTable = page.getByRole('table').first()
    this.areaHabitatSizeCell = this.summaryTable
      .getByRole('row')
      .filter({ hasText: 'Area habitats' })
      .getByRole('cell')
      .nth(1)
    this.hedgerowSizeCell = this.summaryTable
      .getByRole('row')
      .filter({ hasText: 'Hedgerows' })
      .getByRole('cell')
      .nth(1)
    this.watercourseSizeCell = this.summaryTable
      .getByRole('row')
      .filter({ hasText: 'Watercourses' })
      .getByRole('cell')
      .nth(1)
    this.areaHabitatUnitsCell = this.summaryTable
      .getByRole('row')
      .filter({ hasText: 'Area habitats' })
      .getByRole('cell')
      .nth(2)
    this.hedgerowUnitsCell = this.summaryTable
      .getByRole('row')
      .filter({ hasText: 'Hedgerows' })
      .getByRole('cell')
      .nth(2)
    this.watercourseUnitsCell = this.summaryTable
      .getByRole('row')
      .filter({ hasText: 'Watercourses' })
      .getByRole('cell')
      .nth(2)
    this.continueButton = page.getByRole('button', { name: 'Continue' })
    this.areasTab = page.getByRole('tab', { name: 'Areas' })
    this.hedgerowsTab = page.getByRole('tab', { name: 'Hedgerows' })
    this.watercoursesTab = page.getByRole('tab', { name: 'Watercourses' })
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
    this.areaHabitatsTable = page.locator('#area-habitats').getByRole('table')
    this.hedgerowsTable = page.locator('#hedgerows').getByRole('table')
    this.watercoursesTable = page.locator('#watercourses').getByRole('table')
  }

  async open(id) {
    await super.open(`/projects/${id}/baseline-habitat-list`)
  }

  async openTab(projectId, tab) {
    await this.page.goto(`/projects/${projectId}/baseline-habitat-list`)
    const tabLocator =
      tab === 'hedgerows' ? this.hedgerowsTab : this.watercoursesTab
    await tabLocator.click()
  }
}
