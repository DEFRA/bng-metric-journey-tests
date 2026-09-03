import { readTileUnits, readTileValue } from '@utils/tile-value.js'
import {
  UPLOAD_POST_INTERVENTION,
  VIEW_ON_SITE_POST_INTERVENTION
} from '@utils/unit-type-labels.js'

import { BasePage } from './base.page.js'

/**
 * Shared shape of the unit-type drill-down pages (BMD-854): area summary,
 * hedgerows summary, and — once it stops being a placeholder — watercourses.
 * They all extend `unit-type-page.njk`, so they differ only in their label,
 * their path, and whether their baseline tile links anywhere.
 *
 * Two things to know before writing a locator against any of them:
 *
 *  - The unit summary section carries **no `<h2>`**. `appUnitTypeSummary`
 *    renders a heading only when given a `headingHref`, and these pages give
 *    none — so the section is reachable by `aria-label`, not `aria-labelledby`,
 *    and a heading locator that works on the project summary finds nothing.
 *  - They add a **Targets** section the project summary does not have.
 *
 * Tiles carry no role of their own (a heading followed by a paragraph), so
 * their values are read positionally off the section text.
 */
export class UnitTypeSummaryPage extends BasePage {
  constructor(page, { label, path }) {
    super(page)
    this.label = label
    this.path = path
    this.heading = page.getByRole('heading', { name: label, level: 1 })
    this.uploadFileButton = page.getByRole('button', { name: 'Upload file' })
    this.navigation = page.getByRole('navigation', { name: 'Project summary' })
    this.resultsHeading = page.getByRole('heading', {
      name: 'Results',
      level: 2
    })
    this.targetsSection = page.getByRole('region', { name: 'Targets' })
  }

  async open(id) {
    return super.open(`/projects/${id}/${this.path}`)
  }

  caption(projectName) {
    return this.page.getByText(projectName)
  }

  /** The unit summary section — labelled, not headed. See the class note. */
  unitSection() {
    return this.page.getByRole('region', { name: this.label })
  }

  /**
   * The post-intervention tile's upload link. Present only while the project
   * has no post-intervention document — once it has one the tile carries inert
   * text instead, so this is the locator that tells the two states apart.
   */
  uploadPostInterventionLink() {
    return this.unitSection().getByRole('link', {
      name: UPLOAD_POST_INTERVENTION
    })
  }

  /** The inert text that replaces the upload link once the document exists. */
  viewOnSitePostInterventionText() {
    return this.unitSection().getByText(VIEW_ON_SITE_POST_INTERVENTION, {
      exact: true
    })
  }

  navItem(text) {
    return this.navigation.getByText(text, { exact: true })
  }

  navLink(text) {
    return this.navigation.getByRole('link', { name: text })
  }

  tileValueIn(region, tileHeading) {
    return readTileValue(region, tileHeading)
  }

  tileValue(tileHeading) {
    return this.tileValueIn(this.unitSection(), tileHeading)
  }

  targetValue(tileHeading) {
    return this.tileValueIn(this.targetsSection, tileHeading)
  }

  tileUnits(tileHeading) {
    return readTileUnits(this.unitSection(), tileHeading)
  }

  targetUnits(tileHeading) {
    return readTileUnits(this.targetsSection, tileHeading)
  }
}
