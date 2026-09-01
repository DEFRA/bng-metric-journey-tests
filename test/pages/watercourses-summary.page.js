import { VIEW_ON_SITE_BASELINE, WATERCOURSES } from '@utils/unit-type-labels.js'

import { UnitTypeSummaryPage } from './unit-type-summary.page.js'

/**
 * The watercourses summary (`/projects/{id}/watercourses-summary`).
 *
 * Was the shared "under construction" placeholder until BMD-856/BMD-921
 * (frontend PR#250, 2026-09-01) built the real page. It now extends
 * unit-type-page.njk like the others, so it has the heading row's upload
 * button, a Results section and a Targets section.
 *
 * Same shape as the hedgerows summary, including the deliberate difference:
 * no watercourse baseline page exists, so the controller passes no
 * `baselineAction` and the tile falls back to the shared inert default —
 * "View on-site baseline", without the word "area" the linked area variant
 * carries.
 */
export class WatercoursesSummaryPage extends UnitTypeSummaryPage {
  constructor(page) {
    super(page, { label: WATERCOURSES, path: 'watercourses-summary' })
  }

  /** The inert baseline text. There is no watercourse baseline page. */
  viewOnSiteBaselineText() {
    return this.unitSection().getByText(VIEW_ON_SITE_BASELINE, { exact: true })
  }

  baselineAction() {
    return this.unitSection().getByRole('link', {
      name: VIEW_ON_SITE_BASELINE
    })
  }
}
