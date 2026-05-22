import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { UploadBaselineFilePage } from '@pages/upload-baseline-file.page.js'

const EXAMPLE_FILES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../example-files'
)

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
}
