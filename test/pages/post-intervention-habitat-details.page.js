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
    // Hedgerow page only — same third row, Length instead. (The retained
    // watercourse page no longer renders a summary list; see the stacked
    // locators below.)
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

    // ─── Enhanced area two-section page (BMD-725) ───────────────────────────
    // The Enhanced area habitat renders a distinct template
    // (pi-habitat-details-enhanced.njk) with stacked label-over-value fields in
    // two <h2> sections plus a "Habitat units delivered" summary row. The page
    // heading is the feature ref (assert that in the spec via getByRole). The
    // first section's heading reuses viewOnlyHeading's "Post-intervention
    // habitat details" text; the second section heading is added here. Labels
    // are <h3> headings, so getByText matches them.
    this.timeToTargetSectionHeading = page.getByText(
      'Time to target / difficulty',
      { exact: true }
    )
    // Section-1 labels that differ from the single-list page: the enhanced page
    // labels the size row "Area" (not "Area (hectares)") and uses a lower-case
    // "Strategic significance".
    this.enhancedAreaKey = page.getByText('Area', { exact: true })
    // The Enhanced hedgerow page (BMD-733) labels the size row "Length" (not
    // the single-list page's "Length (km)").
    this.enhancedLengthKey = page.getByText('Length', { exact: true })
    this.enhancedStrategicSignificanceKey = page.getByText(
      'Strategic significance',
      { exact: true }
    )
    // Section-2 (time to target / difficulty) labels.
    this.targetConditionKey = page.getByText('Target condition', {
      exact: true
    })
    this.standardTimeToTargetKey = page.getByText(
      'Standard time to target condition',
      { exact: true }
    )
    this.standardDifficultyKey = page.getByText('Standard difficulty', {
      exact: true
    })
    this.advanceOrDelayKey = page.getByText('Advance or delay?', {
      exact: true
    })
    this.finalTimeToTargetKey = page.getByText(
      'Final time to target condition',
      { exact: true }
    )
    this.appliedDifficultyMultiplierKey = page.getByText(
      'Applied difficulty multiplier',
      { exact: true }
    )
    // The standard-time-to-target value is formatted "Baseline condition to
    // target condition - N years", which proves the section-2 values render.
    this.standardTimeToTargetValue = page.getByText(
      /Baseline condition to target condition - .+ years/
    )
    // The enhanced page's units row is labelled "Habitat units delivered"
    // (distinct from the single-list "Units in this habitat"). It is the only
    // summary-list on the page, so its value is the sole <dd> and
    // habitatUnitsValue (getByRole('definition').last()) still resolves it.
    this.habitatUnitsDeliveredKey = page.getByText('Habitat units delivered', {
      exact: true
    })

    // ─── Retained watercourse stacked page ──────────────────────────────────
    // The retained watercourse page now uses the same stacked
    // label-over-value layout as the Enhanced pages, with a single section.
    // Its size row is labelled "Size (kilometres)" with a plain numeric
    // value — the label names the unit.
    this.sizeKilometresKey = page.getByText('Size (kilometres)', {
      exact: true
    })
    this.sizeKilometresValue = page
      .locator('.app-stacked-fields__item', { hasText: 'Size (kilometres)' })
      .locator('p')
  }

  async open(projectId, featureId) {
    await this.page.goto(
      `/post-intervention-habitat-details?projectId=${projectId}&featureId=${featureId}`
    )
    await this.page.waitForLoadState('domcontentloaded')
  }
}
