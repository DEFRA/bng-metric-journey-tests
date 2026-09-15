import { readTileUnits, readTileValue } from '@utils/tile-value.js'

import { BasePage } from './base.page.js'
import { HEDGEROWS } from '@utils/unit-type-labels.js'

/**
 * The hedgerows post-intervention page
 * (`/projects/{id}/hedgerows-post-intervention`, BMD-860) — the
 * post-intervention twin of `HedgerowsBaselinePage`, one level below the
 * hedgerows summary.
 *
 * Three things to know before writing a locator against it:
 *
 *  - **The tabs are NOT the post-intervention habitat list's tabs.**
 *    `PostInterventionHabitatListPage` splits by unit type (Areas / Hedgerows /
 *    Watercourses); these split by intervention type (Retained / Enhanced /
 *    Created) within hedgerows alone. The two pages share no tab locators.
 *  - **A tab is not a link, in ARIA terms.** The GOV.UK Tabs component puts
 *    `role="tab"` on each `<a>`, which REPLACES the implicit link role — so
 *    `getByRole('link', { name: 'Enhanced' })` matches nothing. Reach a tab by
 *    its `tab` role; assert its anchor-ness through `href` (see `tabHref`).
 *  - **The unit summary section carries no `<h2>`** — the shared macro renders
 *    one only when given a `headingHref`, and this page gives none — so it is
 *    reached by `aria-label`. That label is "Hedgerows" while each tab panel's
 *    pane is "{Tab} hedgerow habitats", so the section locator must be `exact`.
 */
export class HedgerowsPostInterventionPage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', {
      name: 'Post intervention for hedgerows',
      level: 1
    })
    this.navigation = page.getByRole('navigation', { name: 'Project summary' })
    this.uploadFileButton = page.getByRole('button', { name: 'Upload file' })
    this.resultsHeading = page.getByRole('heading', {
      name: 'Hedgerows results',
      level: 2
    })
    this.detailsHeading = page.getByRole('heading', {
      name: 'Hedgerow habitat details',
      level: 2
    })
    this.tabs = page.getByRole('tab')
  }

  async open(id) {
    return super.open(`/projects/${id}/hedgerows-post-intervention`)
  }

  caption(projectName) {
    return this.page.getByText(projectName, { exact: true })
  }

  navItem(text) {
    return this.navigation.getByText(text, { exact: true })
  }

  navLink(text) {
    return this.navigation.getByRole('link', { name: text, exact: true })
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

  /**
   * An intervention-type tab by label — "Retained", "Enhanced" or "Created".
   * Exact, because "Retained" is also a substring of nothing else on the page
   * but the Intervention type column inside a panel would match a loose name.
   */
  tab(label) {
    return this.page.getByRole('tab', { name: label, exact: true })
  }

  /**
   * The in-page href a tab carries as an anchor (`#retained`). This is how a
   * test asserts the AC's "the tab labels are links" without going through the
   * link role, which `role="tab"` has taken over.
   */
  tabHref(label) {
    return `#${label.toLowerCase()}`
  }

  /**
   * A tab panel's `<h3>` — "Retained hedgerow habitats" and so on. GOV.UK hides
   * an unselected panel with a display:none modifier class, so this locator's
   * visibility is what tells the selected panel from the rest.
   */
  panelHeading(label) {
    return this.page.getByRole('heading', {
      name: `${label} hedgerow habitats`,
      level: 3
    })
  }

  /** The MOJ scrollable pane wrapping one tab's grid, named by its heading. */
  panel(label) {
    return this.page.getByRole('region', {
      name: `${label} hedgerow habitats`
    })
  }

  /**
   * One tab's grid (BMD-998). Every locator below is scoped to a tab LABEL,
   * because all three grids are in the DOM at once — an unscoped `getByRole`
   * would resolve against whichever panel GOV.UK happens to have visible.
   *
   * A hidden panel is `display:none`, so it is out of the accessibility tree
   * and these locators resolve to nothing until that tab is selected. Click
   * the tab first.
   */
  table(label) {
    return this.panel(label).getByRole('table')
  }

  columnHeaders(label) {
    return this.table(label).locator('thead th')
  }

  /**
   * A column heading's sort button, injected by the MOJ component, named by
   * the heading's own text — the column INDEX differs per intervention type
   * (Retained has 7 columns, Enhanced and Created 12), so indexes cannot be
   * shared the way `HedgerowsBaselinePage`'s single table shares them.
   *
   * Matched by accessible name and `exact`, not by `hasText`: that filter is a
   * case-insensitive SUBSTRING match, so "Condition" would also select the
   * "Target condition" heading sitting beside it in the Enhanced grid.
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
   * A column's index in a tab's grid, by heading text.
   *
   * Throws rather than returning -1, because neither caller below fails
   * usefully on one: `locator.nth(-1)` is Playwright's LAST element, so a
   * heading that no longer exists would assert against the final column — and
   * the totals row's final cell is empty, so `toHaveText('')` would pass.
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

  /** One feature row's cells, by the habitat reference in its first column. */
  async rowValues(label, reference) {
    const cells = await this.featureRows(label)
      .filter({
        has: this.page.getByRole('link', { name: reference, exact: true })
      })
      .locator('td')
      .allInnerTexts()
    return cells.map((cell) => cell.trim())
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
   * Scroll one tab's pane fully right and report what happened.
   *
   * The scrollbar is a LAYOUT fact, not a markup one: the pane shows a bar only
   * when its content is wider than the box, and Chromium on Linux paints
   * overlay scrollbars no screenshot would show. Measuring the overflow — and
   * then moving it — is the only way a test can witness the requirement. A
   * resulting `scrollLeft` above zero is the proof: a pane that overflowed but
   * clipped (`overflow: hidden`) would refuse to move.
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
