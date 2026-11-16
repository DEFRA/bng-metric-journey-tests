import { reportPdfPath } from '@utils/report-navigation.js'

import { BasePage } from './base.page.js'

// Long enough for the backend to build a report with its map, and shorter than
// the test timeout, so a missing download fails with the message below.
const DOWNLOAD_TIMEOUT_MS = 45_000

/**
 * The Reports page (`/projects/{id}/reports`, BMD-984) and the site report
 * download it points at (`/projects/{id}/report.pdf`).
 *
 * Two things to know before writing a locator against this page — both of them
 * reasons it does NOT extend `UnitTypeSummaryPage` despite sharing the layout:
 *
 *  - The navigation landmark is named **"Reports"**, not "Project summary".
 *    `appProjectNavigation` renders `<nav aria-label="{{ params.label }}">` and
 *    this is the only template in the service passing anything else, so
 *    `UnitTypeSummaryPage`'s nav locator finds nothing here.
 *  - The download control is a `govukButton` rendered as an **anchor**. It has
 *    a link role, not a button role; `data-testid="site-report-link"` is the
 *    stable hook and is what this page object uses.
 */
export class ProjectReportsPage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', { name: 'Reports', level: 1 })
    this.siteReportHeading = page.getByRole('heading', {
      name: 'Site report',
      level: 2
    })
    // See the class note: "Reports", not "Project summary".
    this.navigation = page.getByRole('navigation', { name: 'Reports' })
    this.downloadLink = page.getByTestId('site-report-link')
  }

  async open(id) {
    return super.open(`/projects/${id}/reports`)
  }

  /** Navigate straight to the PDF route, for response-level assertions. */
  async openReportPdf(id) {
    return super.open(reportPdfPath(id))
  }

  caption(projectName) {
    return this.page.getByText(projectName)
  }

  navItem(text) {
    return this.navigation.getByText(text, { exact: true })
  }

  navLink(text) {
    return this.navigation.getByRole('link', { name: text })
  }

  /**
   * Click the download button and resolve with the Playwright `Download`.
   *
   * The response is an attachment, so the page does not navigate — waiting on
   * a URL change here would hang until the test timeout.
   *
   * The link has no `download` attribute (BMD-1203), so an error response —
   * a 429 "too many requests", a 500 — shows as a page and no download comes.
   * That fails here, naming the page the browser showed instead.
   */
  async downloadSiteReport() {
    const download = this.page.waitForEvent('download', {
      timeout: DOWNLOAD_TIMEOUT_MS
    })
    await this.downloadLink.click()
    try {
      return await download
    } catch (error) {
      throw new Error(
        `No site report download within ${DOWNLOAD_TIMEOUT_MS} ms. The service may have shown an error page instead: "${await this.page.title()}" at ${this.page.url()}`,
        { cause: error }
      )
    }
  }
}
