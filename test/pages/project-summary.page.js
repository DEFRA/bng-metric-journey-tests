import { readTileUnits, readTileValue } from '@utils/tile-value.js'
import {
  netPercentageTag,
  tile,
  tradingRulesTag
} from '@utils/unit-type-tiles.js'
import {
  TILE_TRADING_RULES,
  UPLOAD_POST_INTERVENTION,
  VIEW_ON_SITE_HEDGEROWS_BASELINE,
  VIEW_ON_SITE_HEDGEROWS_POST_INTERVENTION,
  VIEW_ON_SITE_WATERCOURSES_POST_INTERVENTION,
  VIEW_ON_SITE_WATERCOURSES_BASELINE
} from '@utils/unit-type-labels.js'

import { BasePage } from './base.page.js'

const VIEW_ON_SITE_BASELINE_TEXT = 'View on-site baseline'
// BMD-857: the area-habitats baseline tile is the only one that links, and the
// only one whose wording says "area". Its href is the area baseline page.
const VIEW_ON_SITE_AREA_BASELINE_TEXT = 'View on-site area baseline'
// BMD-870 deferred the trading-rules clickthrough; the tile still renders this
// as inert text rather than a link.
const VIEW_TRADING_RULES_TEXT = 'View trading rules'

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

  tileHeading(sectionLabel, headingText) {
    return this.unitSection(sectionLabel).getByRole('heading', {
      name: headingText,
      exact: true
    })
  }

  /**
   * The status tag in a section's percentage tile — "Met" (green) or "Not met"
   * (red). Matches either: BMD-870 could only ever render "Not met", so an
   * earlier version of this locator hardcoded that string and silently failed
   * to find the "Met" tag BMD-852 introduced. Sections whose percentage is
   * "N/A" render no tag at all, so `toHaveCount(0)` still reads naturally.
   *
   * Scoped to the percentage TILE rather than the section since BMD-1008
   * (frontend PR#317): the Trading Rules tile beside it now carries a second
   * tag matching the same text, so the old section-wide text locator resolved
   * to two elements and failed strict mode. See `@utils/unit-type-tiles.js`.
   */
  statusTag(label) {
    return netPercentageTag(this.unitSection(label))
  }

  /**
   * The area-habitat trading-rules status tag (BMD-1008) — a different verdict
   * from `statusTag` above, and the one that can disagree with it. Renders for
   * area habitats only; the hedgerow and watercourse rules are separate
   * tickets, so their tiles hold the "View trading rules" text alone.
   */
  tradingRulesTag(label) {
    return tradingRulesTag(this.unitSection(label))
  }

  /**
   * The inert "View trading rules" text inside a section's Trading Rules tile.
   *
   * Scoped to the tile rather than read off the line under its heading: until
   * BMD-1008 that line WAS this text, and the status tag now sits between the
   * two, so `tileValue` returns the status instead.
   */
  viewTradingRulesText(label) {
    return tile(this.unitSection(label), TILE_TRADING_RULES).getByText(
      VIEW_TRADING_RULES_TEXT,
      { exact: true }
    )
  }

  uploadPostInterventionLink(label) {
    return this.unitSection(label).getByRole('link', {
      name: UPLOAD_POST_INTERVENTION
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
   */
  viewOnSiteAreaBaselineLink(label) {
    return this.unitSection(label).getByRole('link', {
      name: VIEW_ON_SITE_AREA_BASELINE_TEXT
    })
  }

  /** The hedgerows equivalent, added by BMD-859/861. */
  viewOnSiteHedgerowsBaselineLink(label) {
    return this.unitSection(label).getByRole('link', {
      name: VIEW_ON_SITE_HEDGEROWS_BASELINE
    })
  }

  /**
   * The watercourses equivalent, added by BMD-859/861. Each unit type's
   * baseline link names its own type, so there is no shared locator: the
   * wording is what tells them apart.
   */
  viewOnSiteWatercoursesBaselineLink(label) {
    return this.unitSection(label).getByRole('link', {
      name: VIEW_ON_SITE_WATERCOURSES_BASELINE
    })
  }

  /**
   * The hedgerows post-intervention tile's link (BMD-860). Area habitats alone
   * still renders the inert `viewOnSitePostInterventionText` above, because its
   * post-intervention page has not shipped. These stay deliberately separate
   * rather than one shared `viewOnSitePostInterventionLink(label)`: each unit
   * type names itself in its link text, so passing the wrong label would find
   * nothing, and quietly.
   */
  viewOnSiteHedgerowsPostInterventionLink(label) {
    return this.unitSection(label).getByRole('link', {
      name: VIEW_ON_SITE_HEDGEROWS_POST_INTERVENTION
    })
  }

  /** The watercourses post-intervention tile's link (BMD-862, frontend PR#285). */
  viewOnSiteWatercoursesPostInterventionLink(label) {
    return this.unitSection(label).getByRole('link', {
      name: VIEW_ON_SITE_WATERCOURSES_POST_INTERVENTION
    })
  }

  /** A unit-type section heading rendered as a link to its drill-down page. */
  sectionHeadingLink(label) {
    return this.sectionHeading(label).getByRole('link', { name: label })
  }

  navItem(text) {
    return this.navigation.getByText(text, { exact: true })
  }

  navLink(text) {
    return this.navigation.getByRole('link', { name: text })
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
