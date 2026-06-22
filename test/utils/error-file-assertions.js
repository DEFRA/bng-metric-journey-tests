import { expect } from '@fixtures'

/**
 * Assert the shared baseline / post-intervention error-file dropout page after a
 * structural validation rejection: the error summary, the upload-type-specific
 * "We couldn't accept your … file" heading, and the action links wired to the
 * matching upload route and project.
 *
 * @param {import('@pages/error-file.page.js').ErrorFilePage} errorFilePage
 * @param {import('@playwright/test').Locator} rejectedHeading - the upload-type heading locator
 * @param {string} projectId
 * @param {string} uploadRoute - e.g. 'upload-baseline-file' or 'upload-post-intervention-file'
 */
export async function assertRejectedFileError(
  errorFilePage,
  rejectedHeading,
  projectId,
  uploadRoute
) {
  await expect(errorFilePage.errorSummary).toBeVisible()
  await expect(errorFilePage.errorSummary).toContainText(
    'There is a problem with your file'
  )
  await expect(rejectedHeading).toBeVisible()
  await expect(errorFilePage.uploadDifferentFileLink).toBeVisible()
  await expect(errorFilePage.uploadDifferentFileLink).toHaveAttribute(
    'href',
    `/projects/${projectId}/${uploadRoute}`
  )
  await expect(errorFilePage.backToProjectLink).toBeVisible()
  await expect(errorFilePage.backToProjectLink).toHaveAttribute(
    'href',
    `/add-project-details/${projectId}`
  )
}
