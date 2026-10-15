import { readTileValue } from '@utils/tile-value.js'
import { tagIn, tile } from '@utils/unit-type-tiles.js'

import { BasePage } from './base.page.js'
import { WATERCOURSES } from '@utils/unit-type-labels.js'

export const WATERCOURSES_TRADING_SUMMARY_PATH = 'watercourses-trading-summary'
export const MEDIUM = 'Medium'
export const LOW = 'Low'
export const WATERCOURSE_BAND_SECTIONS = {
  [MEDIUM]: 'Medium distinctiveness',
  [LOW]: 'Low distinctiveness'
}
// Watercourses word the Medium tile differently from area habitats and
// hedgerows ("…unit deficit required to meet trading rules").
export const MEDIUM_DEFICIT_TILE =
  'Remaining losses; like for like not satisfied'
export const LOW_TILES = {
  netChange: 'Low distinctiveness net change in units',
  mediumSurplus: 'Medium units available to offset low distinctiveness deficit',
  cumulativeSurplus: 'Cumulative surplus of units'
}

/**
 * The watercourses trading summary (`/projects/{id}/watercourses-trading-summary`,
 * BMD-1029, frontend PR#347). Reached from the Watercourses "Trading rules" nav
 * child and the "View watercourses trading rules" tile link (BMD-1031).
 *
 * Same shape as the area and hedgerows trading summaries: every section is a
 * `<section aria-labelledby>` on its `<h2>`, so each is a named region. Unlike
 * them, each band section holds exactly ONE grid and no grid has a totals row,
 * so a band's grid is simply the table inside its region.
 */
export class WatercoursesTradingSummaryPage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', {
      name: 'Watercourses trading summary',
      level: 1
    })
    this.navigation = page.getByRole('navigation', { name: 'Project summary' })
    this.uploadFileButton = page.getByRole('button', { name: 'Upload file' })
    this.statusSection = page.getByRole('region', { name: 'Trading summary' })
  }

  async open(id) {
    return super.open(`/projects/${id}/${WATERCOURSES_TRADING_SUMMARY_PATH}`)
  }

  navItem(text) {
    return this.navigation.getByText(text, { exact: true })
  }

  navLink(text) {
    return this.navigation.getByRole('link', { name: text, exact: true })
  }

  /** The children listed under "Watercourses", in rendered order. */
  watercoursesNavChildren() {
    // The `has` locator resolves relative to each list item, so it is rooted
    // at the page rather than chained off `this.navigation`.
    return this.navigation
      .getByRole('listitem')
      .filter({
        has: this.page.getByRole('link', { name: WATERCOURSES, exact: true })
      })
      .getByRole('listitem')
  }

  caption(projectName) {
    return this.page.getByText(projectName)
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
      name: WATERCOURSE_BAND_SECTIONS[band],
      exact: true
    })
  }

  bandTileValue(band, tileHeading) {
    return readTileValue(this.bandSection(band), tileHeading)
  }

  bandTileTag(band, tileHeading) {
    return tagIn(tile(this.bandSection(band), tileHeading))
  }

  /**
   * A band's grid: column headings, then every body and footer row as trimmed
   * cell text — so a totals row, if one rendered, would show up in `rows`.
   */
  async readBandGrid(band) {
    const table = this.bandSection(band).getByRole('table')
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
