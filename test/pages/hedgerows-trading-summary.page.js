import { readTileValue } from '@utils/tile-value.js'
import { tagIn } from '@utils/unit-type-tiles.js'

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

/**
 * The hedgerows trading summary (`/projects/{id}/hedgerows-trading-summary`,
 * BMD-1028) — the one page that renders the hedgerow trading-rules verdict PER
 * BAND (BMD-1003 AC1–AC3). The tiles on the other hedgerow pages carry only
 * the overall verdict.
 *
 * Same shape as the area trading summary: every section is a
 * `<section aria-labelledby>` on its `<h2>`, so each is a named region, and the
 * Trading summary table lists one row per band present, Medium → Very low.
 */
export class HedgerowsTradingSummaryPage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', {
      name: 'Hedgerows trading summary',
      level: 1
    })
    this.navigation = page.getByRole('navigation', { name: 'Project summary' })
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
}
