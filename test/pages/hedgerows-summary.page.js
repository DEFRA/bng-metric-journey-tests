import { UnitTypeSummaryPage } from './unit-type-summary.page.js'

const HEDGEROWS = 'Hedgerows'
const VIEW_ON_SITE_BASELINE_TEXT = 'View on-site baseline'

/**
 * The hedgerows summary (`/projects/{id}/hedgerows-summary`, BMD-855/BMD-919).
 *
 * Same shape as the area summary with one deliberate difference: no hedgerow
 * baseline page exists, so the controller passes no `baselineAction` and the
 * tile falls back to the shared inert default — "View on-site baseline",
 * WITHOUT the word "area" the linked area variant carries.
 */
export class HedgerowsSummaryPage extends UnitTypeSummaryPage {
  constructor(page) {
    super(page, { label: HEDGEROWS, path: 'hedgerows-summary' })
  }

  /** The inert baseline text. There is no hedgerow baseline page to link to. */
  viewOnSiteBaselineText() {
    return this.unitSection().getByText(VIEW_ON_SITE_BASELINE_TEXT, {
      exact: true
    })
  }

  baselineAction() {
    return this.unitSection().getByRole('link', {
      name: VIEW_ON_SITE_BASELINE_TEXT
    })
  }
}
