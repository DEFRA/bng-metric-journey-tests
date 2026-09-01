import { BasePage } from './base.page.js'
import { WATERCOURSES } from '@utils/unit-type-labels.js'

const UNDER_CONSTRUCTION_COPY =
  'The Watercourses summary page is under construction.'

/**
 * The watercourses summary (`/projects/{id}/watercourses-summary`).
 *
 * **Still a placeholder.** BMD-854 added the route with a shared
 * "under construction" controller for both linear types; BMD-855/BMD-919 then
 * built the real hedgerows page and left this one behind. So the two linear
 * unit types are NOT interchangeable — `/hedgerows-summary` renders results and
 * targets, this renders a sentence.
 *
 * It extends `layouts/page.njk` directly rather than `unit-type-page.njk`, so it
 * inherits neither the heading row's "Upload file" button nor the unitTypeBody
 * block. That missing button is the clearest structural tell that a unit-type
 * page is a placeholder, which is why it is modelled here as an explicit
 * absence rather than simply left out.
 */
export class WatercoursesSummaryPage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', { name: WATERCOURSES, level: 1 })
    this.navigation = page.getByRole('navigation', { name: 'Project summary' })
    this.underConstructionCopy = page.getByText(UNDER_CONSTRUCTION_COPY)
    // Absent while this is a placeholder — see the class note.
    this.uploadFileButton = page.getByRole('button', { name: 'Upload file' })
    this.resultsHeading = page.getByRole('heading', {
      name: 'Results',
      level: 2
    })
    this.targetsSection = page.getByRole('region', { name: 'Targets' })
  }

  async open(id) {
    return super.open(`/projects/${id}/watercourses-summary`)
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
}
