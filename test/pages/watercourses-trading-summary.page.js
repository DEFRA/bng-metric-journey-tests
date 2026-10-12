import { BasePage } from './base.page.js'
import { WATERCOURSES } from '@utils/unit-type-labels.js'

export const WATERCOURSES_TRADING_SUMMARY_PATH = 'watercourses-trading-summary'

/**
 * The watercourses trading summary (`/projects/{id}/watercourses-trading-summary`,
 * BMD-1029, frontend PR#347). Reached from the Watercourses "Trading rules" nav
 * child and the "View watercourses trading rules" tile link (BMD-1031).
 *
 * Holds only what the entry-point tests need so far; the page's own content
 * (status table, band sections) belongs with BMD-1029's coverage.
 */
export class WatercoursesTradingSummaryPage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', {
      name: 'Watercourses trading summary',
      level: 1
    })
    this.navigation = page.getByRole('navigation', { name: 'Project summary' })
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
}
