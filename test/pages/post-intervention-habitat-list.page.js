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

    // Summary "Size" cells (Unit type | Size | …) — Site excludes special
    // habitats (trees); Area habitats includes them.
    this.siteSizeCell = this.summaryTable
      .getByRole('row')
      .filter({ hasText: 'Site' })
      .getByRole('cell')
      .nth(1)
    this.areaHabitatSizeCell = this.summaryTable
      .getByRole('row')
      .filter({ hasText: 'Area habitats' })
      .getByRole('cell')
      .nth(1)

    // Areas-tab habitat table and its total-row Size cell.
    this.areaHabitatsTable = page.locator('#area-habitats').getByRole('table')
    this.areaTableTotalSizeCell = this.areaHabitatsTable
      .getByRole('row')
      .filter({ hasText: 'Total' })
      .getByRole('cell')
      .nth(2)
    // One row per individual tree (urban or rural) in the Areas table.
    this.treeRows = this.areaHabitatsTable
      .getByRole('row')
      .filter({ hasText: /Urban tree|Rural tree/ })
  }

  // Areas-table row for a given habitat Ref (e.g. 'T001'). Refs are unique, so
  // the substring filter isolates a single row.
  treeRowByRef(ref) {
    return this.areaHabitatsTable.getByRole('row').filter({ hasText: ref })
  }

  async open(id) {
    await super.open(`/projects/${id}/post-intervention-habitat-list`)
  }
}
