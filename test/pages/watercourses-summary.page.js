import {
  VIEW_ON_SITE_BASELINE,
  VIEW_ON_SITE_WATERCOURSES_BASELINE,
  WATERCOURSES,
  WATERCOURSE_HABITATS_HEADING
} from '@utils/unit-type-labels.js'

import { UnitTypeSummaryPage } from './unit-type-summary.page.js'

/**
 * The watercourses summary (`/projects/{id}/watercourses-summary`).
 *
 * Was the shared "under construction" placeholder until BMD-856/BMD-921
 * (frontend PR#250, 2026-09-01) built the real page. It now extends
 * unit-type-page.njk like the others, so it has the heading row's upload
 * button, a Results section and a Targets section.
 *
 * Its H1 is the one place a unit-type page's copy diverges from its label:
 * frontend PR#271 (2026-09-07) re-headed it "Watercourse habitats" while the
 * nav item and the summary section's aria-label stayed "Watercourses", so the
 * heading is passed explicitly and `label` still drives the section locator.
 *
 * Same shape as the hedgerows summary, including its baseline tile: since
 * frontend PR#266 (2026-09-04) the controller passes
 * `watercoursesBaselineAction(href)`, so the tile is a LINK naming its own unit
 * type. Before that it fell back to the shared inert default "View on-site
 * baseline".
 */
export class WatercoursesSummaryPage extends UnitTypeSummaryPage {
  constructor(page) {
    super(page, {
      label: WATERCOURSES,
      path: 'watercourses-summary',
      heading: WATERCOURSE_HABITATS_HEADING
    })
  }

  /**
   * The shared inert default, which this tile no longer renders. Kept because
   * two tests assert its ABSENCE — the fallback when the controller stops
   * passing its own action, and BMD-897's post-intervention-only state.
   */
  viewOnSiteBaselineText() {
    return this.unitSection().getByText(VIEW_ON_SITE_BASELINE, { exact: true })
  }

  /** The baseline tile's link to the watercourses baseline page (BMD-861). */
  baselineLink() {
    return this.unitSection().getByRole('link', {
      name: VIEW_ON_SITE_WATERCOURSES_BASELINE
    })
  }
}
