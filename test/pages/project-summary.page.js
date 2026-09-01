import { readTileUnits, readTileValue } from '@utils/tile-value.js'

import { BasePage } from './base.page.js'

const UPLOAD_POST_INTERVENTION_TEXT = 'Upload on-site post intervention file'
const VIEW_ON_SITE_BASELINE_TEXT = 'View on-site baseline'
// BMD-857: the area-habitats baseline tile is the only one that links, and the
// only one whose wording says "area". Its href is the area baseline page.
const VIEW_ON_SITE_AREA_BASELINE_TEXT = 'View on-site area baseline'

/**
 * The project summary (`/projects/{id}/project-summary`, BMD-870) — the landing
 * page for a project that has a baseline but no post-intervention data.
 *
 * Each of the three unit-type sections is a `<section aria-labelledby=…>`, which
 * maps to the ARIA `region` role, so every section-scoped locator here is
 * reachable by role rather than by class. The tiles inside a section have no
 * role of their own (a heading followed by a paragraph), so their values are
 * read positionally off the section's text — see `tileValue`.
 */
export class ProjectSummaryPage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', { name: 'Summary', level: 1 })
    this.uploadFileButton = page.getByRole('button', { name: 'Upload file' })
    this.navigation = page.getByRole('navigation', { name: 'Project summary' })
    this.currentNavItem = this.navigation.getByText('Summary', { exact: true })
    this.projectDetailsHeading = page.getByRole('heading', {
      name: 'View project details',
      level: 2
    })
    this.projectDetailsBody = page.getByText(
      'View and amend your project details, including project name and target percentage'
    )
    this.projectDetailsLink = page.getByRole('link', {
      name: 'View project details'
    })
  }

  async open(id) {
    return super.open(`/projects/${id}/project-summary`)
  }

  caption(projectName) {
    return this.page.getByText(projectName)
  }

  /** One of "Area habitats", "Hedgerows", "Watercourses". */
  unitSection(label) {
    return this.page.getByRole('region', { name: label })
  }

  sectionHeading(label) {
    return this.page.getByRole('heading', { name: label, level: 2 })
  }

  /**
   * The status tag in a section's percentage tile — "Met" (green) or "Not met"
   * (red). Matches either: BMD-870 could only ever render "Not met", so an
   * earlier version of this locator hardcoded that string and silently failed
   * to find the "Met" tag BMD-852 introduced. Sections whose percentage is
   * "N/A" render no tag at all, so `toHaveCount(0)` still reads naturally.
   */
  statusTag(label) {
    return this.unitSection(label).getByText(/^(Met|Not met)$/)
  }

  uploadPostInterventionLink(label) {
    return this.unitSection(label).getByRole('link', {
      name: UPLOAD_POST_INTERVENTION_TEXT
    })
  }

  /**
   * The inert "View on-site baseline" text in a section's baseline tile. It
   * sits *below* the units value, so `tileValue` (which reads the line directly
   * under a tile heading) cannot reach it.
   */
  viewOnSiteBaselineText(label) {
    return this.unitSection(label).getByText(VIEW_ON_SITE_BASELINE_TEXT, {
      exact: true
    })
  }

  /**
   * The area-habitats baseline tile's link to the area baseline page (BMD-857).
   * Every other unit type keeps the inert `viewOnSiteBaselineText` below.
   */
  viewOnSiteAreaBaselineLink(label) {
    return this.unitSection(label).getByRole('link', {
      name: VIEW_ON_SITE_AREA_BASELINE_TEXT
    })
  }

  /** A unit-type section heading rendered as a link to its drill-down page. */
  sectionHeadingLink(label) {
    return this.sectionHeading(label).getByRole('link', { name: label })
  }

  navItem(text) {
    return this.navigation.getByText(text, { exact: true })
  }

  tileValue(sectionLabel, tileHeading) {
    return readTileValue(
      this.unitSection(sectionLabel),
      tileHeading,
      sectionLabel
    )
  }

  tileUnits(sectionLabel, tileHeading) {
    return readTileUnits(
      this.unitSection(sectionLabel),
      tileHeading,
      sectionLabel
    )
  }
}
