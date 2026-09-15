import { readTileUnits, readTileValue } from '@utils/tile-value.js'

import { BasePage } from './base.page.js'
import { WATERCOURSES } from '@utils/unit-type-labels.js'

// Column order is fixed by `buildColumns` in
// common/helpers/baseline-habitat-grid.js. Seven columns, not the area page's
// eight: "Broad habitat" is an extraColumn the linear pages do not pass,
// because the field does not apply to watercourses.
const COLUMN = {
  ref: 0,
  units: 1,
  size: 2,
  habitatType: 3,
  distinctiveness: 4,
  condition: 5,
  strategicSignificance: 6
}

/**
 * The watercourses baseline (`/projects/{id}/watercourses-baseline-summary`, BMD-861) —
 * the feature table one level below the watercourses summary.
 *
 * The hedgerow twin of this page, `HedgerowsBaselinePage`, is the same shape:
 * both come from `createLinearHabitatBaselineController`, so sizes are
 * kilometres (`formatLengthKmDisplay`, 7 s.f.) with a 10 s.f. totals row, and
 * the unit summary section carries no `<h2>` — the shared macro renders one only
 * when given a headingHref — so it is reached by `aria-label`.
 *
 * That label is "Watercourses" while the details pane is "Watercourses details",
 * so the section locator must be `exact`; a substring match resolves to both.
 *
 * Unlike the summary page above it, this page's H1 keeps the unit-type label:
 * frontend PR#271 re-headed `/watercourses-summary` to "Watercourse habitats"
 * and left this one alone.
 */
export class WatercoursesBaselinePage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', {
      name: 'Baseline for watercourses',
      level: 1
    })
    this.navigation = page.getByRole('navigation', { name: 'Project summary' })
    this.uploadFileButton = page.getByRole('button', { name: 'Upload file' })
    this.resultsHeading = page.getByRole('heading', {
      name: 'Watercourses results',
      level: 2
    })
    this.detailsHeading = page.getByRole('heading', {
      name: 'Watercourses details',
      level: 2
    })
    // The MOJ scrollable pane, which is also the region naming the table.
    this.detailsTable = page.getByRole('region', {
      name: 'Watercourses details'
    })
  }

  async open(id) {
    return super.open(`/projects/${id}/watercourses-baseline-summary`)
  }

  caption(projectName) {
    return this.page.getByText(projectName, { exact: true })
  }

  navItem(text) {
    return this.navigation.getByText(text, { exact: true })
  }

  navLink(text) {
    return this.navigation.getByRole('link', { name: text })
  }

  /** The unit summary section — labelled, not headed. See the class note. */
  unitSection() {
    return this.page.getByRole('region', { name: WATERCOURSES, exact: true })
  }

  /** Every tile heading in the unit summary section, in rendered order. */
  tileHeadings() {
    return this.unitSection().getByRole('heading', { level: 3 })
  }

  tileValue(tileHeading) {
    return readTileValue(this.unitSection(), tileHeading)
  }

  tileUnits(tileHeading) {
    return readTileUnits(this.unitSection(), tileHeading)
  }

  table() {
    return this.detailsTable.getByRole('table')
  }

  columnHeaders() {
    return this.table().locator('thead th')
  }

  featureRows() {
    return this.table().locator('tbody tr')
  }

  totalsRow() {
    return this.table().locator('tfoot tr')
  }

  /** Every value in a named column, in rendered order. */
  async columnValues(column) {
    return this.featureRows()
      .locator(`td:nth-child(${COLUMN[column] + 1})`)
      .allInnerTexts()
  }

  totalsCell(column) {
    return this.totalsRow().locator('td').nth(COLUMN[column])
  }

  refLink(reference) {
    return this.table().getByRole('link', { name: reference, exact: true })
  }
}
