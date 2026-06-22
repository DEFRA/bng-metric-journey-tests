import { UploadHabitatFilePage } from './upload-habitat-file.page.js'

const INSTRUCTION_TEXT =
  'Upload a GeoPackage (.gpkg) file containing a red line boundary and baseline habitat parcels.'

export class UploadBaselineFilePage extends UploadHabitatFilePage {
  constructor(page) {
    super(page, {
      instructionText: INSTRUCTION_TEXT,
      uploadRoute: 'upload-baseline-file'
    })
  }
}
