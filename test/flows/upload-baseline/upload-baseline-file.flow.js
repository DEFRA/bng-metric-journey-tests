import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { UploadBaselineFilePage } from '@pages/upload-baseline-file.page.js'

const EXAMPLE_FILES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../example-files'
)

// The frontend polls the CDP Uploader for up to 120 s (MAX_WAIT_SECONDS) before
// giving up, so a successful upload can take the full window.
const UPLOAD_TIMEOUT = 120_000

export class UploadBaselineFileFlow {
  constructor(page) {
    this.page = page
    this.uploadPage = new UploadBaselineFilePage(page)
  }

  filePath(filename) {
    return path.join(EXAMPLE_FILES_DIR, filename)
  }

  async uploadFile(projectId, filename) {
    await this.uploadPage.open(projectId)
    await this.uploadPage.fileInput.setInputFiles(this.filePath(filename))
    await this.uploadPage.continueButton.click()
  }

  /**
   * Upload a valid baseline and wait for the success redirect to settle.
   *
   * BMD-870 moved that redirect from the baseline habitat list to the project
   * summary (`successRoute` on `HABITAT_UPLOAD_TYPES.baseline`). Keeping the
   * destination here rather than in each spec means the next change to it is a
   * single edit — nine call sites had to be found and re-pointed last time.
   *
   * Only for uploads expected to succeed. A fixture that fails validation ends
   * up on `/error-file` or back on the upload form, so those callers use
   * `uploadFile` and wait for the destination themselves.
   */
  async uploadFileAndWaitForSummary(projectId, filename) {
    await this.uploadFile(projectId, filename)
    await this.page.waitForURL(
      new RegExp(`/projects/${projectId}/project-summary`),
      { timeout: UPLOAD_TIMEOUT }
    )
  }
}
