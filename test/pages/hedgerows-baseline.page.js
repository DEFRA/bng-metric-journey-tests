import { readTileUnits, readTileValue } from '@utils/tile-value.js'

import { BasePage } from './base.page.js'
import { HEDGEROWS } from '@utils/unit-type-labels.js'

// Column order is fixed by `buildColumns` in
// common/helpers/baseline-habitat-grid.js. Seven columns, not the area page's
// eight: "Broad habitat" is an extraColumn the linear pages do not pass, because
// the field does not apply to hedgerows.
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
 * The hedgerows baseline (`/projects/{id}/hedgerows-baseline`, BMD-859) — the
 * feature table one level below the hedgerows summary.
 *
 * Same shape as `AreaBaselinePage`, with three differences worth knowing before
 * writing a locator against it:
 *
 *  - Sizes are kilometres (`formatLengthKmDisplay`, 7 s.f.) and the totals row
 *    uses 10 s.f., so the two are formatted by different functions.
 *  - The unit summary section carries no `<h2>` — the shared macro renders one
 *    only when given a headingHref — so it is reached by `aria-label`.
 *  - That label is "Hedgerows" while the details pane is "Hedgerows details", so
 *    the section locator must be `exact`; a substring match resolves to both.
 */
export class HedgerowsBaselinePage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', {
      name: 'Baseline for hedgerows',
      level: 1
    })
    this.navigation = page.getByRole('navigation', { name: 'Project summary' })
    this.uploadFileButton = page.getByRole('button', { name: 'Upload file' })
    this.resultsHeading = page.getByRole('heading', {
      name: 'Hedgerows results',
      level: 2
    })
    this.detailsHeading = page.getByRole('heading', {
      name: 'Hedgerows details',
      level: 2
    })
    // The MOJ scrollable pane, which is also the region naming the table — see
    // `scrollDetailsPaneToEnd`.
    this.detailsTable = page.getByRole('region', { name: 'Hedgerows details' })
  }

  async open(id) {
    return super.open(`/projects/${id}/hedgerows-baseline`)
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
    return this.page.getByRole('region', { name: HEDGEROWS, exact: true })
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

  /** A column heading's sort button, injected by the MOJ component. */
  sortButton(column) {
    return this.columnHeaders().nth(COLUMN[column]).getByRole('button')
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

  /**
   * Scroll the details pane fully right and report what happened.
   *
   * The scrollbar is a LAYOUT fact, not a markup one: the MOJ scrollable pane
   * shows a bar only when its content is wider than the box, and Chromium on
   * Linux paints overlay scrollbars that no screenshot would show. Measuring
   * the overflow — and then moving it — is the only way a test can witness the
   * requirement. A resulting `scrollLeft` above zero is the proof: a pane that
   * overflowed but clipped (`overflow: hidden`) would refuse to move.
   */
  async scrollDetailsPaneToEnd() {
    return this.detailsTable.evaluate((pane) => {
      pane.scrollLeft = pane.scrollWidth
      return {
        scrollWidth: pane.scrollWidth,
        clientWidth: pane.clientWidth,
        scrollLeft: pane.scrollLeft
      }
    })
  }
}
