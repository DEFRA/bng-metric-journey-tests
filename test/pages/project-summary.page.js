import { BasePage } from './base.page.js'

const UPLOAD_POST_INTERVENTION_TEXT = 'Upload on-site post intervention file'

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

  statusTag(label) {
    return this.unitSection(label).getByText('Not met', { exact: true })
  }

  uploadPostInterventionLink(label) {
    return this.unitSection(label).getByRole('link', {
      name: UPLOAD_POST_INTERVENTION_TEXT
    })
  }

  navItem(text) {
    return this.navigation.getByText(text, { exact: true })
  }

  /**
   * The value rendered directly beneath a tile heading within a section, e.g.
   * tileValue('Hedgerows', 'On-site baseline') → '4.50 units'.
   *
   * The tiles carry no role, so the section's rendered text is split into lines
   * and the line after the heading is returned. That keeps the lookup off CSS
   * selectors while still being anchored to the visible heading rather than to
   * a positional index.
   */
  async tileValue(sectionLabel, tileHeading) {
    const text = await this.unitSection(sectionLabel).innerText()
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    const headingIndex = lines.indexOf(tileHeading)

    if (headingIndex === -1 || headingIndex === lines.length - 1) {
      throw new Error(
        `No value found under "${tileHeading}" in the "${sectionLabel}" section. Rendered lines: ${JSON.stringify(lines)}`
      )
    }

    return lines[headingIndex + 1]
  }

  /** The numeric part of a "N.NN units" tile value. */
  async tileUnits(sectionLabel, tileHeading) {
    const value = await this.tileValue(sectionLabel, tileHeading)
    return Number(value.replace(' units', ''))
  }
}
