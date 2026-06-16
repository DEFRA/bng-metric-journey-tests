import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { UploadPostInterventionFilePage } from '@pages/upload-post-intervention-file.page.js'

const EXAMPLE_FILES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../example-files'
)

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
}
