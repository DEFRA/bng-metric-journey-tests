import { BasePage } from './base.page.js'

export class ErrorFilePage extends BasePage {
  constructor(page) {
    super(page)
    this.errorSummary = page.getByRole('alert')
    this.genericHeading = page.getByRole('heading', {
      name: 'There is a problem with your file'
    })
    this.baselineRejectedHeading = page.getByRole('heading', {
      name: "We couldn't accept your baseline file"
    })
    this.postInterventionRejectedHeading = page.getByRole('heading', {
      name: "We couldn't accept your post-intervention file"
    })
    this.uploadDifferentFileLink = page.getByRole('button', {
      name: 'Upload a different file'
    })
    this.backToStartLink = page.getByRole('link', { name: 'Back to start' })
    this.backToProjectLink = page.getByRole('link', { name: 'Back to project' })
    // BMD-405 single-error layout (exactly one validation error)
    this.geopackageErrorHeading = page.getByRole('heading', {
      name: 'Your Geopackage (.gpkg) file contains an error',
      exact: true
    })
    this.distinctivenessHeading = page.getByRole('heading', {
      name: 'Very high and high distinctiveness habitats are not yet included in this service'
    })
    // A problem the user cannot fix in the file (BMD-1204, frontend PR#483):
    // GOV.UK's wording for a service problem, above "Try again later."
    this.serviceProblemHeading = page.getByRole('heading', {
      name: 'Sorry, there is a problem with the service',
      exact: true
    })
    this.uploadNewFileLink = page.getByRole('link', {
      name: 'upload a new file'
    })
    this.metricToolLink = page.getByRole('link', {
      name: /metric tool \(spreadsheet\)/
    })
    // Shared by BMD-1182 and the BMD-1086 habitat reference errors
    this.projectProblemHeading = page.getByRole('heading', {
      name: 'There is a problem with your project'
    })
    this.habitatParcelsHeading = page.getByRole('heading', {
      name: 'Habitat parcels'
    })
    this.serviceEligibilityHeading = page.getByRole('heading', {
      name: 'Service eligibility'
    })
    this.unenhanceableHelpText = page.getByText(
      'Your project contains habitats that have been enhanced to a level which is not yet included in this service.'
    )
    // BMD-1195 (frontend PR#487, interim wording). The single-habitat page puts
    // the habitat's layer above the text; the several-habitats page has a layer
    // subheading only when they share one.
    this.layerHeadings = page.getByRole('heading', {
      name: /^(Habitat parcels|Hedgerows|Watercourses)$/
    })
    this.incompleteBaselineHabitatsText = page.getByText(
      'Some baseline habitats cannot be processed by the service due to a missing or incompatible value.',
      { exact: true }
    )
  }

  incompleteBaselineHabitatText(ref) {
    return this.page.getByText(
      `Baseline habitat ${ref} cannot be processed by the service due to a missing or incompatible value.`,
      { exact: true }
    )
  }

  singleErrorHeading(name) {
    return this.page.getByRole('heading', { name })
  }

  async open() {
    await super.open('/error-file')
  }
}
