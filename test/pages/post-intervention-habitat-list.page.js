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

    // Areas-tab habitat table; its total-row Size cell and total-row Units cell.
    this.areaHabitatsTable = page.locator('#area-habitats').getByRole('table')
    this.areaTableTotalSizeCell = this.areaHabitatsTable
      .getByRole('row')
      .filter({ hasText: 'Total' })
      .getByRole('cell')
      .nth(2)
    this.areaTableTotalUnitsCell = this.#totalUnitsCell(this.areaHabitatsTable)
    // One row per individual tree (urban or rural) in the Areas table.
    this.treeRows = this.areaHabitatsTable
      .getByRole('row')
      .filter({ hasText: /Urban tree|Rural tree/ })

    // Hedgerows-tab and Watercourses-tab tables, each tab-hidden until selected.
    this.hedgerowsTable = page.locator('#hedgerows').getByRole('table')
    this.hedgerowTableTotalUnitsCell = this.#totalUnitsCell(this.hedgerowsTable)

    this.watercoursesTable = page.locator('#watercourses').getByRole('table')
    this.watercourseTableTotalUnitsCell = this.#totalUnitsCell(
      this.watercoursesTable
    )
  }

  // Total-row Units cell for a tab table (Units is column index 5 in the
  // Areas, Hedgerows and Watercourses tables alike).
  #totalUnitsCell(table) {
    return table
      .getByRole('row')
      .filter({ hasText: 'Total' })
      .getByRole('cell')
      .nth(5)
  }

  // Row in a tab table for a given Ref. Refs are unique, so the substring
  // filter isolates a single row.
  #rowByRef(table, ref) {
    return table.getByRole('row').filter({ hasText: ref })
  }

  hedgerowRowByRef(ref) {
    return this.#rowByRef(this.hedgerowsTable, ref)
  }

  watercourseRowByRef(ref) {
    return this.#rowByRef(this.watercoursesTable, ref)
  }

  areaRowByRef(ref) {
    return this.#rowByRef(this.areaHabitatsTable, ref)
  }

  // Individual-tree row by Ref — alias retained for the BNG-587 tree tests.
  treeRowByRef(ref) {
    return this.areaRowByRef(ref)
  }

  async open(id) {
    await super.open(`/projects/${id}/post-intervention-habitat-list`)
  }
}
