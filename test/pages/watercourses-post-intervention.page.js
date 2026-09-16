import { readTileUnits, readTileValue } from '@utils/tile-value.js'

import { BasePage } from './base.page.js'
import { WATERCOURSES } from '@utils/unit-type-labels.js'

/**
 * The watercourses post-intervention page
 * (`/projects/{id}/watercourses-post-intervention`, BMD-862) — the
 * post-intervention twin of `WatercoursesBaselinePage`, one level below the
 * watercourses summary.
 *
 * Shares `createHabitatPostInterventionController` with
 * `HedgerowsPostInterventionPage`, so the two page objects are the same shape
 * with a different habitat noun. They are kept separate rather than
 * parameterised because the factory takes a habitat key, a size reader and a
 * `baselineUnits` selector per unit type — any of which could be re-pointed at
 * hedgerows with the hedgerow suite staying green.
 *
 * Three things to know before writing a locator against it:
 *
 *  - **The tabs are NOT the post-intervention habitat list's tabs.**
 *    `PostInterventionHabitatListPage` splits by unit type (Areas / Hedgerows /
 *    Watercourses); these split by intervention type (Retained / Enhanced /
 *    Created) within watercourses alone. The two pages share no tab locators.
 *  - **A tab is not a link, in ARIA terms.** The GOV.UK Tabs component puts
 *    `role="tab"` on each `<a>`, which REPLACES the implicit link role — so
 *    `getByRole('link', { name: 'Enhanced' })` matches nothing. Reach a tab by
 *    its `tab` role; assert its anchor-ness through `href` (see `tabHref`).
 *  - **The unit summary section carries no `<h2>`** — the shared macro renders
 *    one only when given a `headingHref`, and this page gives none — so it is
 *    reached by `aria-label`. That label is "Watercourses" while each tab
 *    panel's pane is "{Tab} watercourse habitats", so the section locator must
 *    be `exact`.
 *
 * Only the BMD-862 page furniture is modelled here. The grids inside the tabs
 * are BMD-999 and have no journey coverage; see the flow doc.
 */
export class WatercoursesPostInterventionPage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', {
      name: 'Post intervention for watercourses',
      level: 1
    })
    this.navigation = page.getByRole('navigation', { name: 'Project summary' })
    this.uploadFileButton = page.getByRole('button', { name: 'Upload file' })
    this.resultsHeading = page.getByRole('heading', {
      name: 'Watercourses results',
      level: 2
    })
    this.detailsHeading = page.getByRole('heading', {
      name: 'Watercourses habitat details',
      level: 2
    })
    this.tabs = page.getByRole('tab')
  }

  async open(id) {
    return super.open(`/projects/${id}/watercourses-post-intervention`)
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

  /**
   * The left nav's current-page item. `markCurrent` deletes the href and the
   * macro renders `<strong aria-current="page">`, so this is what AC3's "in
   * bold, to indicate it is the current page" actually is in the markup — not
   * a CSS class.
   */
  currentNavItem() {
    return this.navigation.locator('strong[aria-current="page"]')
  }

  /** The unit summary section — labelled, not headed. See the class note. */
  unitSection() {
    return this.page.getByRole('region', { name: WATERCOURSES, exact: true })
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
   * Exact, because a loose name would also match the Intervention type value
   * rendered inside a panel.
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
   * A tab panel's `<h3>` — "Retained watercourse habitats" and so on. GOV.UK
   * hides an unselected panel with a display:none modifier class, so this
   * locator's visibility is what tells the selected panel from the rest.
   */
  panelHeading(label) {
    return this.page.getByRole('heading', {
      name: `${label} watercourse habitats`,
      level: 3
    })
  }
}
