import { UnitTypeSummaryPage } from './unit-type-summary.page.js'
import {
  HEDGEROWS,
  VIEW_ON_SITE_BASELINE,
  VIEW_ON_SITE_HEDGEROWS_BASELINE
} from '@utils/unit-type-labels.js'

/**
 * The hedgerows summary (`/projects/{id}/hedgerows-summary`, BMD-855/BMD-919).
 *
 * Same shape as the area summary, including the baseline tile: since frontend
 * PR#266 (2026-09-04) the controller passes `hedgerowsBaselineAction(href)`, so
 * the tile is a LINK naming its own unit type. Before that it passed no
 * `baselineAction` and fell back to the shared inert default "View on-site
 * baseline" — the half of BMD-859 AC1 that failed manual validation.
 */
export class HedgerowsSummaryPage extends UnitTypeSummaryPage {
  constructor(page) {
    super(page, { label: HEDGEROWS, path: 'hedgerows-summary' })
  }

  /**
   * The shared inert default, which this tile no longer renders. Kept because
   * two tests assert its ABSENCE: it is what the tile falls back to both when
   * the controller stops passing its own action and in BMD-897's
   * post-intervention-only state.
   */
  viewOnSiteBaselineText() {
    return this.unitSection().getByText(VIEW_ON_SITE_BASELINE, {
      exact: true
    })
  }

  /** The baseline tile's link to the hedgerows baseline page (BMD-859 AC1). */
  baselineLink() {
    return this.unitSection().getByRole('link', {
      name: VIEW_ON_SITE_HEDGEROWS_BASELINE
    })
  }
}
