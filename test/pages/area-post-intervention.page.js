import { BasePage } from './base.page.js'

/**
 * The area habitats post-intervention page
 * (`/projects/{id}/area-post-intervention`, BMD-858 / BMD-997) — the area twin
 * of `HedgerowsPostInterventionPage`, one level below the area summary.
 *
 * Kept as its own page object rather than a subclass of the hedgerow one, for
 * the same reason the hedgerow and watercourse pages are separate: every name
 * on the page is built from the habitat noun, and the grid's column set and
 * size unit differ per unit type.
 *
 * Two things to know before writing a locator against it:
 *
 *  - **A tab is not a link, in ARIA terms.** The GOV.UK Tabs component puts
 *    `role="tab"` on each `<a>`, which replaces the implicit link role — reach
 *    a tab by its `tab` role.
 *  - **All three grids are in the DOM at once.** A hidden panel is
 *    `display:none`, so it is out of the accessibility tree and every grid
 *    locator below resolves to nothing until that tab is selected. Click the
 *    tab first.
 */
export class AreaPostInterventionPage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', {
      name: 'Post intervention for area habitats',
      level: 1
    })
    this.detailsHeading = page.getByRole('heading', {
      name: 'Area habitat details',
      level: 2
    })
    this.tabs = page.getByRole('tab')
  }

  async open(id) {
    return super.open(`/projects/${id}/area-post-intervention`)
  }

  /** An intervention-type tab by label — "Retained", "Enhanced" or "Created". */
  tab(label) {
    return this.page.getByRole('tab', { name: label, exact: true })
  }

  /**
   * A tab panel's `<h3>` — "Retained area habitats" and so on. Its visibility
   * is what tells the selected panel from the rest.
   */
  panelHeading(label) {
    return this.page.getByRole('heading', {
      name: `${label} area habitats`,
      level: 3
    })
  }

  /** The MOJ scrollable pane wrapping one tab's grid, named by its heading. */
  panel(label) {
    return this.page.getByRole('region', { name: `${label} area habitats` })
  }

  table(label) {
    return this.panel(label).getByRole('table')
  }

  columnHeaders(label) {
    return this.table(label).locator('thead th')
  }

  /**
   * A column heading's sort button, injected by the MOJ component. Matched by
   * accessible name and `exact` — a `hasText` filter is a case-insensitive
   * substring match, so "Condition" would also select "Target condition".
   */
  sortButton(label, heading) {
    return this.table(label)
      .locator('thead')
      .getByRole('button', { name: heading, exact: true })
  }

  featureRows(label) {
    return this.table(label).locator('tbody tr')
  }

  totalsRow(label) {
    return this.table(label).locator('tfoot tr')
  }

  /** Every column heading in a tab's grid, in rendered order. */
  async columnHeadings(label) {
    const headings = await this.columnHeaders(label).allInnerTexts()
    return headings.map((heading) => heading.trim())
  }

  /**
   * A column's index in a tab's grid, by heading text. Throws rather than
   * returning -1: `locator.nth(-1)` is Playwright's LAST element, so a missing
   * heading would silently assert against the final column instead.
   */
  async columnIndex(label, heading) {
    const headings = await this.columnHeadings(label)
    const index = headings.indexOf(heading)

    if (index === -1) {
      throw new Error(
        `No "${heading}" column in the ${label} grid — found: ${headings.join(', ')}`
      )
    }

    return index
  }

  /** Every value in a named column, in rendered order. */
  async columnValues(label, heading) {
    const index = await this.columnIndex(label, heading)
    const values = await this.featureRows(label)
      .locator(`td:nth-child(${index + 1})`)
      .allInnerTexts()
    return values.map((value) => value.trim())
  }

  /** One feature row's cells, keyed by column heading, found by its Ref. */
  async rowByRef(label, reference) {
    const headings = await this.columnHeadings(label)
    const cells = await this.featureRows(label)
      .filter({
        has: this.page.getByRole('link', { name: reference, exact: true })
      })
      .locator('td')
      .allInnerTexts()
    return Object.fromEntries(
      headings.map((heading, index) => [heading, cells[index]?.trim()])
    )
  }

  async totalsCell(label, heading) {
    return this.totalsRow(label)
      .locator('td')
      .nth(await this.columnIndex(label, heading))
  }

  /** Every column heading's `aria-sort` — how MOJ marks the sorted column. */
  sortStates(label) {
    return this.columnHeaders(label).evaluateAll((cells) =>
      cells.map((cell) => cell.getAttribute('aria-sort'))
    )
  }

  refLink(label, reference) {
    return this.table(label).getByRole('link', {
      name: reference,
      exact: true
    })
  }

  /**
   * Scroll one tab's pane fully right and report what happened. A pane that
   * overflowed but clipped (`overflow: hidden`) would refuse to move, so a
   * resulting `scrollLeft` above zero is the proof it scrolls.
   */
  async scrollPaneToEnd(label) {
    return this.panel(label).evaluate((element) => {
      element.scrollLeft = element.scrollWidth
      return {
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        scrollLeft: element.scrollLeft
      }
    })
  }
}
