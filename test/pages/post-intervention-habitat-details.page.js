import { expect } from '@playwright/test'

import { BaselineHabitatDetailsPage } from './baseline-habitat-details.page.js'

// Habitat units render to 2 decimal places (BMD-608 AC1).
export const UNITS_TWO_DP_PATTERN = /^\s*\d+\.\d{2}\s*$/

// The /post-intervention-habitat-details route renders a read-only page for
// every feature, picked by feature type *and* retention category, plus an
// unsupported-feature placeholder for individual trees — except a Created
// area habitat, which renders an edit form (BMD-1048, frontend PR#418). POST
// saves that form and answers 501 for any other feature. Two read-only layout
// families:
//
//   - stacked sections (layouts/pi-view-only-sections-page.njk) — <h3> label
//     over <p> value, feature ref as the H1, a "Habitat units delivered"
//     summary row. Used by every page except the retained hedgerow, since
//     BMD-608 (PR#191) and BMD-724 (PR#192) moved the retained area and
//     retained watercourse pages across.
//   - summary list (layouts/pi-view-only-page.njk) — the original <dl>, now
//     only the retained hedgerow page (BMD-723).
//
// Extending the baseline page object inherits its select/save locators: the
// read-only pages assert them hidden, and the Created area edit form asserts
// them visible. The locators added here cover the view-only pages and the
// edit form's own controls.
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
    // Enhanced area and Created/Enhanced linear size labels — these pages put
    // the unit on the value ("1.23ha" / "0.09km"), so their labels are the
    // bare "Area" / "Length". The Created area edit form uses
    // "Size (hectares)".
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
    // A *created* feature has no prior condition to name, so frontend PR#211
    // (and PR#206 for the "N/A" GeoPackage sentinels) drops the transition and
    // renders the target condition alone: "<target condition> - N years". The
    // negative lookahead makes this the short-form locator — a value carrying a
    // " to " transition cannot match it, so it catches both halves of the
    // BMD-736 regression: a blank row leaves it unresolved, and a reappearing
    // transition prefix does too.
    //
    // The "Advance or delay?" row shares the "<text> - N years" shape
    // (`resolveAdvanceOrDelay` renders "Advance - 3 years" / "Delay - 3 years"
    // / "Neither"), so it is excluded explicitly — otherwise this resolves to
    // two elements on any created feature with an advance or delay. HG013 hid
    // that: its advance and delay are both 0, so its row reads "Neither".
    this.createdTimeToTargetValue = page.getByText(
      /^(?!.* to )(?!Advance - )(?!Delay - ).+ - \d+(\.\d+)? years$/
    )
    // The enhanced page's units row is labelled "Habitat units delivered"
    // (distinct from the single-list "Units in this habitat"). It is the only
    // summary-list on the page, so its value is the sole <dd> and
    // habitatUnitsValue (getByRole('definition').last()) still resolves it.
    this.habitatUnitsDeliveredKey = page.getByText('Habitat units delivered', {
      exact: true
    })

    // ─── Created area edit form (BMD-1048) ──────────────────────────────────
    // pi-habitat-details-created-edit.njk keeps the two section headings and
    // the units row, but its editable fields are form controls and two
    // derived labels name their multiplier.
    this.habitatReferenceInput = page.getByLabel('Habitat reference')
    this.strategicSignificanceSelect = page.getByLabel('Strategic significance')
    this.targetConditionSelect = page.getByLabel('Target condition')
    this.advanceYearsSelect = page.getByLabel(
      'Habitat created in advance (years)'
    )
    this.delayYearsSelect = page.getByLabel(
      'Delay in starting habitat creation (years)'
    )
    this.distinctivenessMultiplierKey = page.getByText(
      'Distinctiveness (multiplier)',
      { exact: true }
    )
    this.finalTimeToTargetMultiplierKey = page.getByText(
      'Final time to target condition (multiplier)',
      { exact: true }
    )
    this.uploadFileButton = page.getByRole('button', { name: 'Upload file' })
  }

  async open(projectId, featureId) {
    await this.page.goto(
      `/post-intervention-habitat-details?projectId=${projectId}&featureId=${featureId}`
    )
    await this.page.waitForLoadState('domcontentloaded')
  }

  /**
   * Assert the shape every Created/Enhanced two-section read-only page shares:
   * the feature ref as the H1, the habitat-details section with its
   * intervention value, all six time-to-target rows, the "Habitat units
   * delivered" summary row, and no form controls. The size row differs per
   * feature type ("Area" vs "Length"), so it is asserted by the caller.
   */
  async assertTwoSectionLayout({ ref, intervention }) {
    await expect(
      this.page.getByRole('heading', { name: ref, exact: true })
    ).toBeVisible()
    await expect(this.viewOnlyHeading).toBeVisible()
    await expect(this.interventionKey).toBeVisible()
    await expect(
      this.page.getByText(intervention, { exact: true })
    ).toBeVisible()
    await expect(this.habitatTypeKey).toBeVisible()
    await expect(this.distinctivenessKey).toBeVisible()
    await expect(this.conditionKey).toBeVisible()
    await expect(this.stackedStrategicSignificanceKey).toBeVisible()

    await expect(this.timeToTargetSectionHeading).toBeVisible()
    await expect(this.targetConditionKey).toBeVisible()
    await expect(this.standardTimeToTargetKey).toBeVisible()
    await expect(this.standardDifficultyKey).toBeVisible()
    await expect(this.advanceOrDelayKey).toBeVisible()
    await expect(this.finalTimeToTargetKey).toBeVisible()
    await expect(this.appliedDifficultyMultiplierKey).toBeVisible()

    await expect(this.habitatUnitsDeliveredKey).toBeVisible()

    await expect(this.saveButton).toBeHidden()
    await expect(this.cancelLink).toBeHidden()
  }

  /**
   * Assert the Created area edit form (BMD-1048 AC1/AC2): the feature ref as
   * the H1, the read-only Intervention and Size rows, the reference input
   * pre-filled with the ref, a dropdown for each editable field, the derived
   * rows in both sections, the units row, and Save / Cancel / Upload file.
   */
  async assertCreatedAreaEditForm({ ref }) {
    await expect(
      this.page.getByRole('heading', { name: ref, exact: true })
    ).toBeVisible()
    await expect(this.viewOnlyHeading).toBeVisible()
    await expect(this.interventionKey).toBeVisible()
    await expect(this.page.getByText('Created', { exact: true })).toBeVisible()
    await expect(this.sizeHectaresKey).toBeVisible()
    await expect(this.habitatReferenceInput).toHaveValue(ref)
    await expect(this.broadHabitatSelect).toBeVisible()
    await expect(this.habitatTypeSelect).toBeVisible()
    await expect(this.distinctivenessMultiplierKey).toBeVisible()
    await expect(this.strategicSignificanceSelect).toBeVisible()

    await expect(this.timeToTargetSectionHeading).toBeVisible()
    await expect(this.targetConditionSelect).toBeVisible()
    await expect(this.standardTimeToTargetKey).toBeVisible()
    await expect(this.standardDifficultyKey).toBeVisible()
    await expect(this.advanceOrDelayKey).toBeVisible()
    await expect(this.advanceYearsSelect).toBeVisible()
    await expect(this.delayYearsSelect).toBeVisible()
    await expect(this.finalTimeToTargetMultiplierKey).toBeVisible()
    await expect(this.appliedDifficultyMultiplierKey).toBeVisible()

    await expect(this.habitatUnitsDeliveredKey).toBeVisible()

    await expect(this.saveButton).toBeVisible()
    await expect(this.cancelLink).toBeVisible()
    await expect(this.uploadFileButton).toBeVisible()
  }

  /**
   * Assert the values a Created feature with no usable baseline condition
   * shows on any of its pages: the page chrome, the short-form time-to-target
   * row, and the units row.
   *
   * @param {{ projectName: string, timeToTarget: string, units: string }} expected
   */
  async assertCreatedAbsentBaselineValues({
    projectName,
    timeToTarget,
    units
  }) {
    await expect(this.backLink).toBeVisible()
    await expect(this.caption).toHaveText(projectName)
    await expect(this.createdTimeToTargetValue).toHaveText(timeToTarget)
    await expect(this.habitatUnitsValue).toHaveText(UNITS_TWO_DP_PATTERN)
    await expect(this.habitatUnitsValue).toHaveText(units)
  }

  /**
   * Assert the shape a Created feature with no usable baseline condition
   * shares across the hedgerow and watercourse read-only pages: the
   * two-section layout plus assertCreatedAbsentBaselineValues.
   * Feature-specific rows (size label, encroachments) and the "View baseline
   * details" expectation differ per page, so they stay with the caller.
   *
   * @param {{ ref: string, projectName: string, timeToTarget: string, units: string }} expected
   */
  async assertCreatedAbsentBaselinePage({
    ref,
    projectName,
    timeToTarget,
    units
  }) {
    await this.assertTwoSectionLayout({ ref, intervention: 'Created' })
    await this.assertCreatedAbsentBaselineValues({
      projectName,
      timeToTarget,
      units
    })
  }
}
