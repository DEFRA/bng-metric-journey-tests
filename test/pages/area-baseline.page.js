import { readTileUnits, readTileValue } from '@utils/tile-value.js'

import { BasePage } from './base.page.js'
import {
  AREA_HABITATS,
  VIEW_ON_SITE_AREA_BASELINE
} from '@utils/unit-type-labels.js'

// Column order is fixed by COLUMNS in area-baseline/controller.js.
const COLUMN = {
  ref: 0,
  units: 1,
  size: 2,
  broadHabitat: 3,
  habitatType: 4,
  distinctiveness: 5,
  condition: 6,
  strategicSignificance: 7
}

/**
 * The area habitats baseline (`/projects/{id}/area-baseline`, BMD-857) — the
 * feature table one level below the area summary.
 *
 * The table lists habitat parcels and individual trees **together**, sorted by
 * ref: `collectAreaFeatures` concatenates `baseline.habitats` and
 * `baseline.trees`, so there is no separate trees table and the totals row
 * spans both.
 *
 * As on every drill-down page the unit summary section carries no `<h2>` — the
 * shared macro renders one only when given a headingHref — so it is reachable
 * by `aria-label`, not by a heading locator.
 */
export class AreaBaselinePage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', {
      name: 'Baseline for area habitats',
      level: 1
    })
    this.navigation = page.getByRole('navigation', { name: 'Project summary' })
    this.uploadFileButton = page.getByRole('button', { name: 'Upload file' })
    this.resultsHeading = page.getByRole('heading', {
      name: 'Area habitats results',
      level: 2
    })
    this.detailsHeading = page.getByRole('heading', {
      name: 'Area habitat details',
      level: 2
    })
    // The MOJ scrollable pane. It is also the region that names the table, so
    // one locator serves both — see `scrollDetailsPaneToEnd`.
    this.detailsTable = page.getByRole('region', {
      name: 'Area habitat details'
    })
  }

  async open(id) {
    return super.open(`/projects/${id}/area-baseline`)
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
    return this.page.getByRole('region', { name: AREA_HABITATS })
  }

  /**
   * The inert "View on-site area baseline" text. The area summary links this;
   * here the controller passes `areaBaselineAction()` with no href, because the
   * user is already on the page it would point at.
   */
  viewOnSiteAreaBaselineText() {
    return this.unitSection().getByText(VIEW_ON_SITE_AREA_BASELINE, {
      exact: true
    })
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

  /** Cell text for a given row index and named column. */
  async cellText(rowIndex, column) {
    return this.featureRows()
      .nth(rowIndex)
      .locator('td')
      .nth(COLUMN[column])
      .innerText()
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
