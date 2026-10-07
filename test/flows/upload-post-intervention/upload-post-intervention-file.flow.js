import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { UploadPostInterventionFilePage } from '@pages/upload-post-intervention-file.page.js'

const EXAMPLE_FILES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../example-files'
)

// The frontend polls the CDP Uploader for up to 120 s (MAX_WAIT_SECONDS) before
// giving up, so a successful upload can take the full window.
const UPLOAD_TIMEOUT = 120_000

export class UploadPostInterventionFileFlow {
  constructor(page) {
    this.page = page
    this.uploadPage = new UploadPostInterventionFilePage(page)
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
   * Upload a valid post-intervention file and wait for the success redirect.
   *
   * BMD-1043 (frontend PR#352) removed the post-intervention habitat list and
   * pointed `successRoute` at the project summary, as BMD-870 did for baseline.
   *
   * Only for uploads expected to succeed — failing fixtures use `uploadFile`
   * and wait for their own destination.
   */
  async uploadFileAndWaitForSummary(projectId, filename) {
    await this.uploadFile(projectId, filename)
    await this.page.waitForURL(
      new RegExp(`/projects/${projectId}/project-summary`),
      { timeout: UPLOAD_TIMEOUT }
    )
  }
}
