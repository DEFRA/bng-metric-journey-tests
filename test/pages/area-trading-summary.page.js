import { readTileValue } from '@utils/tile-value.js'
import { tagIn, tile } from '@utils/unit-type-tiles.js'

import { BasePage } from './base.page.js'
import { AREA_HABITATS } from '@utils/unit-type-labels.js'

export const MEDIUM_DEFICIT_TILE =
  'Medium distinctiveness unit deficit required to meet trading rules'
export const LOW_TILES = {
  netChange: 'Low distinctiveness net change in units',
  mediumSurplus: 'Medium units available to offset low distinctiveness deficit',
  cumulativeSurplus: 'Cumulative surplus of units'
}

/**
 * The area habitats trading summary (`/projects/{id}/area-trading-summary`,
 * BMD-1024) — the trading-rules verdict per distinctiveness band and the
 * per-habitat unit changes it is built from.
 *
 * Every section is a `<section aria-labelledby>` on its `<h2>`, so each is a
 * named region. The grids carry no caption, so a grid is found by a cell it
 * contains rather than by position or by the `<h3>` above it — Playwright has
 * no sibling traversal that stays inside the role-first selector rules.
 */
export class AreaTradingSummaryPage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', {
      name: 'Area habitats trading summary',
      level: 1
    })
    this.navigation = page.getByRole('navigation', { name: 'Project summary' })
    this.uploadFileButton = page.getByRole('button', { name: 'Upload file' })
    this.statusSection = page.getByRole('region', { name: 'Trading summary' })
    this.mediumSection = page.getByRole('region', {
      name: 'Medium distinctiveness'
    })
    this.lowSection = page.getByRole('region', { name: 'Low distinctiveness' })
  }

  async open(id) {
    return super.open(`/projects/${id}/area-trading-summary`)
  }

  caption(projectName) {
    return this.page.getByText(projectName)
  }

  navItem(text) {
    return this.navigation.getByText(text, { exact: true })
  }

  navLink(text) {
    return this.navigation.getByRole('link', { name: text, exact: true })
  }

  /** The children listed under "Area habitats", in rendered order. */
  areaNavChildren() {
    // The `has` locator resolves relative to each list item, so it is rooted
    // at the page rather than chained off `this.navigation`.
    return this.navigation
      .getByRole('listitem')
      .filter({
        has: this.page.getByRole('link', { name: AREA_HABITATS, exact: true })
      })
      .getByRole('listitem')
  }

  /** The status cell of a band's row in the Trading summary table. */
  statusCell(band) {
    return this.statusSection
      .getByRole('row')
      .filter({ has: this.page.getByRole('cell', { name: band, exact: true }) })
      .getByRole('cell')
      .last()
  }

  statusTag(band) {
    return tagIn(this.statusCell(band))
  }

  broadHabitatHeading(name) {
    return this.mediumSection.getByRole('heading', {
      name,
      level: 3,
      exact: true
    })
  }

  /** The grid in `section` that holds a cell reading `cellText`. */
  gridContaining(section, cellText) {
    return section.getByRole('table').filter({
      has: this.page.getByRole('cell', { name: cellText, exact: true })
    })
  }

  readGridContaining(section, cellText) {
    return this.readGrid(this.gridContaining(section, cellText))
  }

  mediumDeficitValue() {
    return readTileValue(this.mediumSection, MEDIUM_DEFICIT_TILE)
  }

  mediumDeficitTag() {
    return tagIn(tile(this.mediumSection, MEDIUM_DEFICIT_TILE))
  }

  lowTileValue(heading) {
    return readTileValue(this.lowSection, heading)
  }

  /** Column headings then every body and footer row, as trimmed cell text. */
  async readGrid(table) {
    const headers = await table.getByRole('columnheader').allInnerTexts()
    const rows = []
    for (const row of await table.getByRole('row').all()) {
      const cells = await row.getByRole('cell').allInnerTexts()
      if (cells.length > 0) {
        rows.push(cells.map((cell) => cell.trim()))
      }
    }
    return { headers: headers.map((header) => header.trim()), rows }
  }
}
