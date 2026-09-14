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
}
