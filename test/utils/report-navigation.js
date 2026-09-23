/**
 * Route-path helpers for the site report (BMD-984).
 *
 * @param {string} projectId
 * @returns {string} the download route the Reports page's button points at
 */
export function reportPdfPath(projectId) {
  return `/projects/${projectId}/report.pdf`
}

/**
 * The filename the FRONTEND serves, which is deliberately not the one the
 * backend sends. `project-report/controller.js` discards the backend's
 * site-derived `content-disposition` and substitutes an id-based name, rather
 * than forwarding a header built from a user-supplied project name through a
 * second service.
 *
 * @param {string} projectId
 * @returns {string}
 */
export function expectedReportFilename(projectId) {
  return `bng-site-report-${projectId}.pdf`
}
