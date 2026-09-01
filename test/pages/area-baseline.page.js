import { BasePage } from './base.page.js'

const AREA_HABITATS = 'Area habitats'
const VIEW_ON_SITE_AREA_BASELINE_TEXT = 'View on-site area baseline'

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
    this.detailsTable = page.getByRole('region', {
      name: 'Area habitat details'
    })
  }

  async open(id) {
    return super.open(`/projects/${id}/area-baseline`)
  }

  navItem(text) {
    return this.navigation.getByText(text, { exact: true })
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
    return this.unitSection().getByText(VIEW_ON_SITE_AREA_BASELINE_TEXT, {
      exact: true
    })
  }

  /**
   * Value rendered directly beneath a tile heading in the unit summary. Tiles
   * carry no role of their own (a heading followed by a paragraph), so the
   * section text is split into lines and the line after the heading returned —
   * same approach as ProjectSummaryPage.tileValue.
   */
  async tileValue(tileHeading) {
    const text = await this.unitSection().innerText()
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    const headingIndex = lines.indexOf(tileHeading)

    if (headingIndex === -1 || headingIndex === lines.length - 1) {
      throw new Error(
        `No value found under "${tileHeading}". Rendered lines: ${JSON.stringify(lines)}`
      )
    }

    return lines[headingIndex + 1]
  }

  /** The numeric part of a "N.NN units" tile value. */
  async tileUnits(tileHeading) {
    const value = await this.tileValue(tileHeading)
    return Number(value.replace(' units', ''))
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
}

export { COLUMN }
