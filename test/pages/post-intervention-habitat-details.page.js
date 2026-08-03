import { BaselineHabitatDetailsPage } from './baseline-habitat-details.page.js'

// The /post-intervention-habitat-details route renders a read-only page for
// every feature, picked by feature type *and* retention category, plus an
// unsupported-feature placeholder for individual trees. POST to this route
// answers 501 — there is no editable form. Two layout families:
//
//   - stacked sections (layouts/pi-view-only-sections-page.njk) — <h3> label
//     over <p> value, feature ref as the H1, a "Habitat units delivered"
//     summary row. Used by every page except the retained hedgerow, since
//     BMD-608 (PR#191) and BMD-724 (PR#192) moved the retained area and
//     retained watercourse pages across.
//   - summary list (layouts/pi-view-only-page.njk) — the original <dl>, now
//     only the retained hedgerow page (BMD-723).
//
// Extending the baseline page object inherits its select/save locators only so
// the "hidden on a read-only page" assertions in this file's specs have
// something to check against; the locators added here cover the view-only
// pages.
export class PostInterventionHabitatDetailsPage extends BaselineHabitatDetailsPage {
  constructor(page) {
    super(page)
    // "Post-intervention habitat details" — the H1 on the summary-list and
    // placeholder pages, and the first section's <h2> on the stacked pages
    // (whose H1 is the feature ref instead). getByRole matches either.
    this.viewOnlyHeading = page.getByRole('heading', {
      name: 'Post-intervention habitat details'
    })
    this.postInterventionDetailsHeading = page.getByRole('heading', {
      name: 'Post-intervention Details'
    })
    this.caption = page.getByTestId('app-heading-caption')

    // Row labels, matched by visible text — a <dt> on the summary-list page and
    // an <h3> on the stacked pages, so getByText covers both.
    this.interventionKey = page.getByText('Intervention', { exact: true })
    // Stacked (sections) size labels — the retained area page (BMD-608) and the
    // retained watercourse page (BMD-724) name the unit in the label, so their
    // values render bare.
    this.sizeHectaresKey = page.getByText('Size (hectares)', { exact: true })
    this.sizeKilometresKey = page.getByText('Size (kilometres)', {
      exact: true
    })
    // Summary-list size label — the retained hedgerow page is the only page
    // still on layouts/pi-view-only-page.njk, so it keeps "Length (km)".
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

    // Retained hedgerow page only (the last summary-list page): Length is the
    // third row after Reference and Intervention, so its value is the third
    // <dd>.
    this.lengthValue = page.getByRole('definition').nth(2)

    // Stacked (sections) pages render each row as an <h3> label followed by a
    // <p> value, so the values are paragraphs rather than <dd>s. Playwright has
    // no sibling combinator outside CSS/XPath (both banned here), so a value is
    // reached either positionally among the paragraphs or by its own text.
    //
    // Scope to <main>: the layout's phase banner renders its own <p> in
    // beforeContent, which GOV.UK's template places *outside* <main>, as does
    // the back link. Without this scope every index is shifted by the chrome.
    this.stackedValues = page.getByRole('main').getByRole('paragraph')
    // Size is the second row on both stacked retained pages (after
    // Intervention), and the "View baseline details" paragraph sorts after
    // every row, so nth(1) is stable.
    this.stackedSizeValue = this.stackedValues.nth(1)

    // Shown only when a baseline feature shares the parcel ref (the baseline
    // and post-intervention uploads have independent featureIds).
    this.viewBaselineLink = page.getByRole('link', {
      name: 'View baseline details'
    })

    // Placeholder page for individual trees (and IGGIs).
    this.unsupportedFeatureMessage = page.getByText(
      'Individual tree and IGGI features are not yet supported in this view.'
    )

    // ─── Stacked "sections" pages ───────────────────────────────────────────
    // Every page on this route except the retained hedgerow now extends
    // layouts/pi-view-only-sections-page.njk: stacked label-over-value fields
    // under one or two <h2> sections, plus a "Habitat units delivered" summary
    // row. Created/Enhanced pages add the second "Time to target / difficulty"
    // section; the retained area (BMD-608) and retained watercourse (BMD-724)
    // pages have the first section only. The page heading is the feature ref
    // (assert that in the spec via getByRole). The first section's heading
    // reuses viewOnlyHeading's "Post-intervention habitat details" text; the
    // second section heading is added here. Labels are <h3> headings, so
    // getByText matches them.
    this.timeToTargetSectionHeading = page.getByText(
      'Time to target / difficulty',
      { exact: true }
    )
    // Created/Enhanced size labels — these pages put the unit on the value
    // ("1.23ha" / "0.09km"), so their labels are the bare "Area" / "Length".
    this.enhancedAreaKey = page.getByText('Area', { exact: true })
    this.enhancedLengthKey = page.getByText('Length', { exact: true })
    // Lower-case on every stacked page; the retained hedgerow summary list is
    // the only page still using the title-case "Strategic Significance"
    // inherited from the baseline page object.
    this.stackedStrategicSignificanceKey = page.getByText(
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
    // The standard-time-to-target value names the actual condition transition:
    // "<baseline condition> to <target condition> - N years" (frontend PR#193
    // replaced the literal "Baseline condition to target condition - " prefix
    // with the feature's own conditions). Matching the transition shape proves
    // the section-2 values render *and* that the two conditions are resolved.
    this.standardTimeToTargetValue = page.getByText(
      / to .+ - \d+(\.\d+)? years/
    )
    // The enhanced page's units row is labelled "Habitat units delivered"
    // (distinct from the single-list "Units in this habitat"). It is the only
    // summary-list on the page, so its value is the sole <dd> and
    // habitatUnitsValue (getByRole('definition').last()) still resolves it.
    this.habitatUnitsDeliveredKey = page.getByText('Habitat units delivered', {
      exact: true
    })
  }

  async open(projectId, featureId) {
    await this.page.goto(
      `/post-intervention-habitat-details?projectId=${projectId}&featureId=${featureId}`
    )
    await this.page.waitForLoadState('domcontentloaded')
  }
}
