import { UnitTypeSummaryPage } from './unit-type-summary.page.js'
import {
  AREA_HABITATS,
  BASELINE_NAV_CHILD,
  VIEW_ON_SITE_AREA_POST_INTERVENTION,
  VIEW_ON_SITE_AREA_BASELINE
} from '@utils/unit-type-labels.js'

/**
 * The area habitats summary (`/projects/{id}/area-summary`, BMD-854).
 *
 * The only drill-down whose baseline tile is a LINK, and the only one whose nav
 * entry expands — area habitats is the sole unit type with a baseline page.
 */
export class AreaSummaryPage extends UnitTypeSummaryPage {
  constructor(page) {
    super(page, { label: AREA_HABITATS, path: 'area-summary' })
  }

  /**
   * The "Baseline" child that appears under Area habitats only while an area
   * page is current — the nav collapses the section you came from.
   */
  baselineNavChild() {
    return this.navigation.getByRole('link', { name: BASELINE_NAV_CHILD })
  }

  viewOnSiteAreaBaselineLink() {
    return this.unitSection().getByRole('link', {
      name: VIEW_ON_SITE_AREA_BASELINE
    })
  }

  /**
   * The post-intervention tile's link to the area post-intervention page
   * (BMD-858, frontend PR#350). Present only once the project has a
   * post-intervention document; before that the tile carries the upload link.
   */
  viewOnSiteAreaPostInterventionLink() {
    return this.unitSection().getByRole('link', {
      name: VIEW_ON_SITE_AREA_POST_INTERVENTION
    })
  }
}
