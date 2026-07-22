import { BaselineHabitatDetailsPage } from './baseline-habitat-details.page.js'

// The /post-intervention-habitat-details route renders one of two page
// families regardless of retention category (BMD-608/723/724): a read-only
// summary list for area/hedgerow/watercourse features, or an
// unsupported-feature placeholder for individual trees. POST to this route
// answers 501 — there is no editable form. Extending the baseline page
// object inherits its select/save locators only so the "hidden on a
// read-only page" assertions in this file's specs have something to check
// against; the locators added here cover the view-only pages.
export class PostInterventionHabitatDetailsPage extends BaselineHabitatDetailsPage {
  constructor(page) {
    super(page)
    // Every page on this route shares this fixed heading.
    this.viewOnlyHeading = page.getByRole('heading', {
      name: 'Post-intervention habitat details'
    })
    this.postInterventionDetailsHeading = page.getByRole('heading', {
      name: 'Post-intervention Details'
    })
    this.caption = page.getByTestId('app-heading-caption')

    // Summary-list keys rendered by the view-only pages (a <dl>, matched by
    // visible text like the baseline page's read-only rows).
    this.interventionKey = page.getByText('Intervention', { exact: true })
    this.areaKey = page.getByText('Area (hectares)', { exact: true })
    this.lengthKey = page.getByText('Length (km)', { exact: true })
    this.broadHabitatKey = page.getByText('Broad habitat', { exact: true })
    this.habitatTypeKey = page.getByText('Habitat type', { exact: true })
    this.conditionKey = page.getByText('Condition', { exact: true })
    this.watercourseEncroachmentKey = page.getByText(
      'Watercourse encroachment',
      { exact: true }
    )
    this.riparianEncroachmentKey = page.getByText('Riparian encroachment', {
      exact: true
    })

    // Area is the third summary-list row (after Reference and Intervention),
    // so its value is the third definition (<dd>) on the view-only area page.
    // Area page only — on the hedgerow/watercourse pages the third row is
    // Length, not Area.
    this.areaValue = page.getByRole('definition').nth(2)
    // Hedgerow/watercourse pages only — same third row, Length instead.
    this.lengthValue = page.getByRole('definition').nth(2)

    // Shown only when a baseline feature shares the parcel ref (the baseline
    // and post-intervention uploads have independent featureIds).
    this.viewBaselineLink = page.getByRole('link', {
      name: 'View baseline details'
    })

    // Placeholder page for individual trees (and IGGIs).
    this.unsupportedFeatureMessage = page.getByText(
      'Individual tree and IGGI features are not yet supported in this view.'
    )
  }

  async open(projectId, featureId) {
    await this.page.goto(
      `/post-intervention-habitat-details?projectId=${projectId}&featureId=${featureId}`
    )
    await this.page.waitForLoadState('domcontentloaded')
  }
}
