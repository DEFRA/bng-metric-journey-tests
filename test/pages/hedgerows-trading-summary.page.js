import { readTileValue } from '@utils/tile-value.js'
import { tagIn, tile } from '@utils/unit-type-tiles.js'
import { readTradingGrid } from '@utils/trading-grid.js'

import { BasePage } from './base.page.js'
import { HEDGEROWS } from '@utils/unit-type-labels.js'

export const HEDGEROWS_TRADING_SUMMARY_PATH = 'hedgerows-trading-summary'
export const MEDIUM = 'Medium'
export const LOW = 'Low'
export const VERY_LOW = 'Very low'
export const HEDGEROW_BAND_SECTIONS = {
  [MEDIUM]: 'Medium distinctiveness',
  [LOW]: 'Low distinctiveness',
  [VERY_LOW]: 'Very low distinctiveness'
}
export const MEDIUM_DEFICIT_TILE =
  'Medium distinctiveness unit deficit required to meet trading rules'
export const CUMULATIVE_SURPLUS_TILE = 'Cumulative surplus of units'
export const LOW_NET_CHANGE_TILE = 'Low distinctiveness net change in units'
export const MEDIUM_AVAILABLE_TILE =
  'Medium units available to offset low distinctiveness deficit'
export const VERY_LOW_NET_CHANGE_TILE =
  'Very low distinctiveness net change in units'
export const LOW_AVAILABLE_TILE =
  'Medium and low units available to offset very low distinctiveness deficit'
export const UNIT_CHANGE_COLUMNS = ['Habitat type', 'Unit change']
export const TOTAL_UNIT_CHANGE = 'Total unit change'

/**
 * The hedgerows trading summary (`/projects/{id}/hedgerows-trading-summary`,
 * BMD-1028) — the one page that renders the hedgerow trading-rules verdict PER
 * BAND (BMD-1003 AC1–AC3). The tiles on the other hedgerow pages carry only
 * the overall verdict.
 *
 * Same shape as the area trading summary: every section is a
 * `<section aria-labelledby>` on its `<h2>`, so each is a named region, and the
 * Trading summary table lists one row per band present, Medium → Very low.
 * Each band section holds one grid, and — unlike the watercourses page — every
 * grid ends in a "Total unit change" row.
 */
export class HedgerowsTradingSummaryPage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', {
      name: 'Hedgerows trading summary',
      level: 1
    })
    this.navigation = page.getByRole('navigation', { name: 'Project summary' })
    this.uploadFileButton = page.getByRole('button', { name: 'Upload file' })
    this.statusSection = page.getByRole('region', { name: 'Trading summary' })
  }

  async open(id) {
    return super.open(`/projects/${id}/${HEDGEROWS_TRADING_SUMMARY_PATH}`)
  }

  navItem(text) {
    return this.navigation.getByText(text, { exact: true })
  }

  navLink(text) {
    return this.navigation.getByRole('link', { name: text, exact: true })
  }

  caption(projectName) {
    return this.page.getByText(projectName)
  }

  /** The children listed under "Hedgerows", in rendered order. */
  hedgerowsNavChildren() {
    // The `has` locator resolves relative to each list item, so it is rooted
    // at the page rather than chained off `this.navigation`.
    return this.navigation
      .getByRole('listitem')
      .filter({
        has: this.page.getByRole('link', { name: HEDGEROWS, exact: true })
      })
      .getByRole('listitem')
  }

  /** The band names in the Trading summary table, in rendered order. */
  async bandNames() {
    const names = []
    for (const row of await this.statusSection.getByRole('row').all()) {
      const cells = await row.getByRole('cell').allInnerTexts()
      if (cells.length > 0) {
        names.push(cells[0].trim())
      }
    }
    return names
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

  /** A band's own section, below the Trading summary table. */
  bandSection(band) {
    return this.page.getByRole('region', {
      name: HEDGEROW_BAND_SECTIONS[band],
      exact: true
    })
  }

  bandTileValue(band, tileHeading) {
    return readTileValue(this.bandSection(band), tileHeading)
  }

  async bandTileValues(band, tileHeadings) {
    const values = []
    for (const heading of tileHeadings) {
      values.push(await this.bandTileValue(band, heading))
    }
    return values
  }

  bandTileTag(band, tileHeading) {
    return tagIn(tile(this.bandSection(band), tileHeading))
  }

  /**
   * A band's grid: column headings, then every body and footer row as trimmed
   * cell text — so the totals row is the last entry in `rows`.
   */
  readBandGrid(band) {
    const table = this.bandSection(band).getByRole('table')
    return readTradingGrid(table)
  }
}
