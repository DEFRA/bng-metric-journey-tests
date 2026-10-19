/**
 * Build the href of the shared file-type selection page
 * (`GET /projects/{id}/upload-file`, BMD-850).
 *
 * Mirrors `uploadFileHref` in the frontend's
 * `src/server/common/helpers/upload-file-navigation.js`, including its
 * `URLSearchParams` encoding: the rendered attribute carries `%2F`-escaped
 * slashes in `returnUrl`, so an expectation written out by hand is easy to get
 * subtly wrong.
 *
 * @param {string} projectId
 * @param {string} returnUrl where the selection page's Back/Cancel should go
 * @returns {string}
 */
export function uploadFileHref(projectId, returnUrl) {
  const params = new URLSearchParams({ returnUrl })
  return `/projects/${projectId}/upload-file?${params.toString()}`
}

/**
 * Where the project summary sends a project with no baseline (BMD-1076,
 * frontend PR#396): the selection page, with the summary as its `returnUrl`.
 * Only that redirect produces this exact URL, so landing on it proves the
 * browser went through the summary.
 *
 * @param {string} projectId
 * @returns {string}
 */
export function noBaselineSummaryRedirectHref(projectId) {
  return uploadFileHref(projectId, `/projects/${projectId}/project-summary`)
}
