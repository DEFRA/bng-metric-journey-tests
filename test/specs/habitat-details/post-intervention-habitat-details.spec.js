import { test, expect } from '@fixtures'
import {
  STORAGE_STATE,
  NO_ROLE_STORAGE_STATE,
  NO_PROJECTS_STORAGE_STATE,
  skipInE2e,
  baseUrl
} from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'
import { createProjectCache } from '@utils/shared-project.js'
import { CreateProjectFlow } from '@flows/project-management/create-project.flow.js'
import { UploadBaselineFileFlow } from '@flows/upload-baseline/upload-baseline-file.flow.js'
import { UploadPostInterventionFileFlow } from '@flows/upload-post-intervention/upload-post-intervention-file.flow.js'
import { ProjectDashboardPage } from '@pages/project-dashboard.page.js'
import {
  findPiRef,
  openPiTabFor,
  piPage,
  piPageUrl
} from '@utils/post-intervention-grid.js'
import { UNITS_TWO_DP_PATTERN } from '@pages/post-intervention-habitat-details.page.js'
import {
  LONG_PADDED_REFS,
  buildPostInterventionOnlyProject,
  getLongPaddedRefsProject
} from '@utils/summary-projects.js'
import {
  DEFAULT_SITE,
  HEDGEROW_ENHANCEMENT_NOT_POSSIBLE,
  TRADING_ALL_MET
} from '@utils/service-template-files.js'
import { gridRefName } from '@utils/habitat-ref-display.js'
import { readTileUnits } from '@utils/tile-value.js'
import { STATUS_COMPLETE, STATUS_INCOMPLETE } from '@utils/unit-type-labels.js'
import {
  getRunAllUnitTypesPostInterventionProject,
  getRunAreaGainProject
} from '@utils/run-projects.js'
import {
  LEGACY_ONLY,
  SERVICE_TEMPLATE_ONLY,
  isServiceTemplateRun
} from '@utils/template-run.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const HTTP_BAD_REQUEST = 400
const HTTP_NOT_FOUND = 404
const HTTP_NOT_IMPLEMENTED = 501
const STUB_UUID = '00000000-0000-0000-0000-000000000000'
const VALID_UUID_V4 = 'aaaaaaaa-bbbb-4ccc-bddd-eeeeeeeeeeee'
// Test-timeout cap for this file: the first test to need a shared project
// pays its build (create + up to two uploads), which overruns the default
// 60s timeout.
const SHARED_BUILD_TEST_TIMEOUT = 180_000
const PROJECT_LABEL = 'PI habitat details test'
const RETAINED = 'Retained'
const CREATED = 'Created'
const ENHANCED = 'Enhanced'
const DETAILS_URL_PATTERN = /\/post-intervention-habitat-details/
const BASELINE_DETAILS_URL_PATTERN = /\/baseline-habitat-details/

// Fixture reachability (Retention Category per feature, read from the .gpkg):
// - COMPLETE_PI_FILE areas: H1 + H2-2 Retained, H2-3 + H3 Enhanced, H2-1…
//   Lost. The Retained parcels render the reference form (BMD-1180), the
//   Enhanced ones the area edit form (BMD-1045).
// - BASELINE_FILE areas: H1, H2, H3 — so in a project holding both uploads
//   the PI parcel H1 has a ref-matching baseline feature (link shown) while
//   H2-2 does not (link hidden).
// - HEDGEROWS_FILE / WATERCOURSES_FILE: HR1/WC1 Retained, HR2/WC2 Enhanced,
//   HR3/WC3 Created (BMD-845) — synthesised "mixed retention" fixtures, since
//   no shipped fixture has non-Retained hedgerows or watercourses.
// - HEDGEROW_BASELINE_FILE: BASELINE_FILE variant whose hedgerow Parcel Refs
//   are HR1/HR2, so PI hedgerow HR1 has a ref-matching baseline feature and
//   the "View baseline details" link renders on its view-only page.
// - WATERCOURSE_BASELINE_FILE: BASELINE_FILE variant whose river Parcel Ref
//   is WC1, so PI watercourse WC1 has a ref-matching baseline feature and
//   the "View baseline details" link renders on its view-only page.
// - MIXED_FILE: H1 Retained with blank proposed columns (proves the
//   baseline-side value sourcing) plus H2/H3 Enhanced with blank proposed
//   columns (Incomplete). Its hedgerows (H1/H2) and river (R1) are Lost, so
//   the backend excludes them on import.
// - TREES_FILE: T001-T004 Retained individual trees (BMD-1172 tree details page).
const COMPLETE_PI_FILE = 'Post-intervention - complete.gpkg'
const BASELINE_FILE = 'Baseline - complete with area refs.gpkg'
const HEDGEROWS_FILE = 'Post-intervention - hedgerows mixed retention.gpkg'
const HEDGEROW_BASELINE_FILE = 'Baseline - complete with hedgerow refs.gpkg'
const WATERCOURSES_FILE =
  'Post-intervention - watercourses mixed retention.gpkg'
const WATERCOURSE_BASELINE_FILE =
  'Baseline - complete with watercourse refs.gpkg'
const MIXED_FILE = 'Post-intervention - mixed complete and incomplete.gpkg'
const TREES_FILE = 'Post-intervention - urban trees all sizes.gpkg'
// The mixed hedgerow fixture's only Enhanced hedge, HR2, is Moderate→Moderate
// (no condition uplift; recut from Good→Good for BMD-1182), so its
// time-to-target section renders blank — fine for the label-only structural
// assertions but useless for pinning the dynamic
// condition-transition text (frontend PR#193). The "all unit and intervention
// types" fixture is the only shipped file with an Enhanced hedge that actually
// improves: HG018 goes Poor→Moderate, so its "Standard time to target
// condition" reads "Poor to Moderate - 20 years". Its baseline file has HG018
// too, so the "View baseline details" link still resolves.
const ALL_TYPES_PI_FILE =
  'Post-intervention - all unit and intervention types.gpkg'
const ALL_TYPES_BASELINE_FILE =
  'Baseline - all unit and intervention types.gpkg'
const RETAINED_HEDGEROW_REF = 'HR1'
const RETAINED_WATERCOURSE_REF = 'WC1'
const ENHANCED_UPLIFT_HEDGEROW_REF = 'HG018'
const ENHANCED_UPLIFT_HEDGEROW_KM = '0.3903847'
// Line of trees (Low 2), Poor -> Moderate (2), High (1.15), 0/0 on the 20-year
// enhancement: (B + (T - B) x 0.4903952635) x 1.15, B = km x 2 x 1, T = km x 2 x 2.
const ENHANCED_UPLIFT_HEDGEROW_EXACT_UNITS = 1.3382
const ENHANCED_HEDGEROW_SELECTIONS = {
  type: 'Line of trees',
  significance: 'High',
  condition: 'Moderate',
  advance: '0',
  delay: '0'
}
const ENHANCED_HEDGEROW_VALUES = {
  distinctiveness: 'Low (2)',
  standardTime: 'Poor to Moderate - 20 years',
  difficulty: 'Low',
  finalTime: '20 years (0.4903952635)',
  applied: '1'
}
const NATIVE_HEDGEROW_WITH_TREES = 'Native hedgerow with trees'
// BMD-1046: the valid enhancements of a Poor Line of trees, as listed in the
// ticket's spreadsheet.
const ENHANCED_HEDGEROW_TYPES = [
  'Choose habitat type',
  'Line of trees',
  'Line of trees - associated with bank or ditch',
  NATIVE_HEDGEROW_WITH_TREES
]
// BMD-1051: the same file's HG032 (a valid Moderate→Good enhancement) carries
// a Medium Proposed Strategic Significance, which the backend rejects and
// leaves unpriced. HG031 would not do: BMD-820 rejects its enhancement first.
const ENHANCED_REJECTED_HEDGEROW_REF = 'HG032'
const ENHANCED_REJECTED_HEDGEROW_TYPE =
  'Native hedgerow - associated with bank or ditch'
const STRATEGIC_SIGNIFICANCE_OPTIONS = [
  'Choose strategic significance',
  'High (1.15)',
  'Low (1)'
]
const CREATED_HEDGEROW_REF = 'HR3'
// HR3 and WC3 are both created to Moderate condition over 5 years, so unlike
// their Enhanced siblings (HR2 and WC2, both Moderate→Moderate, neither of
// which resolves a time-to-target) their sections populate — enough to pin the
// dynamic condition-transition text on the Created hedgerow and watercourse
// pages alike.
const CREATED_MODERATE_TIME = 'Moderate to Moderate - 5 years'
// Every area habitat in every other fixture is Retained, Enhanced or Lost, and
// the backend *maps* a Lost area to Created — which keeps its baseline
// attributes. So none of them reaches the case BMD-736's preconditions
// describe: a parcel whose Retention Category is literally "Created", with no
// baseline side at all. CREATED_AREA_PI_FILE is that parcel, generated by
// test/example-files/fixture-mutations.py from COMPLETE_PI_FILE by recutting
// H2-7 to Created and clearing its Baseline* columns.
//
// It matters because the two render differently. With no baseline condition to
// name, "Standard time to target condition" drops the transition and shows the
// target alone (frontend PR#211); H2-7 is created to Good over 5 years. That
// path regressed to a blank row for two weeks under PR#193 and no test caught
// it, because the Lost-sourced parcel below still had a baseline condition and
// assertTwoSectionLayout only checks that the *labels* render.
const CREATED_AREA_PI_FILE = 'Post-intervention - created area habitat.gpkg'
const CREATED_AREA_REF = 'H2-7'
const CREATED_AREA_TIME_TO_TARGET = 'Good - 5 years'
// BMD-1048. H2-7's saved selections and read-only values, as imported: a pond
// created to Good over 5 years, with zero timing.
const CREATED_AREA_SELECTIONS = {
  broad: 'Lakes',
  type: 'Ponds (non-priority habitat)',
  significance: 'Low',
  condition: 'Good',
  advance: '0',
  delay: '0'
}
const CREATED_AREA_VALUES = {
  distinctiveness: 'Medium (4)',
  standardTime: CREATED_AREA_TIME_TO_TARGET,
  difficulty: 'Low',
  finalTime: '5 years (0.8368287006)',
  applied: '1'
}
// H2-7's unrounded units: 0.02428732997 ha x 4 x 3 x 1 x 0.8368287006 x 1.
// The tile rounds to 2 dp, so tile arithmetic allows TILE_ROUNDING either way.
const CREATED_AREA_EXACT_UNITS = 0.2439
// BMD-1153. Saved on H2-7, which imports no comment.
const CREATED_AREA_COMMENT = 'Pond replaced by grassland.\n\nSee drawing LP-04.'
const TILE_ROUNDING = 0.011
const POST_INTERVENTION_TILE = 'On-site post-intervention'
const LAKES_TYPES = [
  'Choose habitat type',
  'Ornamental lake or pond',
  'Ponds (non-priority habitat)',
  'Reservoirs'
]
const GRASSLAND_TYPES = [
  'Choose habitat type',
  'Bracken',
  'Modified grassland',
  'Other lowland acid grassland',
  'Other neutral grassland',
  'Upland acid grassland'
]
const AREA_CREATION_CONDITIONS = [
  'Choose target condition',
  'Good (3)',
  'Fairly Good (2.5)',
  'Moderate (2)',
  'Fairly Poor (1.5)',
  'Poor (1)'
]
const TIMING_YEARS = [
  ...Array.from({ length: 31 }, (_, year) => String(year)),
  '30+'
]
// A copy of CREATED_AREA_PI_FILE whose H2-7 has no Proposed Condition, advance
// or delay, and the legacy significance label "Area/compensation not in local
// strategy/ no local strategy", which the form maps to Low (frontend PR#448).
// Built by build_bmd1048_created_area_fixtures in fixture-mutations.py.
const CREATED_AREA_PARTLY_BLANK_PI_FILE =
  'Post-intervention - created area partly blank.gpkg'
const INVALID_REF_SUMMARY = 'You have entered an invalid habitat reference.'
const INVALID_REF_INLINE = 'Enter a valid habitat reference.'
// BMD-1180 AC7, legacy template projects only (backend PR#620).
const REF_IN_USE_SUMMARY = 'Another habitat already has this habitat reference.'
const REF_IN_USE_INLINE = 'Enter a habitat reference that no other habitat has.'
// The Retained reference input stops at 99 characters (BMD-1175).
const MAX_REF_LENGTH = '99'
const TIMING_CONFLICT_SUMMARY =
  'A habitat cannot be created both in advance and with a delay.'
const TIMING_CONFLICT_INLINE =
  'Either the advance or delay field must be set at zero.'
// BMD-1153. A Created habitat's own comment, labelled "Supporting
// information". The wording is interim (error-text.yaml).
const COMMENT_INVALID_SUMMARY =
  'The supporting information uses invalid characters.'
const COMMENT_INVALID_INLINE =
  'The supporting information can only use UTF-8 characters.'
const COMMENT_TOO_LONG_SUMMARY = 'The supporting information is too long.'
const COMMENT_TOO_LONG_INLINE =
  'Supporting information must be 999 characters or less.'
const MAX_COMMENT_LENGTH = 999
const CREATED_COMMENT_HINT =
  'Add any information that will help support your submission.'
// BMD-1045. H2-3 in COMPLETE_PI_FILE: a Modified grassland (Low 2), Moderate (2)
// baseline enhanced to Other neutral grassland (Medium 4), Good (3), Low, with
// zero timing. The lists below are what GET /reference/area-enhancement offers
// that baseline.
const ENHANCED_AREA_REF = 'H2-3'
const ENHANCED_AREA_SELECTIONS = {
  broad: 'Grassland',
  type: 'Other neutral grassland',
  significance: 'Low',
  condition: 'Good',
  advance: '0',
  delay: '0'
}
const ENHANCED_AREA_VALUES = {
  intervention: 'Enhanced',
  size: '0.3052136111',
  distinctiveness: 'Medium (4)',
  standardTime: 'Moderate to Good - 15 years',
  difficulty: 'Low',
  finalTime: '15 years (0.5860163055)',
  applied: '1'
}
// Enhanced units are (baseline + (target - baseline) x temporal x difficulty)
// x the proposed strategic significance, where baseline and target are
// hectares x distinctiveness x condition:
// (0.3052136111 x 4 + (0.3052136111 x 12 - 0.3052136111 x 4) x 0.5860163055) x 1
const ENHANCED_AREA_EXACT_UNITS = 2.6517
const ENHANCED_AREA_BROAD_HABITATS = [
  'Choose broad habitat',
  'Coastal saltmarsh',
  'Cropland',
  'Grassland',
  'Heathland and shrub',
  'Intertidal hard structures',
  'Intertidal sediment',
  'Lakes',
  'Sparsely vegetated land',
  'Urban',
  'Woodland and forest'
]
// No Bracken: unlike GRASSLAND_TYPES, it is no enhancement of this baseline.
const ENHANCED_GRASSLAND_TYPES = [
  'Choose habitat type',
  'Modified grassland',
  'Other lowland acid grassland',
  'Other neutral grassland',
  'Upland acid grassland'
]
const SCRUB_TYPES = [
  'Choose habitat type',
  'Blackthorn scrub',
  'Gorse scrub',
  'Hawthorn scrub',
  'Hazel scrub',
  'Mixed scrub',
  'Willow scrub'
]
// H3 in the same file: a Mixed scrub, Poor baseline enhanced to Good. Its only
// broad habitat is its own, and Poor is no improvement on it.
const ENHANCED_SCRUB_REF = 'H3'
const ENHANCED_SCRUB_CONDITIONS = [
  'Choose target condition',
  'Good (3)',
  'Fairly Good (2.5)',
  'Moderate (2)',
  'Fairly Poor (1.5)'
]
// Harness attribute-problems fixture: H2-3 is Enhanced with only its Broad
// habitat and a legacy significance label. The import nulls the significance
// along with the missing type, so only the reference and Broad habitat load.
const ENHANCED_AREA_INCOMPLETE_PI_FILE =
  'Post-intervention - missing proposed habitat data.gpkg'
// The hedgerow equivalent, and the *other* flavour of absent baseline. H2-7
// above has its Baseline* columns cleared; these hedgerows carry the GeoPackage
// sentinel "N/A" instead, which frontend PR#206 (BMD-706) made count as absent
// too. Natural England files populate created features that way rather than
// leaving the column blank, so this is the branch real uploads hit — and it had
// no journey coverage before BMD-737's re-validation.
//
// HR3 in HEDGEROWS_FILE cannot stand in: it is Created *with* a real baseline
// condition, so it takes the transition branch and never reaches this code.
//
// The baseline half carries HG001-HG018, so HG013 used to have a ref-matching
// baseline hedgerow, which made "no View baseline details link" prove the view
// model suppresses it. Since BMD-1056/BMD-1066 the PI upload replaces that
// baseline with one derived from its own non-Created rows, so HG013 (Created)
// has no match and the link is also unresolvable. Coverage gap: nothing now
// tells the suppression apart from a missing match.
// The same pair carries R003 — a Created *watercourse* with the same "N/A"
// baseline condition — so one upload covers the short-form branch on the
// Created hedgerow (Step 7) and Created watercourse (Step 8) pages alike. WC3
// in WATERCOURSES_FILE cannot stand in for it, for the same reason HR3 cannot
// stand in for HG013.
const CREATED_LINEAR_PI_FILE =
  'Post-intervention - created linear features.gpkg'
const CREATED_LINEAR_BASELINE_FILE = 'Baseline - created linear features.gpkg'
const CREATED_LINEAR_HEDGEROW_REF = 'HG013'
const CREATED_LINEAR_HEDGEROW_TIME_TO_TARGET = 'Good - 20 years'
// HG013 as imported: Native hedgerow with trees, Good, High, no timing.
const CREATED_HEDGEROW_SELECTIONS = {
  type: NATIVE_HEDGEROW_WITH_TREES,
  significance: 'High',
  condition: 'Good',
  advance: '0',
  delay: '0'
}
const CREATED_HEDGEROW_VALUES = {
  distinctiveness: 'Medium (4)',
  standardTime: CREATED_LINEAR_HEDGEROW_TIME_TO_TARGET,
  difficulty: 'Low',
  finalTime: '20 years (0.4903952635)',
  applied: '1'
}
// 0.1751389 km x 4 x 3 x 1.15 x 0.4903952635 x 1
const CREATED_HEDGEROW_EXACT_UNITS = 1.1852
const CREATED_HEDGEROW_EDITED_UNITS = 1.0919
const HEDGEROW_CREATION_CONDITIONS = [
  'Choose target condition',
  'Good (3)',
  'Moderate (2)',
  'Poor (1)'
]
// HG013 cut by fixture-mutations.py to keep only its hedge type.
const CREATED_HEDGEROW_PARTLY_BLANK_PI_FILE =
  'Post-intervention - created hedgerow partly blank.gpkg'
// Another Created hedgerow in the same file, for the duplicate-reference save.
const OTHER_CREATED_HEDGEROW_REF = 'HG005'
const CREATED_LINEAR_WATERCOURSE_REF = 'R003'
// The pair's only Created individual tree (BMD-1153).
const CREATED_TREE_REF = 'T005'
const CREATED_LINEAR_WATERCOURSE_TIME_TO_TARGET = 'Fairly Poor - 2 years'
const ENHANCED_WATERCOURSE_REF = 'WC2'
const CREATED_WATERCOURSE_REF = 'WC3'
// BMD-1050. WC3 as imported: a Ditch created to Moderate over 5 years, High
// significance, no encroachment of either kind, zero timing. The `created
// watercourses` file the partly-blank variant is cut from has the same WC3.
const CREATED_WATERCOURSE_SELECTIONS = {
  type: 'Ditches',
  significance: 'High',
  condition: 'Moderate',
  watercourse: 'No Encroachment',
  riparian: 'No Encroachment/No Encroachment',
  advance: '0',
  delay: '0'
}
const CREATED_WATERCOURSE_VALUES = {
  distinctiveness: 'Medium (4)',
  standardTime: CREATED_MODERATE_TIME,
  difficulty: 'Medium',
  finalTime: '5 years (0.8368287006)',
  applied: '0.67'
}
// 0.024 km x 4 x 2 x 1.15 x 0.8368287006 x 0.67 x 1 x 1
const CREATED_WATERCOURSE_EXACT_UNITS = 0.1238
// The AC11 Scenario A edit below: Good, Low, Minor, Minor/Minor, delay 2.
// 0.024 km x 4 x 3 x 1 x 0.6521203607 x 0.67 x 0.8 x 0.95
const CREATED_WATERCOURSE_EDITED_UNITS = 0.0956
// BMD-1153. Saved with the edit above; WC3 imports no comment.
const CREATED_WATERCOURSE_COMMENT = 'Ditch re-cut along the old line.'
const WATERCOURSE_CREATION_TYPES = [
  'Choose habitat type',
  'Canals',
  'Culvert',
  'Ditches'
]
const WATERCOURSE_ENCROACHMENTS = [
  'Choose watercourse encroachment',
  'No Encroachment',
  'Minor',
  'Major',
  'N/A - Culvert'
]
const RIPARIAN_ENCROACHMENTS = [
  'Choose riparian encroachment',
  'Major/Major',
  'Major/Moderate',
  'Major/Minor',
  'Major/No Encroachment',
  'Moderate/Moderate',
  'Moderate/Minor',
  'Moderate/No Encroachment',
  'Minor/Minor',
  'Minor/No Encroachment',
  'No Encroachment/No Encroachment',
  'N/A - Culvert'
]
// WC3 cut by fixture-mutations.py to keep only its river type.
const CREATED_WATERCOURSE_PARTLY_BLANK_PI_FILE =
  'Post-intervention - created watercourse partly blank.gpkg'
// The same fixture pair carries the only Enhanced watercourse that can reach
// the whole of BMD-735's AC1 — see the Enhanced watercourse describe below.
// R007 improves Fairly Poor → Fairly Good over 4 years.
const ENHANCED_UPLIFT_WATERCOURSE_REF = 'R007'
const ENHANCED_UPLIFT_WATERCOURSE_TIME = 'Fairly Poor to Fairly Good - 4 years'
const STALE_TIME_TO_TARGET_TEXT = 'Baseline condition to target condition'
// formatLengthDisplay appends km on Created/Enhanced linear pages. The Created
// hedgerow form labels this "Length (km)"; other stacked linear pages use
// "Length". Retained watercourses use a bare value with "Size (kilometres)".
const LENGTH_KM_PATTERN = /^\s*[\d.]+km\s*$/

// H2-2's size in COMPLETE_PI_FILE, as formatAreaHectaresValue renders it: the
// fixture's m² value at 10 significant figures. Asserting the exact string
// pins BMD-608 AC1's precision rule — a bare-number pattern would pass at any
// precision.
const RETAINED_NO_BASELINE_SIZE_HECTARES = '0.1619213922'
// UNITS_TWO_DP_PATTERN (imported above) pins BMD-608 AC1's 2-decimal-place
// rule. It is asserted separately from the grid Units cell comparison, which
// shares formatHabitatUnits and so cannot catch a change to the formatter
// itself. toHaveText normalises whitespace only for string matching, not
// regex, so the surrounding template whitespace is matched explicitly.

// BMD-1043 (frontend PR#352) removed the post-intervention habitat list; the
// unit-type post-intervention pages (`@utils/post-intervention-grid.js`) are
// where features are listed and where the details page's Back link leads.

function detailsUrl({ projectId, featureId } = {}) {
  const params = new URLSearchParams()
  if (projectId !== undefined) {
    params.set('projectId', projectId)
  }
  if (featureId !== undefined) {
    params.set('featureId', featureId)
  }
  return `/post-intervention-habitat-details?${params.toString()}`
}

// The BMD-878 Back link and the BMD-935 Cancel link build their query as
// featureId then projectId — the opposite order to detailsUrl() above.
//
// Both links are the *same* computed value (`piBackHref` in the frontend's
// common/helpers/habitat-details-controller.js), rendered twice on one page. So
// asserting the href string alone proves nothing about which link carries it:
// revert either assignment and a check for that string still passes off the
// surviving link. Each link is therefore clicked here in turn.
//
// That is not hypothetical, and it makes this the sole witness for the Cancel
// half (BMD-935 AC1). The frontend's own test —
// baseline-habitat-details/controller.test.js, "Renders Cancel link to the
// referring post-intervention habitat details page" — asserts
// `result.toContain(<the shared href>)`, which the Back link already satisfies;
// it cannot fail if `cancelHref` regresses to the baseline-list fallback. Do
// not drop the Cancel assertions here until that test targets the
// `<a ...>Cancel</a>` markup specifically.
async function expectReturnLinksToPiDetails(
  page,
  baselineHabitatDetailsPage,
  postInterventionHabitatDetailsPage,
  { projectId, featureId, heading }
) {
  const expectedHref = `/post-intervention-habitat-details?featureId=${featureId}&projectId=${projectId}`
  const expectedUrl = new URL(expectedHref, baseUrl).toString()
  const piHeading = page.getByRole('heading', { name: heading, exact: true })

  await expect(baselineHabitatDetailsPage.backLink).toHaveAttribute(
    'href',
    expectedHref
  )
  await expect(baselineHabitatDetailsPage.cancelLink).toHaveAttribute(
    'href',
    expectedHref
  )

  // BMD-935 AC1 — Cancel.
  await baselineHabitatDetailsPage.cancelLink.click()
  await expect(page).toHaveURL(expectedUrl)
  await expect(piHeading).toBeVisible()

  // Re-enter by clicking "View baseline details" again rather than navigating:
  // the second visit needs its own Referer for the Back link to resolve the
  // same way.
  await postInterventionHabitatDetailsPage.viewBaselineLink.click()
  await expect(page).toHaveURL(BASELINE_DETAILS_URL_PATTERN)

  // BMD-878 AC1 — Back.
  await baselineHabitatDetailsPage.backLink.click()
  await expect(page).toHaveURL(expectedUrl)
  await expect(piHeading).toBeVisible()
}

// Arrive at a feature's details page the way the user does: click its Ref
// link in the post-intervention grid rather than deep-linking.
async function openPiFeatureDetails(page, projectId, type, ref) {
  const { unitPage, label } = await openPiTabFor(page, projectId, type, ref)
  await unitPage.refLink(label, ref).click()
}

// Ref link → featureId and the row's Units cell, harvested from the grid.
async function harvestPiFeature(page, projectId, type, ref) {
  const { unitPage, label } = await openPiTabFor(page, projectId, type, ref)
  const href = await unitPage.refLink(label, ref).getAttribute('href')
  const unitsIndex = await unitPage.columnIndex(label, 'Units')
  const units = await unitPage
    .featureRows(label)
    .filter({ has: page.getByRole('link', { name: ref, exact: true }) })
    .locator('td')
    .nth(unitsIndex)
    .innerText()
  return {
    featureId: new URL(href, baseUrl).searchParams.get('featureId'),
    units: units.trim()
  }
}

async function featureIdByRef(page, projectId, type, ref) {
  return (await harvestPiFeature(page, projectId, type, ref)).featureId
}

async function unitsByRef(page, projectId, type, ref) {
  return (await harvestPiFeature(page, projectId, type, ref)).units
}

// Back from a details page lands on the feature type's post-intervention
// page (BMD-1043; it was the habitat list's tab anchor).
async function expectOnPiPage(page, projectId, type) {
  await expect(page).toHaveURL(piPageUrl(projectId, type))
  await expect(piPage(page, type).heading).toBeVisible()
}

// Create a project in its own context, upload the given fixture(s), and
// harvest whatever the read-only tests need while the page is alive. Each
// fixture combination is uploaded once per worker and shared by its
// read-only tests (memoised below) — per-test uploads are what overloads the
// shared CDP uploader in e2e.
async function buildProject(browser, { baselineFile, piFile }, harvest) {
  const context = await browser.newContext({ storageState: STORAGE_STATE })
  const page = await context.newPage()
  try {
    const { id, name } = await setupProject(
      new CreateProjectFlow(page),
      new ProjectDashboardPage(page),
      PROJECT_LABEL
    )
    if (baselineFile) {
      // The project is baseline-only at this point, so the upload lands on the
      // project summary; the PI upload below is what changes that.
      await new UploadBaselineFileFlow(page).uploadFileAndWaitForSummary(
        id,
        baselineFile
      )
    }
    await new UploadPostInterventionFileFlow(page).uploadFileAndWaitForSummary(
      id,
      piFile
    )
    const harvested = await harvest(page, id)
    return { id, name, ...harvested }
  } finally {
    await context.close()
  }
}

// Memoised per worker (createProjectCache): the file runs in one worker (see
// the mode 'default' configure below), so each project is built exactly once.
const getOrBuildProject = createProjectCache()

function getSharedProject(browser, key, files, harvest) {
  return getOrBuildProject(key, () => buildProject(browser, files, harvest))
}

// Baseline + PI complete uploads in one project: retained parcels for the
// reference form (H1 with a ref-matching baseline feature, H2-2 without), the
// Enhanced parcels H2-3 and H3 for the Enhanced area edit form (BMD-1045), and
// a Lost parcel (H2-1) which the backend imports as Created.
function getCompleteProject(browser) {
  return getSharedProject(
    browser,
    'complete',
    { baselineFile: BASELINE_FILE, piFile: COMPLETE_PI_FILE },
    async (page, id) => {
      // H2-2 is in the PI file only, but since BMD-1056/BMD-1066 the PI upload
      // derives a baseline feature for every Retained row, so it now has a
      // same-ref baseline counterpart. The name records where it came from.
      const retainedNoBaseline = await harvestPiFeature(
        page,
        id,
        'area',
        'H2-2'
      )
      return {
        retainedWithBaseline: await featureIdByRef(page, id, 'area', 'H1'),
        retainedNoBaseline: retainedNoBaseline.featureId,
        retainedNoBaselineUnits: retainedNoBaseline.units
      }
    }
  )
}

// Baseline + the recut PI upload, for the genuinely Created area parcel H2-7
// (BMD-736). The baseline file is the same one getCompleteProject uses, whose
// area refs are H1/H2/H3 — so H2-7 has no ref-matching baseline feature and
// the "View baseline details" link stays hidden, as the story requires. Only
// the grid's Units cell is harvested: both tests arrive by clicking the Ref
// link (the AC's own entry path), so neither needs a featureId.
function getCreatedAreaProject(browser) {
  return getSharedProject(
    browser,
    'created-area',
    { baselineFile: BASELINE_FILE, piFile: CREATED_AREA_PI_FILE },
    async (page, id) => ({
      createdAreaUnits: await unitsByRef(page, id, 'area', CREATED_AREA_REF)
    })
  )
}

// BMD-1048 AC2: the same pair with H2-7 left incomplete on import (see
// CREATED_AREA_PARTLY_BLANK_PI_FILE).
function getCreatedAreaPartlyBlankProject(browser) {
  return getSharedProject(
    browser,
    'created-area-partly-blank',
    { baselineFile: BASELINE_FILE, piFile: CREATED_AREA_PARTLY_BLANK_PI_FILE },
    async () => ({})
  )
}

// BMD-1048 AC11. A save mutates its project, so each save test gets its own
// copy of a created-area pair instead of a read-only one above.
function getCreatedAreaSaveProject(
  browser,
  key,
  piFile = CREATED_AREA_PI_FILE
) {
  return getSharedProject(
    browser,
    key,
    { baselineFile: BASELINE_FILE, piFile },
    async () => ({})
  )
}

// BMD-1045. The same pair with H2-3 left incomplete on import (see
// ENHANCED_AREA_INCOMPLETE_PI_FILE).
function getEnhancedAreaIncompleteProject(browser) {
  return getSharedProject(
    browser,
    'enhanced-area-incomplete',
    { baselineFile: BASELINE_FILE, piFile: ENHANCED_AREA_INCOMPLETE_PI_FILE },
    async () => ({})
  )
}

async function openSharedCreatedArea(browser, page) {
  const shared = await getCreatedAreaProject(browser)
  await openPiFeatureDetails(page, shared.id, 'area', CREATED_AREA_REF)
  return shared
}

// Baseline + PI "created linear features" uploads in one project: the linear
// counterpart of getCreatedAreaProject. HG013 and R003 are both Created with an
// "N/A" baseline condition (the short-form time-to-target branch). Neither has
// a ref-matching baseline feature since BMD-1056/BMD-1066; see the note on
// CREATED_LINEAR_PI_FILE.
function getCreatedLinearProject(browser) {
  return getSharedProject(
    browser,
    'created-linear',
    {
      baselineFile: CREATED_LINEAR_BASELINE_FILE,
      piFile: CREATED_LINEAR_PI_FILE
    },
    async (page, id) => ({
      createdLinearHedgerowUnits: await unitsByRef(
        page,
        id,
        'hedgerow',
        CREATED_LINEAR_HEDGEROW_REF
      ),
      createdLinearWatercourseUnits: await unitsByRef(
        page,
        id,
        'watercourse',
        CREATED_LINEAR_WATERCOURSE_REF
      )
    })
  )
}

// BMD-1049. A copy of the created-linear pair under its own key, for a test
// that saves (and so mutates its project) or uploads a variant PI file.
function getCreatedLinearProjectCopy(
  browser,
  key,
  piFile = CREATED_LINEAR_PI_FILE
) {
  return getSharedProject(
    browser,
    key,
    { baselineFile: CREATED_LINEAR_BASELINE_FILE, piFile },
    async () => ({})
  )
}

async function openCreatedHedgerow(
  page,
  projectId,
  ref = CREATED_LINEAR_HEDGEROW_REF
) {
  await openPiFeatureDetails(page, projectId, 'hedgerow', ref)
}

async function openSharedCreatedHedgerow(browser, page) {
  const shared = await getCreatedLinearProject(browser)
  await openCreatedHedgerow(page, shared.id)
  return shared
}

// The hedgerow post-intervention tile, read from the page already open.
function hedgerowPostInterventionUnits(page) {
  return piPage(page, 'hedgerow').tileUnits(POST_INTERVENTION_TILE)
}

// Opens the hedgerow post-intervention page on the tab holding `ref`, and
// returns that row's cells keyed by column heading.
async function hedgerowRowByRef(page, projectId, ref) {
  const { unitPage, label } = await openPiTabFor(
    page,
    projectId,
    'hedgerow',
    ref
  )
  return unitPage.rowByRef(label, ref)
}

// PI-only upload of the mixed fixture: an H1 area parcel Retained with blank
// proposed columns (baseline-side value sourcing) alongside Enhanced parcels
// with blank proposed columns. The hedgerows and river are Lost, so the
// backend excludes them on import — that exclusion is not asserted here.
function getMixedProject(browser) {
  return getSharedProject(
    browser,
    'mixed',
    { piFile: MIXED_FILE },
    async (page, id) => {
      const retained = await harvestPiFeature(page, id, 'area', 'H1')
      return {
        retainedBlankProposed: retained.featureId,
        retainedBlankProposedUnits: retained.units
      }
    }
  )
}

const HEDGEROW_CREATION_OPTIONS = [
  'Choose habitat type',
  'Ecologically valuable line of trees',
  'Ecologically valuable line of trees - associated with bank or ditch',
  'Line of trees',
  'Line of trees - associated with bank or ditch',
  'Native hedgerow',
  'Native hedgerow - associated with bank or ditch',
  NATIVE_HEDGEROW_WITH_TREES,
  'Non-native and ornamental hedgerow',
  'Species-rich native hedgerow'
]

async function expectCreatedHedgerowSelections(
  details,
  { habitatType, condition, significance }
) {
  await expect(details.habitatTypeSelect).toHaveValue(habitatType)
  await expect(details.targetConditionSelect).toHaveValue(condition)
  await expect(details.strategicSignificanceSelect).toHaveValue(significance)
  await expect(details.advanceYearsSelect).toHaveValue('0')
  await expect(details.delayYearsSelect).toHaveValue('0')
  await expect(details.habitatTypeSelect.getByRole('option')).toHaveText(
    HEDGEROW_CREATION_OPTIONS
  )
  await expect(details.targetConditionSelect.getByRole('option')).toHaveText([
    'Choose target condition',
    'Good (3)',
    'Moderate (2)',
    'Poor (1)'
  ])
}

const CREATED_AREA_SELECTS = {
  broad: 'broadHabitatSelect',
  type: 'habitatTypeSelect',
  significance: 'strategicSignificanceSelect',
  condition: 'targetConditionSelect',
  advance: 'advanceYearsSelect',
  delay: 'delayYearsSelect',
  // Created watercourses only (BMD-1050).
  watercourse: 'watercourseEncroachmentSelect',
  riparian: 'riparianEncroachmentSelect'
}

async function expectCreatedAreaSelections(details, expected) {
  for (const [name, value] of Object.entries(expected)) {
    await expect(details[CREATED_AREA_SELECTS[name]], name).toHaveValue(value)
  }
}

async function expectCreatedAreaValues(details, expected, options = {}) {
  for (const [name, value] of Object.entries(expected)) {
    await expect(details.createdFormValue(name, options), name).toHaveText(
      value
    )
  }
}

// An Enhanced form's values sit after its "View baseline details" link.
async function expectEnhancedFormValues(details, expected) {
  await expectCreatedAreaValues(details, expected, { baselineLink: true })
}

// The area post-intervention tile, read from the page already open.
function areaPostInterventionUnits(page) {
  return readTileUnits(
    piPage(page, 'area').unitSection(),
    POST_INTERVENTION_TILE
  )
}

// Opens the area post-intervention page on the tab holding `ref`, and returns
// that row's cells keyed by column heading.
async function areaRowByRef(page, projectId, ref) {
  const { unitPage, label } = await openPiTabFor(page, projectId, 'area', ref)
  return unitPage.rowByRef(label, ref)
}

// BMD-1180. Opens a Retained habitat from its grid, types `typed` into the
// reference and saves.
async function saveRetainedRef(page, details, { projectId, type, ref, typed }) {
  await openPiFeatureDetails(page, projectId, type, ref)
  await details.habitatReferenceInput.fill(typed)
  await details.saveButton.click()
}

async function expectRetainedRename(
  page,
  details,
  { projectId, type, ref, typed, newRef, rowByRef, tileUnits }
) {
  const before = await rowByRef(page, projectId, ref)
  const totalBefore = await tileUnits(page)
  await openPiFeatureDetails(page, projectId, type, ref)
  // A legacy row joins its baseline habitat by reference, so the rename must
  // carry onto the baseline habitat for this link to survive it.
  const baselineFeatureId = new URL(
    await details.viewBaselineLink.getAttribute('href'),
    baseUrl
  ).searchParams.get('featureId')
  await details.habitatReferenceInput.fill(typed)
  await details.saveButton.click()

  await expectOnPiPage(page, projectId, type)
  expect(await tileUnits(page)).toBe(totalBefore)
  expect(await findPiRef(page, projectId, type, ref)).toBeNull()
  expect(await rowByRef(page, projectId, newRef)).toEqual({
    ...before,
    Ref: newRef
  })
  await openPiFeatureDetails(page, projectId, type, newRef)
  await expect(details.habitatReferenceInput).toHaveValue(newRef)
  await expect(details.headingTitle).toHaveText(`Habitat ${newRef}`)
  await expect(details.habitatUnitsValue).toHaveText(before.Units)

  await details.viewBaselineLink.click()
  await expect(page).toHaveURL(BASELINE_DETAILS_URL_PATTERN)
  expect(new URL(page.url()).searchParams.get('featureId')).toBe(
    baselineFeatureId
  )
  await expect(details.habitatReferenceInput).toHaveValue(newRef)
}

// Baseline + PI hedgerow uploads in one project: retained hedgerows for the
// view-only page, with HR1 ref-matched to a baseline hedgerow so the
// "View baseline details" link renders (BMD-723 AC1/AC3).
function getHedgerowsProject(browser, key = 'hedgerows') {
  return getSharedProject(
    browser,
    key,
    { baselineFile: HEDGEROW_BASELINE_FILE, piFile: HEDGEROWS_FILE },
    async (page, id) => {
      const retained = await harvestPiFeature(
        page,
        id,
        'hedgerow',
        RETAINED_HEDGEROW_REF
      )
      return {
        retainedHedgerow: retained.featureId,
        retainedHedgerowUnits: retained.units,
        // HR3 — Created hedgerow (BMD-737). Only its grid Units cell is
        // harvested: its tests arrive by clicking the Ref link (the AC's own
        // entry path), so they need no featureId.
        createdHedgerowUnits: await unitsByRef(
          page,
          id,
          'hedgerow',
          CREATED_HEDGEROW_REF
        )
      }
    }
  )
}

// Baseline + PI "all unit and intervention types" uploads in one project: the
// only shipped fixture with an Enhanced hedge that improves condition (HG018,
// Poor→Moderate), so it drives the Enhanced hedgerow edit form (BMD-1046). HG018 is ref-matched to a baseline hedgerow,
// so the "View baseline details" link resolves. The same pair is the only one
// whose Enhanced *watercourse* (R007) both improves condition and ref-matches
// a baseline river, so it carries the BMD-735 tests too — one project, two
// feature types, no extra upload.
function getAllTypesProject(browser) {
  return getSharedProject(
    browser,
    'all-types',
    { baselineFile: ALL_TYPES_BASELINE_FILE, piFile: ALL_TYPES_PI_FILE },
    async (page, id) => {
      const watercourse = await harvestPiFeature(
        page,
        id,
        'watercourse',
        ENHANCED_UPLIFT_WATERCOURSE_REF
      )
      return {
        enhancedUpliftHedgerowUnits: await unitsByRef(
          page,
          id,
          'hedgerow',
          ENHANCED_UPLIFT_HEDGEROW_REF
        ),
        enhancedUpliftWatercourse: watercourse.featureId,
        enhancedUpliftWatercourseUnits: watercourse.units
      }
    }
  )
}

// BMD-1046. A copy of the all-unit-types pair under its own key, for a test
// that saves (and so mutates its project).
function getAllTypesProjectCopy(browser, key) {
  return getSharedProject(
    browser,
    key,
    { baselineFile: ALL_TYPES_BASELINE_FILE, piFile: ALL_TYPES_PI_FILE },
    async () => ({})
  )
}

// Baseline + PI watercourse uploads in one project: retained watercourses
// for the view-only page, with WC1 ref-matched to a baseline watercourse so
// the "View baseline details" link renders (BMD-724 AC1/AC3).
function getWatercoursesProject(browser) {
  return getSharedProject(
    browser,
    'watercourses',
    { baselineFile: WATERCOURSE_BASELINE_FILE, piFile: WATERCOURSES_FILE },
    async (page, id) => {
      const retained = await harvestPiFeature(
        page,
        id,
        'watercourse',
        RETAINED_WATERCOURSE_REF
      )
      return {
        retainedWatercourse: retained.featureId,
        retainedWatercourseUnits: retained.units,
        // WC3 — Created watercourse (BMD-739). Only its grid Units cell is
        // harvested: its tests arrive by clicking the Ref link (the AC's own
        // entry path), so they need no featureId.
        createdWatercourseUnits: await unitsByRef(
          page,
          id,
          'watercourse',
          CREATED_WATERCOURSE_REF
        )
      }
    }
  )
}

// BMD-1050. A copy of the watercourses pair under its own key, for a test
// that saves (and so mutates its project) or uploads a variant PI file.
function getWatercoursesProjectCopy(browser, key, piFile = WATERCOURSES_FILE) {
  return getSharedProject(
    browser,
    key,
    { baselineFile: WATERCOURSE_BASELINE_FILE, piFile },
    async () => ({})
  )
}

async function openCreatedWatercourse(
  page,
  projectId,
  ref = CREATED_WATERCOURSE_REF
) {
  await openPiFeatureDetails(page, projectId, 'watercourse', ref)
}

async function openSharedCreatedWatercourse(browser, page) {
  const shared = await getWatercoursesProject(browser)
  await openCreatedWatercourse(page, shared.id)
  return shared
}

// The watercourse post-intervention tile, read from the page already open.
function watercoursePostInterventionUnits(page) {
  return piPage(page, 'watercourse').tileUnits(POST_INTERVENTION_TILE)
}

// Opens the watercourse post-intervention page on the tab holding `ref`, and
// returns that row's cells keyed by column heading.
async function watercourseRowByRef(page, projectId, ref) {
  const { unitPage, label } = await openPiTabFor(
    page,
    projectId,
    'watercourse',
    ref
  )
  return unitPage.rowByRef(label, ref)
}

function getTreesProject(browser) {
  return getSharedProject(
    browser,
    'trees',
    { piFile: TREES_FILE },
    async () => ({})
  )
}

// The project the run's generic tests open features of: legacy, the complete
// pair; BNG Service template, the default site.
function getRunDetailsProject(browser) {
  return isServiceTemplateRun()
    ? getRunAllUnitTypesPostInterventionProject(browser)
    : getCompleteProject(browser)
}

// ─── BNG Service template features (BMD-1088) ──────────────────────────────
//
// The default site's features. A BNG Service template feature names its
// parent, so "View baseline details" follows the parent, whatever the
// feature's own ref: HG018 is split into a Retained HG018a and a Created
// HG018b. A feature with no parent links to nothing, nor does any tree.
const SERVICE_TEMPLATE_RETAINED_AREA = {
  ref: 'H002',
  habitatType: 'Other woodland; broadleaved'
}
// An Enhanced vertical area habitat: vertical pages are read-only.
const SERVICE_TEMPLATE_ENHANCED_VERTICAL_REF = 'V002'
const SERVICE_TEMPLATE_BASELINE_LINKS = [
  { type: 'area', ref: 'H002', parentHeading: 'Habitat H002' },
  { type: 'area', ref: 'V001', parentHeading: 'Habitat V001' },
  { type: 'area', ref: 'V003', parentHeading: 'Habitat V003' },
  { type: 'hedgerow', ref: 'HG018a', parentHeading: 'Hedgerow HG018' },
  { type: 'hedgerow', ref: 'HG018b', parentHeading: 'Hedgerow HG018' },
  { type: 'watercourse', ref: 'R006', parentHeading: 'Watercourse R006' }
]
const SERVICE_TEMPLATE_UNLINKED = [
  { type: 'hedgerow', ref: 'HG008' },
  { type: 'watercourse', ref: 'R003' },
  { type: 'area', ref: 'T010' },
  { type: 'area', ref: 'T001' },
  { type: 'area', ref: 'T005' }
]
// A Retained feature's page shows its parent's comment, not its own: HG010's
// own is "Gaps planted up" and T010's "Guarded and staked".
const SERVICE_TEMPLATE_RETAINED_COMMENTS = [
  { type: 'hedgerow', ref: 'HG010', comment: 'Cut annually' },
  { type: 'area', ref: 'T010', comment: 'Ivy on the trunk' },
  { type: 'area', ref: 'H002', comment: 'No data' }
]

// A feature's id, read from its grid in the creator's own session: for a
// test whose page has no session, or another user's.
async function creatorFeatureId(browser, projectId, type, ref) {
  const context = await browser.newContext({
    storageState: STORAGE_STATE,
    baseURL: baseUrl
  })
  try {
    return await featureIdByRef(await context.newPage(), projectId, type, ref)
  } finally {
    await context.close()
  }
}

// BMD-1088: an edit on each BNG Service template edit form, the default site's
// Created and Enhanced area habitat, hedgerow, watercourse and tree. Each
// changes the strategic significance alone, which every form offers and no
// lineage rule constrains, so the units move by the High multiplier (1.15)
// and nothing else. The units are the backend's for the same save, replayed
// through its PUT route's own payload schema, edit check and
// applyFeatureUpdate. A tree counts towards the area habitats tile.
const SERVICE_TEMPLATE_SIGNIFICANCE_EDITS = [
  {
    type: 'area',
    ref: 'H014',
    feature: 'area habitat',
    category: CREATED,
    from: 'High',
    to: 'Low',
    before: 8.2004,
    after: 7.1308
  },
  {
    type: 'area',
    ref: 'H006',
    feature: 'area habitat',
    category: ENHANCED,
    from: 'Low',
    to: 'High',
    before: 5.8793,
    after: 6.7612
  },
  {
    type: 'hedgerow',
    ref: 'HG009',
    feature: 'hedgerow',
    category: CREATED,
    from: 'Low',
    to: 'High',
    before: 0.5285,
    after: 0.6077
  },
  {
    type: 'hedgerow',
    ref: 'HG005',
    feature: 'hedgerow',
    category: ENHANCED,
    from: 'Low',
    to: 'High',
    before: 5.4028,
    after: 6.2132
  },
  {
    type: 'watercourse',
    ref: 'R004',
    feature: 'watercourse',
    category: CREATED,
    from: 'Low',
    to: 'High',
    before: 0.5244,
    after: 0.6031
  },
  {
    type: 'watercourse',
    ref: 'R006',
    feature: 'watercourse',
    category: ENHANCED,
    from: 'Low',
    to: 'High',
    before: 0.6945,
    after: 0.7987
  },
  {
    type: 'area',
    ref: 'T005',
    feature: 'tree',
    category: CREATED,
    from: 'High',
    to: 'Low',
    before: 0.1615,
    after: 0.1405
  },
  {
    type: 'area',
    ref: 'T013',
    feature: 'tree',
    category: ENHANCED,
    from: 'Low',
    to: 'High',
    before: 0.1068,
    after: 0.1228
  }
]
const SIGNIFICANCE_DISPLAY = { Low: 'Low (1)', High: 'High (1.15)' }

// A unit type's post-intervention tile, read from the page already open.
function piTileUnits(page, type) {
  return type === 'area'
    ? areaPostInterventionUnits(page)
    : piPage(page, type).tileUnits(POST_INTERVENTION_TILE)
}

// The page heading: the ref, after the feature type on most pages ("Habitat
// H002"), alone on a vertical area habitat's or an edit page ("V001").
const piDetailsHeading = (page, ref) =>
  page.getByRole('heading', { level: 1, name: new RegExp(`(^| )${ref}$`) })

// ─── BNG Service template: hedgerows and watercourses (BMD-1088) ────────────
//
// The default site's linear features, as its import prices them. HG015 is
// created with no parent, so its time to target names the target alone;
// HG018b is the part of HG018 that gets worse, recorded as lost and created
// again in a lower condition, so it names the transition from its parent and
// links to it. R004's encroachment alone increases, with 10 years created in
// advance; R005's condition gets worse with neither advance nor delay, which
// saves it Incomplete. R006 is Enhanced, re-meandered onto a longer route.
// Every value below is the backend's and the frontend's for the same feature,
// read from their code.
const ST_RETAINED_HEDGEROW_REF = 'HG010'
const ST_RETAINED_WATERCOURSE_REF = 'R007'
const ST_CREATED_HEDGEROW_REF = 'HG015'
const ST_CREATED_HEDGEROW_UNITS = '2.06'
const ST_CREATED_HEDGEROW_SELECTIONS = {
  type: NATIVE_HEDGEROW_WITH_TREES,
  significance: 'Low',
  condition: 'Good',
  advance: '0',
  delay: '0'
}
// The same Native hedgerow with trees, Good, over 20 years as the legacy HG013.
const ST_CREATED_HEDGEROW_VALUES = CREATED_HEDGEROW_VALUES
// 0.3500455 km x 4 x 3 x 1 x 0.4903952635 x 1
const ST_CREATED_HEDGEROW_EXACT_UNITS = 2.0599
const ST_WORSE_HEDGEROW_REF = 'HG018b'
const ST_CREATED_WATERCOURSE_REF = 'R004'
const ST_CREATED_WATERCOURSE_UNITS = '0.52'
const ST_CREATED_WATERCOURSE_SELECTIONS = {
  type: 'Ditches',
  significance: 'Low',
  condition: 'Fairly Poor',
  watercourse: 'Minor',
  riparian: 'Major/Minor',
  advance: '10',
  delay: '0'
}
// Its 10 years in advance outrun its 2 years to target.
const ST_CREATED_WATERCOURSE_VALUES = {
  distinctiveness: 'Medium (4)',
  standardTime: 'Fairly Poor to Fairly Poor - 2 years',
  difficulty: 'Low',
  finalTime: '0 years (1)',
  applied: '1'
}
// 0.1300647 km x 4 x 1.5 x 1 x 1 x 1 x 0.8 x 0.84
const ST_CREATED_WATERCOURSE_EXACT_UNITS = 0.5244
const ST_NO_PARENT_WATERCOURSE_REF = 'R003'
const ST_INCOMPLETE_WATERCOURSE_REF = 'R005'
const ST_ENHANCED_WATERCOURSE_REF = 'R006'
// Trading-all-met's HG002, a Native hedgerow enhanced from Poor to Good: the
// only BNG Service template Enhanced hedgerow whose baseline can become
// another type (the Metric's G-6 moves), as the legacy HG018 can.
const ST_ENHANCED_HEDGEROW_REF = 'HG002'
const ST_ENHANCED_HEDGEROW_UNITS = '1.78'
const ST_ENHANCED_HEDGEROW_EXACT_UNITS = 1.7838
const ST_ENHANCED_HEDGEROW_SELECTIONS = {
  type: 'Native hedgerow',
  significance: 'Low',
  condition: 'Good',
  advance: '0',
  delay: '0'
}
const ST_ENHANCED_HEDGEROW_VALUES = {
  distinctiveness: 'Low (2)',
  standardTime: 'Poor to Good - 5 years',
  difficulty: 'Low',
  finalTime: '5 years (0.8368287006)',
  applied: '1'
}
const ST_ENHANCED_HEDGEROW_TYPES = [
  'Choose habitat type',
  'Native hedgerow',
  'Native hedgerow - associated with bank or ditch',
  NATIVE_HEDGEROW_WITH_TREES,
  'Species-rich native hedgerow'
]
// The default site's HG013, Enhanced from Moderate to Good at High
// significance: 0.3333874 km x 4 x (2 + (3 - 2) x 0.8671800006) x 1.15
const ST_HIGH_ENHANCED_HEDGEROW_REF = 'HG013'
const ST_HIGH_ENHANCED_HEDGEROW_EXACT_UNITS = 4.3971
const WATERCOURSE_ENHANCED_CONDITIONS = [
  'Choose target condition',
  'Good (3)',
  'Fairly Good (2.5)',
  'Moderate (2)'
]

// The read-only default site, and the trading-all-met site for its Enhanced
// hedgerow HG002.
function getServiceTemplateLinearProject(browser) {
  return getRunAllUnitTypesPostInterventionProject(browser)
}

function getServiceTemplateEnhancedHedgerowProject(browser) {
  return getRunAreaGainProject(browser)
}

// A unit type's row for `ref`, from its post-intervention page.
async function piRowByRef(page, projectId, type, ref) {
  const { unitPage, label } = await openPiTabFor(page, projectId, type, ref)
  return unitPage.rowByRef(label, ref)
}

// A Retained BNG Service template row is renamed alone: it names its parent,
// so the link to it survives, and the parent keeps its own reference.
async function expectServiceTemplateRetainedRename(
  page,
  details,
  { projectId, type, ref, newRef }
) {
  const before = await piRowByRef(page, projectId, type, ref)
  const totalBefore = await piTileUnits(page, type)
  await openPiFeatureDetails(page, projectId, type, ref)
  const baselineHref = await details.viewBaselineLink.getAttribute('href')
  await details.habitatReferenceInput.fill(newRef)
  await details.saveButton.click()

  await expectOnPiPage(page, projectId, type)
  expect(await piTileUnits(page, type)).toBe(totalBefore)
  expect(await findPiRef(page, projectId, type, ref)).toBeNull()
  expect(await piRowByRef(page, projectId, type, newRef)).toEqual({
    ...before,
    Ref: newRef
  })
  await openPiFeatureDetails(page, projectId, type, newRef)
  await expect(details.habitatReferenceInput).toHaveValue(newRef)
  await expect(details.headingTitle).toHaveText(`Habitat ${newRef}`)
  await expect(details.habitatUnitsValue).toHaveText(before.Units)
  await expect(details.viewBaselineLink).toHaveAttribute('href', baselineHref)

  await details.viewBaselineLink.click()
  await expect(page).toHaveURL(BASELINE_DETAILS_URL_PATTERN)
  await expect(details.habitatReferenceInput).toHaveValue(ref)
}

// Clicking Upload file leaves the page with no prompt, and saves nothing.
async function leaveForUploadFile(page, details, uploadFilePage, projectId) {
  let dialogs = 0
  page.on('dialog', async (dialog) => {
    dialogs += 1
    await dialog.dismiss()
  })
  await details.uploadFileButton.click()

  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/upload-file`))
  await expect(uploadFilePage.heading).toBeVisible()
  expect(dialogs).toBe(0)
}

// A save that breaks both the reference rule and the timing rule.
async function expectBothRulesRefused(details, entered) {
  await expect(details.errorSummary.getByRole('link')).toHaveCount(2)
  await expect(details.errorSummaryLink(INVALID_REF_SUMMARY)).toHaveAttribute(
    'href',
    '#ref'
  )
  await expect(
    details.errorSummaryLink(TIMING_CONFLICT_SUMMARY)
  ).toHaveAttribute('href', '#advanceYears')
  await expect(details.inlineError(INVALID_REF_INLINE)).toBeVisible()
  await expect(details.inlineError(TIMING_CONFLICT_INLINE)).toBeVisible()
  await expect(details.habitatReferenceInput).toHaveValue('')
  await expectCreatedAreaSelections(details, entered)
}

// Fills the form's dropdowns, as expectCreatedAreaSelections names them.
async function chooseCreatedAreaSelections(details, chosen) {
  for (const [name, value] of Object.entries(chosen)) {
    await details[CREATED_AREA_SELECTS[name]].selectOption(value)
  }
}

test.describe('habitat-details', { tag: '@habitat-details' }, () => {
  // The whole file runs sequentially in one worker (mode 'default' overrides
  // fullyParallel without serial-mode failure cascades). Post-intervention
  // uploads must never run concurrently under the shared STORAGE_STATE
  // session: the pending-upload id is a single yar session key
  // (postInterventionPendingUploadId), so a second concurrent upload
  // overwrites it and the first project imports the second upload's file
  // (frontend habitat-upload-received-controller reads the uploadId from the
  // session, not the URL). Sequential scheduling also builds each shared
  // project below exactly once. The timeout is the upload budget: a shared
  // build (create + up to two uploads) overruns the default 60s.
  test.describe.configure({
    mode: 'default',
    timeout: SHARED_BUILD_TEST_TIMEOUT
  })

  // ─── Query parameter validation ─────────────────────────────────────────────

  test.describe(
    'Post-intervention habitat details — query parameter validation',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // Four route-level Joi rejections, merged into one test — each is a bare
      // goto + status check with no shared setup, so running them separately
      // bought nothing.
      test('missing or non-UUID projectId/featureId query params return 400', async ({
        page
      }) => {
        const badUrls = [
          detailsUrl({ projectId: STUB_UUID }),
          detailsUrl({ featureId: STUB_UUID }),
          detailsUrl({ projectId: STUB_UUID, featureId: 'not-a-uuid' }),
          detailsUrl({ projectId: 'not-a-uuid', featureId: STUB_UUID })
        ]

        for (const url of badUrls) {
          const response = await page.goto(url)
          expect(response.status(), url).toBe(HTTP_BAD_REQUEST)
        }
      })
    }
  )

  // ─── Feature not found ──────────────────────────────────────────────────────

  test.describe(
    'Post-intervention habitat details — feature not found',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('valid UUIDs for a non-existent project returns 404', async ({
        page
      }) => {
        const response = await page.goto(
          detailsUrl({ projectId: VALID_UUID_V4, featureId: VALID_UUID_V4 })
        )
        expect(response.status()).toBe(HTTP_NOT_FOUND)
      })

      // The test above never reaches the feature lookup — the project itself
      // does not exist, so the backend 404s before scanning any layer. This one
      // uses a real project the user owns, so the 404 can only come from
      // findFeature failing to match the featureId across the post-intervention
      // habitats, trees, hedgerows and watercourses.
      test('a real project with an unknown featureId returns 404', async ({
        browser,
        page
      }) => {
        const shared = await getRunDetailsProject(browser)
        const response = await page.goto(
          detailsUrl({ projectId: shared.id, featureId: VALID_UUID_V4 })
        )
        expect(response.status()).toBe(HTTP_NOT_FOUND)
      })
    }
  )

  // ─── Role enforcement ───────────────────────────────────────────────────────

  test.describe('Post-intervention habitat details — role enforcement', () => {
    test.use({ storageState: NO_ROLE_STORAGE_STATE })
    test.skip(skipInE2e(NO_ROLE_STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'authenticated user without BNG Completer role is redirected to /auth/forbidden',
      { tag: '@smoke' },
      async ({ page }) => {
        await page.goto(
          detailsUrl({ projectId: STUB_UUID, featureId: STUB_UUID })
        )
        await expect(page).toHaveURL(/\/auth\/forbidden/)
      }
    )
  })

  // ─── Unauthenticated access ─────────────────────────────────────────────────

  test.describe('Post-intervention habitat details — unauthenticated access', () => {
    test(
      'GET /post-intervention-habitat-details redirects to access denied',
      { tag: '@smoke' },
      async ({ page }) => {
        await page.goto(
          detailsUrl({ projectId: STUB_UUID, featureId: STUB_UUID })
        )
        await expect(page).not.toHaveURL(DETAILS_URL_PATTERN)
        await expect(page).toHaveURL(/\/auth\/forbidden$/)
      }
    )
  })

  // ─── Complete-project scenarios ─────────────────────────────────────────────
  // Every test in this block reads the same shared two-upload project
  // (baseline + PI complete); none of them mutate it.

  test.describe('Post-intervention habitat details — complete-project scenarios', () => {
    // ─── Retained area habitat — reference form (BMD-608, BMD-1180) ──────────

    test.describe('retained area habitat display', { tag: LEGACY_ONLY }, () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test(
        'retained area habitat renders every summary row read-only, with only its reference editable',
        { tag: '@smoke' },
        async ({ browser, postInterventionHabitatDetailsPage, page }) => {
          const shared = await getCompleteProject(browser)
          await postInterventionHabitatDetailsPage.open(
            shared.id,
            shared.retainedNoBaseline
          )

          const detailsPage = postInterventionHabitatDetailsPage
          // BMD-608 (PR#191) moved this page to the stacked sections layout:
          // the parcel ref is in the H1 (there is no longer a "Reference" row),
          // "Post-intervention habitat details" is the section <h2>, the size
          // label carries the unit, and the units row is the bordered
          // "Habitat units delivered" summary row.
          await expect(
            page.getByRole('heading', { name: 'Habitat H2-2', exact: true })
          ).toBeVisible()
          await expect(detailsPage.viewOnlyHeading).toBeVisible()
          await expect(detailsPage.caption).toHaveText(shared.name)
          await expect(detailsPage.referenceKey).toBeHidden()
          await expect(detailsPage.interventionKey).toBeVisible()
          await expect(detailsPage.sizeHectaresKey).toBeVisible()
          await expect(detailsPage.broadHabitatKey).toBeVisible()
          await expect(detailsPage.habitatTypeKey).toBeVisible()
          await expect(detailsPage.distinctivenessKey).toBeVisible()
          await expect(detailsPage.conditionKey).toBeVisible()
          await expect(
            detailsPage.stackedStrategicSignificanceKey
          ).toBeVisible()
          await expect(detailsPage.habitatUnitsDeliveredKey).toBeVisible()

          // BMD-1180: the reference is the only editable value, so no dropdowns
          // and no trading-rules row (dropped relative to the baseline details
          // page).
          await detailsPage.assertRetainedRefForm({ ref: 'H2-2' })
          await expect(detailsPage.habitatReferenceInput).toHaveAttribute(
            'maxlength',
            MAX_REF_LENGTH
          )
          await expect(detailsPage.broadHabitatSelect).toBeHidden()
          await expect(detailsPage.habitatTypeSelect).toBeHidden()
          await expect(detailsPage.conditionSelect).toBeHidden()
          await expect(detailsPage.tradingRulesKey).toBeHidden()
        }
      )

      test(
        'retained area habitat shows its saved values with multiplier formatting',
        { tag: '@regression' },
        async ({ browser, postInterventionHabitatDetailsPage, page }) => {
          const shared = await getCompleteProject(browser)
          // Arrive the way the user does (BMD-608 AC1): click the parcel's
          // ref link in the area habitats post-intervention grid rather than deep-linking.
          await openPiFeatureDetails(page, shared.id, 'area', 'H2-2')
          await expect(page).toHaveURL(DETAILS_URL_PATTERN)

          // H2-2: Grassland / Modified grassland / Moderate (fixture values);
          // "Low (2)" and "Moderate (2)" are the engine's reference
          // distinctiveness and condition for that habitat type.
          await expect(
            postInterventionHabitatDetailsPage.habitatReferenceInput
          ).toHaveValue('H2-2')
          // The "Size (hectares)" label carries the unit, so the value renders
          // bare (10 significant figures) — formatAreaHectaresValue, not
          // formatAreaHectares.
          await expect(
            postInterventionHabitatDetailsPage.stackedSizeValue
          ).toHaveText(RETAINED_NO_BASELINE_SIZE_HECTARES)
          await expect(page.getByText(RETAINED, { exact: true })).toBeVisible()
          await expect(
            page.getByText('Grassland', { exact: true })
          ).toBeVisible()
          await expect(
            page.getByText('Modified grassland', { exact: true })
          ).toBeVisible()
          await expect(page.getByText('Low (2)', { exact: true })).toBeVisible()
          await expect(
            page.getByText('Moderate (2)', { exact: true })
          ).toBeVisible()
          await expect(
            postInterventionHabitatDetailsPage.strategicSignificanceValue
          ).toBeVisible()
          // "Habitat units delivered" renders to 2 decimal places and matches
          // the Units cell of the same parcel's grid row.
          const unitsValue =
            postInterventionHabitatDetailsPage.habitatUnitsValue
          await expect(unitsValue).toHaveText(UNITS_TWO_DP_PATTERN)
          await expect(unitsValue).toHaveText(shared.retainedNoBaselineUnits)
        }
      )

      test(
        '"View baseline details" links to the ref-matched baseline feature, whose Back and Cancel links return here',
        // @happy-path: a CDP-runnable functional journey (click through to the
        // baseline page, click Back or Cancel, land where you started). Covers
        // the Enhanced area page too (BMD-878/BMD-935 admit either): Retained,
        // Enhanced and Created area pages all extend
        // layouts/pi-view-only-sections-page.njk, `viewBaselineHref` comes from
        // the shared buildSharedPiViewOnlyFields, and the controller resolves
        // the baseline feature by ref whatever the retention category.
        { tag: ['@regression', '@happy-path'] },
        async ({
          browser,
          postInterventionHabitatDetailsPage,
          baselineHabitatDetailsPage,
          page
        }) => {
          const shared = await getCompleteProject(browser)
          await postInterventionHabitatDetailsPage.open(
            shared.id,
            shared.retainedWithBaseline
          )

          // Only the reference is editable on this second retained record too
          // (H2-2 is the only one checked above) — a BMD-608 QA bounce found
          // some PI pages rendering editable, not all, so more than one retained
          // record needs the no-dropdowns assertion.
          const detailsPage = postInterventionHabitatDetailsPage
          await detailsPage.assertRetainedRefForm({ ref: 'H1' })
          await expect(detailsPage.broadHabitatSelect).toBeHidden()
          await expect(detailsPage.habitatTypeSelect).toBeHidden()
          await expect(detailsPage.conditionSelect).toBeHidden()

          await expect(
            postInterventionHabitatDetailsPage.viewBaselineLink
          ).toBeVisible()
          await postInterventionHabitatDetailsPage.viewBaselineLink.click()
          await expect(page).toHaveURL(BASELINE_DETAILS_URL_PATTERN)

          // The baseline and PI uploads assign independent featureIds, so the
          // link must resolve the baseline feature by parcel ref — a
          // different featureId from the PI feature the user came from.
          const baselineFeatureId = new URL(page.url()).searchParams.get(
            'featureId'
          )
          expect(baselineFeatureId).not.toBe(shared.retainedWithBaseline)
          await expect(postInterventionHabitatDetailsPage.heading).toHaveText(
            'Habitat H1'
          )

          // BMD-878 AC1 and BMD-935 AC1 (Retained). Reaching the baseline page
          // by *clicking* sends a Referer, which is the only thing either
          // link's target is derived from — a page.goto() here would silently
          // exercise the baseline-list fallback instead and prove nothing.
          await expectReturnLinksToPiDetails(
            page,
            baselineHabitatDetailsPage,
            postInterventionHabitatDetailsPage,
            {
              projectId: shared.id,
              featureId: shared.retainedWithBaseline,
              heading: 'Habitat H1'
            }
          )
        }
      )

      // BMD-1180 AC5. Backend integration-tests/features.test.js ("renames
      // the retained habitat and the baseline parcel it is joined to") covers
      // the stored rename; this proves the form sends it trimmed and the list,
      // row units and tile show the result.
      test(
        'saving a new reference trims it, returns to the area page and leaves the units alone',
        { tag: ['@smoke', '@happy-path'] },
        async ({ browser, page, postInterventionHabitatDetailsPage }) => {
          const { id } = await getCreatedAreaSaveProject(
            browser,
            'retained-area-rename',
            COMPLETE_PI_FILE
          )
          const newRef = 'H2-2-NEW'

          await expectRetainedRename(page, postInterventionHabitatDetailsPage, {
            projectId: id,
            type: 'area',
            ref: 'H2-2',
            typed: `  ${newRef}  `,
            newRef,
            rowByRef: areaRowByRef,
            tileUnits: areaPostInterventionUnits
          })
        }
      )

      // BMD-1180 AC4 and AC6: typing changes nothing until Save. Frontend
      // controller-retained-ref.test.js checks only the Cancel href.
      test(
        'Cancel discards a typed reference and returns to the area page without a prompt',
        { tag: '@regression' },
        async ({ browser, page, postInterventionHabitatDetailsPage }) => {
          const shared = await getCompleteProject(browser)
          const details = postInterventionHabitatDetailsPage
          const dialogs = []
          page.on('dialog', async (dialog) => {
            dialogs.push(dialog.message())
            await dialog.dismiss()
          })
          await openPiFeatureDetails(page, shared.id, 'area', 'H2-2')

          await details.habitatReferenceInput.fill('Not saved')
          await expect(details.headingTitle).toHaveText('Habitat H2-2')
          await details.cancelLink.click()

          await expectOnPiPage(page, shared.id, 'area')
          expect(dialogs).toEqual([])
          expect(await areaRowByRef(page, shared.id, 'H2-2')).toMatchObject({
            Units: shared.retainedNoBaselineUnits
          })
          await openPiFeatureDetails(page, shared.id, 'area', 'H2-2')
          await expect(details.habitatReferenceInput).toHaveValue('H2-2')
        }
      )

      // BMD-1180 AC7. Frontend controller-retained-ref.test.js covers blank,
      // whitespace-only and non-UTF-8 against a mocked backend; this is the
      // one witness of the refusal on the Retained page itself.
      test(
        'a blank reference is refused, keeping the input and the saved heading',
        { tag: '@smoke' },
        async ({ browser, page, postInterventionHabitatDetailsPage }) => {
          const shared = await getCompleteProject(browser)
          const details = postInterventionHabitatDetailsPage

          await saveRetainedRef(page, details, {
            projectId: shared.id,
            type: 'area',
            ref: 'H2-2',
            typed: ''
          })

          await expect(page).toHaveURL(DETAILS_URL_PATTERN)
          await expect(page).toHaveTitle(/^Error:/)
          await expect(
            details.errorSummaryLink(INVALID_REF_SUMMARY)
          ).toHaveAttribute('href', '#habitatRef')
          await expect(details.inlineError(INVALID_REF_INLINE)).toBeVisible()
          await expect(details.habitatReferenceInput).toHaveValue('')
          await expect(details.headingTitle).toHaveText('Habitat H2-2')

          await openPiFeatureDetails(page, shared.id, 'area', 'H2-2')
          await expect(details.habitatReferenceInput).toHaveValue('H2-2')
        }
      )

      // BMD-1180 AC7, legacy template projects (backend PR#620). Backend
      // integration-tests/features.test.js covers the 422 and frontend
      // controller-retained-ref.test.js its rendering against a mocked
      // backend; this proves the two meet. A BNG Service template project
      // saves the same rename, which needs the flag on (BMD-1088).
      test(
        'a reference another baseline area habitat carries is refused on a legacy project',
        { tag: '@regression' },
        async ({ browser, page, postInterventionHabitatDetailsPage }) => {
          const { id } = await getCreatedAreaSaveProject(
            browser,
            'retained-area-duplicate-ref',
            COMPLETE_PI_FILE
          )
          const details = postInterventionHabitatDetailsPage

          await saveRetainedRef(page, details, {
            projectId: id,
            type: 'area',
            ref: 'H1',
            typed: 'H2-2'
          })

          await expect(page).toHaveURL(DETAILS_URL_PATTERN)
          await expect(
            details.errorSummaryLink(REF_IN_USE_SUMMARY)
          ).toHaveAttribute('href', '#habitatRef')
          await expect(details.inlineError(REF_IN_USE_INLINE)).toBeVisible()
          await expect(details.habitatReferenceInput).toHaveValue('H2-2')
          await expect(details.headingTitle).toHaveText('Habitat H1')

          await details.cancelLink.click()
          await expectOnPiPage(page, id, 'area')
          for (const ref of ['H1', 'H2-2']) {
            const found = await findPiRef(page, id, 'area', ref)
            expect(found?.label).toBe(RETAINED)
            await expect(found.unitPage.refLink(found.label, ref)).toHaveCount(
              1
            )
          }
        }
      )
    })

    // ─── Created area habitats (BMD-736, BMD-1048) ───────────────────────────
    // A Created area feature renders the edit form
    // (pi-habitat-details-created-edit.njk, frontend PR#418), which replaced
    // the BMD-736 read-only page. It keeps that page's two section headings,
    // derived rows and units row, so the BMD-736 value checks still apply.

    test.describe(
      'Created area habitats render the edit form',
      { tag: ['@regression', LEGACY_ONLY] },
      () => {
        test.use({ storageState: STORAGE_STATE })
        test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

        // A Lost area habitat is one whose baseline habitat was removed and
        // replaced, so the backend maps it to Created (BMD-531/534) — it still
        // appears, rendering the Created area edit form.
        // (Lost hedgerows, watercourses and trees are instead excluded
        // entirely; that is covered by the post-intervention grid specs in
        // test/specs/project-management.)
        test('a Lost area habitat is imported as Created and renders the Created area edit form', async ({
          browser,
          postInterventionHabitatDetailsPage,
          page
        }) => {
          const shared = await getCompleteProject(browser)
          // Arrive the way the user does (AC4c): click the parcel's Ref link
          // in the area habitats post-intervention grid rather than deep-linking.
          await openPiFeatureDetails(page, shared.id, 'area', 'H2-1')
          await expect(page).toHaveURL(DETAILS_URL_PATTERN)

          await postInterventionHabitatDetailsPage.assertCreatedAreaEditForm({
            ref: 'H2-1'
          })
        })

        // BMD-736 AC1 asks for labels *and values*. The Lost-sourced parcel
        // above pins the labels but cannot pin the values that depend on there
        // being no baseline side, so H2-7 — Retention Category "Created" with
        // its Baseline* columns cleared — carries those assertions.
        test('a Created area habitat shows its section-2 values and units delivered', async ({
          browser,
          postInterventionHabitatDetailsPage,
          page
        }) => {
          const shared = await getCreatedAreaProject(browser)
          await openPiFeatureDetails(page, shared.id, 'area', CREATED_AREA_REF)
          await expect(page).toHaveURL(DETAILS_URL_PATTERN)

          const detailsPage = postInterventionHabitatDetailsPage
          // With no baseline condition to name, the time-to-target row drops
          // the transition and shows the target alone (PR#211). The exact
          // string covers both halves of the regression this ticket went
          // through: a blank row fails it, and so does a reappearing "X to Y"
          // prefix, since createdTimeToTargetValue cannot match a transition at
          // all and so would not resolve. The sibling tests pair this with a
          // not.toContainText(STALE_TIME_TO_TARGET_TEXT) guard; that would be
          // vacuous here, because the stale wording itself contains " to " and
          // is therefore already outside this locator's reach.
          await detailsPage.assertCreatedAreaEditForm({ ref: CREATED_AREA_REF })
          await detailsPage.assertCreatedAbsentBaselineValues({
            projectName: shared.name,
            timeToTarget: CREATED_AREA_TIME_TO_TARGET,
            units: shared.createdAreaUnits
          })
          // A created habitat has no baseline counterpart, and H2-7 shares its
          // ref with none of the baseline parcels (H1/H2/H3).
          await expect(detailsPage.viewBaselineLink).toBeHidden()

          // BMD-1048 AC1: each dropdown holds the saved value, and the option
          // lists come from the real /reference/area-creation. Habitat type
          // lists only the Lakes types, and Target condition only the
          // conditions with a creation time for a pond.
          await expectCreatedAreaSelections(
            detailsPage,
            CREATED_AREA_SELECTIONS
          )
          await expectCreatedAreaValues(detailsPage, CREATED_AREA_VALUES)
          await expect(
            detailsPage.habitatTypeSelect.getByRole('option')
          ).toHaveText(LAKES_TYPES)
          await expect(
            detailsPage.strategicSignificanceSelect.getByRole('option')
          ).toHaveText([
            'Choose strategic significance',
            'High (1.15)',
            'Low (1)'
          ])
          await expect(
            detailsPage.targetConditionSelect.getByRole('option')
          ).toHaveText(AREA_CREATION_CONDITIONS)
          await expect(
            detailsPage.advanceYearsSelect.getByRole('option')
          ).toHaveText(['Choose advance', ...TIMING_YEARS])
          await expect(
            detailsPage.delayYearsSelect.getByRole('option')
          ).toHaveText(['Choose delay', ...TIMING_YEARS])
        })

        // BMD-736 AC2, and the back-link witness for every area habitat page.
        // The controller overrides each view model's back href with
        // `postInterventionBackHref(projectId, type, returnUrl)` — keyed on the
        // feature type, never the retention category — and the Created area
        // edit form builds its back href the same way, so one click per
        // feature type covers them all. The hedgerow and watercourse equivalents
        // are folded into their retained smoke tests below.
        test(
          'back link from a Created area habitat returns to the area habitats post-intervention page',
          { tag: '@happy-path' },
          async ({ browser, postInterventionHabitatDetailsPage, page }) => {
            const shared = await getCreatedAreaProject(browser)
            // AC2's GIVEN is AC1, so arrive the way the user does rather than
            // deep-linking: click H2-7's Ref link in the area habitats post-intervention grid.
            await openPiFeatureDetails(
              page,
              shared.id,
              'area',
              CREATED_AREA_REF
            )
            await postInterventionHabitatDetailsPage.backLink.click()

            await expectOnPiPage(page, shared.id, 'area')
          }
        )
      }
    )

    // ─── Created area habitats — editing (BMD-1048) ──────────────────────────
    // The previews (AC4–AC10) run in the browser against the real
    // /reference/area-creation. The frontend's created-area-details.test.js
    // covers the same rules against made-up reference data, so these tests are
    // the only proof the real reference reaches the page. AC3, AC5, AC7 and
    // AC9 add no data the tests below do not already render, so they are left
    // to that unit test. Only the AC11 saves change a project. Every other test
    // here reuses the read-only created-area project and never saves.

    test.describe(
      'Created area habitats — editing',
      { tag: ['@regression', LEGACY_ONLY] },
      () => {
        test.use({ storageState: STORAGE_STATE })
        test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

        // AC2. Sole real-data witness for an import-incomplete Created area's
        // 0.00 units on the form, and for the list's Distinctiveness and
        // Strategic significance, filled from the habitat type and the saved
        // value (frontend PR#465, the PO ruling of 2026-11-06). The list's
        // 0.00 is also witnessed by upload-post-intervention.spec.js
        // (conflicting timing, H001). Frontend
        // created-area-list-display.test.js covers the rule on made-up rows.
        test('an incomplete Created area shows its saved values, default options and zero units', async ({
          browser,
          page,
          postInterventionHabitatDetailsPage
        }) => {
          const { id } = await getCreatedAreaPartlyBlankProject(browser)
          expect(await areaRowByRef(page, id, CREATED_AREA_REF)).toMatchObject({
            Units: '0.00',
            Distinctiveness: 'Medium (4)',
            'Strategic significance': 'Low (1)'
          })

          await openPiFeatureDetails(page, id, 'area', CREATED_AREA_REF)
          const details = postInterventionHabitatDetailsPage
          await expectCreatedAreaSelections(details, {
            broad: 'Lakes',
            type: 'Ponds (non-priority habitat)',
            // The file's legacy label, mapped to Low (frontend PR#448).
            significance: 'Low',
            condition: '',
            advance: '',
            delay: ''
          })
          await expectCreatedAreaValues(details, {
            distinctiveness: 'Medium (4)',
            standardTime: '',
            difficulty: 'Low',
            finalTime: '',
            applied: '1'
          })
          await expect(details.standardTimeToTargetKey).toBeVisible()
          await expect(details.finalTimeToTargetMultiplierKey).toBeVisible()
          await expect(details.habitatUnitsValue).toHaveText('0.00')
          await expect(details.saveButton).toBeVisible()
        })

        // AC4. Broad habitat resets the choices that depend on it.
        test('choosing a new broad habitat resets the habitat type and target condition, and keeps the rest', async ({
          browser,
          page,
          postInterventionHabitatDetailsPage
        }) => {
          const shared = await openSharedCreatedArea(browser, page)
          const details = postInterventionHabitatDetailsPage
          await details.strategicSignificanceSelect.selectOption('High')
          await details.advanceYearsSelect.selectOption('2')

          await details.broadHabitatSelect.selectOption('Grassland')

          await expect(
            details.habitatTypeSelect.getByRole('option')
          ).toHaveText(GRASSLAND_TYPES)
          await expectCreatedAreaSelections(details, {
            type: '',
            condition: '',
            significance: 'High',
            advance: '2',
            delay: '0'
          })
          await expectCreatedAreaValues(details, {
            distinctiveness: '',
            standardTime: '',
            difficulty: '',
            finalTime: '',
            applied: ''
          })
          await expect(details.habitatUnitsValue).toHaveText(
            shared.createdAreaUnits
          )
        })

        // AC6. Habitat type drives the type-only values, and a type's
        // "Not Possible" conditions are left out of Target condition.
        test('choosing a habitat type shows its values and offers only its possible conditions', async ({
          browser,
          page,
          postInterventionHabitatDetailsPage
        }) => {
          const shared = await openSharedCreatedArea(browser, page)
          const details = postInterventionHabitatDetailsPage

          await details.habitatTypeSelect.selectOption('Reservoirs')

          await expect(details.targetConditionSelect).toHaveValue('')
          await expectCreatedAreaValues(details, {
            distinctiveness: 'Medium (4)',
            standardTime: '',
            difficulty: 'Medium',
            finalTime: '',
            applied: '0.67'
          })
          await expect(details.habitatUnitsValue).toHaveText(
            shared.createdAreaUnits
          )

          await details.broadHabitatSelect.selectOption('Cropland')
          await details.habitatTypeSelect.selectOption('Cereal crops')
          await expect(
            details.targetConditionSelect.getByRole('option')
          ).toHaveText([
            'Choose target condition',
            'Condition Assessment N/A (1)'
          ])
        })

        // AC8. Target condition drives both time-to-target rows only.
        test('choosing and clearing the target condition updates only the time to target', async ({
          browser,
          page,
          postInterventionHabitatDetailsPage
        }) => {
          const shared = await openSharedCreatedArea(browser, page)
          const details = postInterventionHabitatDetailsPage

          await details.targetConditionSelect.selectOption('Moderate')
          await expectCreatedAreaValues(details, {
            ...CREATED_AREA_VALUES,
            standardTime: 'Moderate - 3 years',
            finalTime: '3 years (0.898632125)'
          })

          await details.targetConditionSelect.selectOption({
            label: 'Choose target condition'
          })
          await expectCreatedAreaValues(details, {
            ...CREATED_AREA_VALUES,
            standardTime: '',
            finalTime: ''
          })
          await expectCreatedAreaSelections(details, {
            ...CREATED_AREA_SELECTIONS,
            condition: ''
          })
          await expect(details.habitatUnitsValue).toHaveText(
            shared.createdAreaUnits
          )
        })

        // AC10. Final time is standard time + delay - advance, floored at 0,
        // and blank when both are above zero.
        test('advance and delay recalculate the final time to target', async ({
          browser,
          page,
          postInterventionHabitatDetailsPage
        }) => {
          const shared = await openSharedCreatedArea(browser, page)
          const details = postInterventionHabitatDetailsPage
          const finalTime = details.createdFormValue('finalTime')

          await details.delayYearsSelect.selectOption('3')
          await expect(finalTime).toHaveText('8 years (0.7520011535)')
          await details.advanceYearsSelect.selectOption('2')
          await expect(finalTime).toHaveText('')
          await expect(details.errorSummary).toBeHidden()

          await details.delayYearsSelect.selectOption('0')
          await expect(finalTime).toHaveText('3 years (0.898632125)')
          await details.advanceYearsSelect.selectOption('30')
          await expect(finalTime).toHaveText('0 years (1)')

          await details.advanceYearsSelect.selectOption('0')
          await details.delayYearsSelect.selectOption('30+')
          await expect(finalTime).toHaveText('30+ years (0.3197967361)')
          await expectCreatedAreaValues(details, {
            ...CREATED_AREA_VALUES,
            finalTime: '30+ years (0.3197967361)'
          })
          await expect(details.habitatUnitsValue).toHaveText(
            shared.createdAreaUnits
          )
        })

        // AC11 Scenario A. Backend integration-tests/habitats.test.js
        // ("persists complete and incomplete edits") covers the stored
        // result; this proves the list and the tile show it.
        // BMD-1153 AC4: the only journey save of a Created area's comment,
        // the area route's path (the linear and tree routes are separate). The
        // exact units below also show the comment leaves them alone.
        test('saving a complete edit recalculates the row, the units and the total', async ({
          browser,
          page,
          postInterventionHabitatDetailsPage
        }) => {
          const { id } = await getCreatedAreaSaveProject(
            browser,
            'created-area-save-complete'
          )
          const editedRef = `${CREATED_AREA_REF}-new`
          await openPiTabFor(page, id, 'area', CREATED_AREA_REF)
          const totalBefore = await areaPostInterventionUnits(page)
          await openPiFeatureDetails(page, id, 'area', CREATED_AREA_REF)
          const details = postInterventionHabitatDetailsPage

          await details.habitatReferenceInput.fill(editedRef)
          await details.broadHabitatSelect.selectOption('Grassland')
          await details.habitatTypeSelect.selectOption(
            'Other neutral grassland'
          )
          await details.strategicSignificanceSelect.selectOption('High')
          await details.targetConditionSelect.selectOption('Good')
          await details.delayYearsSelect.selectOption('2')
          await details.commentInput.fill(`  ${CREATED_AREA_COMMENT}\n `)
          await details.saveButton.click()

          await expectOnPiPage(page, id, 'area')
          // 0.02428732997 ha x 4 x 3 x 1.15 x 0.6521203607 x 1 = 0.2186
          const totalAfter = await areaPostInterventionUnits(page)
          expect(
            Math.abs(
              totalAfter - (totalBefore - CREATED_AREA_EXACT_UNITS + 0.2186)
            )
          ).toBeLessThan(TILE_ROUNDING)
          expect(await areaRowByRef(page, id, editedRef)).toMatchObject({
            Units: '0.22',
            'Broad habitat': 'Grassland',
            'Habitat type': 'Other neutral grassland',
            Distinctiveness: 'Medium (4)',
            'Strategic significance': 'High (1.15)',
            'Target condition': 'Good (3)',
            Delay: '2 years',
            'Final time to target': '12 years (0.6521203607)'
          })

          await openPiFeatureDetails(page, id, 'area', editedRef)
          await expect(details.habitatReferenceInput).toHaveValue(editedRef)
          await expectCreatedAreaSelections(details, {
            broad: 'Grassland',
            type: 'Other neutral grassland',
            significance: 'High',
            condition: 'Good',
            advance: '0',
            delay: '2'
          })
          await expect(details.habitatUnitsValue).toHaveText('0.22')
          await expect(details.commentInput).toHaveValue(CREATED_AREA_COMMENT)
        })

        // AC11 Scenario B. Sole real-data witness that a saved incomplete
        // Created area shows 0.00 with its type-derived Distinctiveness and
        // saved significance on the list (frontend PR#465, the PO ruling of
        // 2026-11-06). Backend habitats.test.js covers the stored zero.
        test('saving with the target condition cleared shows zero units and leaves the habitat out of the total', async ({
          browser,
          page,
          postInterventionHabitatDetailsPage
        }) => {
          const { id } = await getCreatedAreaSaveProject(
            browser,
            'created-area-save-incomplete'
          )
          await openPiTabFor(page, id, 'area', CREATED_AREA_REF)
          const totalBefore = await areaPostInterventionUnits(page)
          await openPiFeatureDetails(page, id, 'area', CREATED_AREA_REF)
          const details = postInterventionHabitatDetailsPage

          await details.targetConditionSelect.selectOption({
            label: 'Choose target condition'
          })
          await details.saveButton.click()

          await expectOnPiPage(page, id, 'area')
          const totalAfter = await areaPostInterventionUnits(page)
          expect(
            Math.abs(totalAfter - (totalBefore - CREATED_AREA_EXACT_UNITS))
          ).toBeLessThan(TILE_ROUNDING)
          expect(await areaRowByRef(page, id, CREATED_AREA_REF)).toMatchObject({
            Units: '0.00',
            Distinctiveness: 'Medium (4)',
            'Strategic significance': 'Low (1)',
            'Target condition': ''
          })

          await openPiFeatureDetails(page, id, 'area', CREATED_AREA_REF)
          await expectCreatedAreaSelections(details, {
            ...CREATED_AREA_SELECTIONS,
            condition: ''
          })
          await expect(details.habitatUnitsValue).toHaveText('0.00')
        })

        // AC11 Scenario A from an import-incomplete habitat: the stored units
        // go from null to calculated, and the legacy significance label the
        // form mapped to Low (frontend PR#448) is saved without being touched.
        // That untouched-significance save is the path the BMD-1048 QA round 2
        // defect broke.
        test('completing an imported incomplete habitat prices it and adds it to the total', async ({
          browser,
          page,
          postInterventionHabitatDetailsPage
        }) => {
          const { id } = await getCreatedAreaSaveProject(
            browser,
            'created-area-save-from-incomplete',
            CREATED_AREA_PARTLY_BLANK_PI_FILE
          )
          await openPiTabFor(page, id, 'area', CREATED_AREA_REF)
          const totalBefore = await areaPostInterventionUnits(page)
          await openPiFeatureDetails(page, id, 'area', CREATED_AREA_REF)
          const details = postInterventionHabitatDetailsPage

          await details.targetConditionSelect.selectOption('Good')
          await details.advanceYearsSelect.selectOption('0')
          await details.delayYearsSelect.selectOption('0')
          await details.saveButton.click()

          await expectOnPiPage(page, id, 'area')
          const totalAfter = await areaPostInterventionUnits(page)
          expect(
            Math.abs(totalAfter - (totalBefore + CREATED_AREA_EXACT_UNITS))
          ).toBeLessThan(TILE_ROUNDING)
          expect(await areaRowByRef(page, id, CREATED_AREA_REF)).toMatchObject({
            Units: '0.24',
            'Strategic significance': 'Low (1)',
            'Target condition': 'Good (3)'
          })

          await openPiFeatureDetails(page, id, 'area', CREATED_AREA_REF)
          await expectCreatedAreaSelections(details, CREATED_AREA_SELECTIONS)
          await expect(details.habitatUnitsValue).toHaveText('0.24')
        })

        // AC12.
        test('Cancel discards the changes and returns to the area page', async ({
          browser,
          page,
          postInterventionHabitatDetailsPage
        }) => {
          const shared = await openSharedCreatedArea(browser, page)
          const details = postInterventionHabitatDetailsPage
          await details.habitatReferenceInput.fill('Not saved')
          await details.broadHabitatSelect.selectOption('Grassland')
          await details.strategicSignificanceSelect.selectOption('High')
          // BMD-1153 AC6.
          await details.commentInput.fill('Not saved either')

          await details.cancelLink.click()

          await expectOnPiPage(page, shared.id, 'area')
          expect(
            await areaRowByRef(page, shared.id, CREATED_AREA_REF)
          ).toMatchObject({
            Units: shared.createdAreaUnits,
            'Broad habitat': 'Lakes',
            'Strategic significance': 'Low (1)'
          })
          await openPiFeatureDetails(page, shared.id, 'area', CREATED_AREA_REF)
          await expect(details.habitatReferenceInput).toHaveValue(
            CREATED_AREA_REF
          )
          await expectCreatedAreaSelections(details, CREATED_AREA_SELECTIONS)
          await expect(details.commentInput).toHaveValue('')
        })

        // AC13. Frontend controller-created-area.test.js covers each rule on
        // its own against a mocked backend. This proves both errors render
        // together, as UCD worded them, and that nothing is saved.
        // BMD-1153 AC5: the comment breaks both its rules too. Sole journey
        // witness for the comment's errors on a Created form, listed after
        // every other field's (frontend
        // controller-created-supporting-information.test.js covers the order
        // against a mocked backend).
        test('a save breaking both rules shows one error per rule, keeps the input and saves nothing', async ({
          browser,
          page,
          postInterventionHabitatDetailsPage
        }) => {
          const shared = await openSharedCreatedArea(browser, page)
          const details = postInterventionHabitatDetailsPage
          // AC13: every value entered or selected survives the refusal, not
          // only the two fields that fail.
          const entered = {
            broad: 'Grassland',
            type: 'Other neutral grassland',
            significance: 'High',
            condition: 'Moderate',
            advance: '2',
            delay: '3'
          }
          await details.habitatReferenceInput.fill('')
          await details.broadHabitatSelect.selectOption(entered.broad)
          await details.habitatTypeSelect.selectOption(entered.type)
          await details.strategicSignificanceSelect.selectOption(
            entered.significance
          )
          await details.targetConditionSelect.selectOption(entered.condition)
          await details.advanceYearsSelect.selectOption(entered.advance)
          await details.delayYearsSelect.selectOption(entered.delay)
          const comment = `\uFFFD${'c'.repeat(MAX_COMMENT_LENGTH)}`
          await details.commentInput.fill(comment)

          await details.saveButton.click()

          // Invalid characters before length, after the other fields.
          await expect(details.errorSummaryLinks).toHaveText([
            INVALID_REF_SUMMARY,
            TIMING_CONFLICT_SUMMARY,
            COMMENT_INVALID_SUMMARY,
            COMMENT_TOO_LONG_SUMMARY
          ])
          await expect(
            details.errorSummaryLink(INVALID_REF_SUMMARY)
          ).toHaveAttribute('href', '#ref')
          await expect(
            details.errorSummaryLink(TIMING_CONFLICT_SUMMARY)
          ).toHaveAttribute('href', '#advanceYears')
          for (const summary of [
            COMMENT_INVALID_SUMMARY,
            COMMENT_TOO_LONG_SUMMARY
          ]) {
            await expect(details.errorSummaryLink(summary)).toHaveAttribute(
              'href',
              '#comment'
            )
          }
          await expect(details.inlineError(INVALID_REF_INLINE)).toBeVisible()
          await expect(
            details.inlineError(TIMING_CONFLICT_INLINE)
          ).toBeVisible()
          await expect(
            details.inlineError(COMMENT_INVALID_INLINE)
          ).toBeVisible()
          await expect(
            details.inlineError(COMMENT_TOO_LONG_INLINE)
          ).toBeVisible()
          await expect(details.habitatReferenceInput).toHaveValue('')
          await expectCreatedAreaSelections(details, entered)
          await expect(details.commentInput).toHaveValue(comment)

          await openPiFeatureDetails(page, shared.id, 'area', CREATED_AREA_REF)
          await expectCreatedAreaSelections(details, CREATED_AREA_SELECTIONS)
          await expect(details.commentInput).toHaveValue('')
        })

        // AC14.
        test('Upload file leaves unsaved changes behind without a prompt', async ({
          browser,
          page,
          postInterventionHabitatDetailsPage,
          uploadFilePage
        }) => {
          const shared = await openSharedCreatedArea(browser, page)
          const details = postInterventionHabitatDetailsPage
          let dialogs = 0
          page.on('dialog', async (dialog) => {
            dialogs += 1
            await dialog.dismiss()
          })
          await details.habitatReferenceInput.fill('Not saved')
          await details.strategicSignificanceSelect.selectOption('High')

          await details.uploadFileButton.click()

          await expect(page).toHaveURL(
            new RegExp(`/projects/${shared.id}/upload-file`)
          )
          await expect(uploadFilePage.heading).toBeVisible()
          expect(dialogs).toBe(0)
          expect(
            await areaRowByRef(page, shared.id, CREATED_AREA_REF)
          ).toMatchObject({
            Units: shared.createdAreaUnits,
            'Strategic significance': 'Low (1)'
          })
        })
      }
    )

    // ─── Enhanced area habitats — editing (BMD-1045) ─────────────────────────
    // An Enhanced area opens on the Created area form, its choices limited to
    // the valid enhancements of its baseline (GET /reference/area-enhancement,
    // backend PR#650). Backend enhanced-area-edit.test.js and
    // integration-tests/reference.test.js cover the lists, and frontend
    // controller-enhanced-area.test.js renders them against made-up reference
    // data, so these tests are the only proof the real enhancement reference
    // reaches the page. The previews, Cancel, validation and Upload file are
    // the Created form's own code, covered by the Created area tests above.
    // Only the save test changes a project.

    test.describe(
      'Enhanced area habitats — editing',
      { tag: ['@regression', LEGACY_ONLY] },
      () => {
        test.use({ storageState: STORAGE_STATE })
        test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

        // AC1 and AC11. Replaces the BMD-725 read-only page test.
        test(
          'an Enhanced area habitat opens the area edit form, offering only valid enhancements of its baseline',
          { tag: '@smoke' },
          async ({
            browser,
            page,
            postInterventionHabitatDetailsPage,
            baselineHabitatDetailsPage
          }) => {
            const shared = await getCompleteProject(browser)
            await openPiFeatureDetails(
              page,
              shared.id,
              'area',
              ENHANCED_AREA_REF
            )
            const details = postInterventionHabitatDetailsPage

            await details.assertEnhancedAreaEditForm({ ref: ENHANCED_AREA_REF })
            await expect(details.caption).toHaveText(shared.name)
            await expectCreatedAreaSelections(details, ENHANCED_AREA_SELECTIONS)
            await expect(
              details.broadHabitatSelect.getByRole('option')
            ).toHaveText(ENHANCED_AREA_BROAD_HABITATS)
            await expect(
              details.habitatTypeSelect.getByRole('option')
            ).toHaveText(ENHANCED_GRASSLAND_TYPES)
            await expect(
              details.targetConditionSelect.getByRole('option')
            ).toHaveText(AREA_CREATION_CONDITIONS)
            await expect(
              details.advanceYearsSelect.getByRole('option')
            ).toHaveText(['Choose advance', ...TIMING_YEARS])
            await expectEnhancedFormValues(details, ENHANCED_AREA_VALUES)
            await expect(details.habitatUnitsValue).toHaveText(
              ENHANCED_AREA_EXACT_UNITS.toFixed(2)
            )

            // AC11. An Enhanced area finds its baseline as its read-only page
            // did, not through parentFeatureId as a Created feature does.
            await details.viewBaselineLink.click()
            await expect(page).toHaveURL(BASELINE_DETAILS_URL_PATTERN)
            await expect(baselineHabitatDetailsPage.headingTitle).toHaveText(
              `Habitat ${ENHANCED_AREA_REF}`
            )

            // Each baseline is offered its own enhancements.
            await openPiFeatureDetails(
              page,
              shared.id,
              'area',
              ENHANCED_SCRUB_REF
            )
            await expect(
              details.broadHabitatSelect.getByRole('option')
            ).toHaveText(['Choose broad habitat', 'Heathland and shrub'])
            await expect(
              details.habitatTypeSelect.getByRole('option')
            ).toHaveText(SCRUB_TYPES)
            await expect(
              details.targetConditionSelect.getByRole('option')
            ).toHaveText(ENHANCED_SCRUB_CONDITIONS)
            await expectEnhancedFormValues(details, {
              standardTime: 'Poor to Good - 10 years'
            })
          }
        )

        // AC2. Sole real-data witness for an import-incomplete Enhanced area on
        // the form. Frontend controller-enhanced-area.test.js covers it on a
        // made-up feature.
        test('an incomplete Enhanced area shows its saved broad habitat, default options and zero units', async ({
          browser,
          page,
          postInterventionHabitatDetailsPage
        }) => {
          const { id } = await getEnhancedAreaIncompleteProject(browser)
          await openPiFeatureDetails(page, id, 'area', ENHANCED_AREA_REF)
          const details = postInterventionHabitatDetailsPage

          await expect(details.habitatReferenceInput).toHaveValue(
            ENHANCED_AREA_REF
          )
          await expectCreatedAreaSelections(details, {
            broad: 'Grassland',
            type: '',
            significance: '',
            condition: '',
            advance: '',
            delay: ''
          })
          await expect(
            details.habitatTypeSelect.getByRole('option')
          ).toHaveText(ENHANCED_GRASSLAND_TYPES)
          await expect(
            details.targetConditionSelect.getByRole('option')
          ).toHaveText(['Choose target condition'])
          await expectEnhancedFormValues(details, {
            distinctiveness: '',
            standardTime: '',
            difficulty: '',
            finalTime: '',
            applied: ''
          })
          await expect(details.standardTimeToTargetKey).toBeVisible()
          await expect(details.habitatUnitsValue).toHaveText('0.00')
          await expect(details.saveButton).toBeVisible()
        })

        // AC4, AC6 and AC8: each choice lists only the enhancements of the
        // baseline (Modified grassland, Moderate), and the standard time is
        // the enhancement time from that baseline condition.
        test('the choices stay within the valid enhancements of the baseline as they change', async ({
          browser,
          page,
          postInterventionHabitatDetailsPage
        }) => {
          const shared = await getCompleteProject(browser)
          await openPiFeatureDetails(page, shared.id, 'area', ENHANCED_AREA_REF)
          const details = postInterventionHabitatDetailsPage

          // AC6. Kept in its own type, the baseline must improve on Moderate.
          await details.habitatTypeSelect.selectOption('Modified grassland')
          await expect(
            details.targetConditionSelect.getByRole('option')
          ).toHaveText([
            'Choose target condition',
            'Good (3)',
            'Fairly Good (2.5)'
          ])
          await expectEnhancedFormValues(details, {
            distinctiveness: 'Low (2)',
            standardTime: '',
            difficulty: 'Low',
            finalTime: '',
            applied: '1'
          })

          // AC8.
          await details.habitatTypeSelect.selectOption(
            'Other neutral grassland'
          )
          await details.targetConditionSelect.selectOption('Fairly Good')
          await expectEnhancedFormValues(details, {
            ...ENHANCED_AREA_VALUES,
            standardTime: 'Moderate to Fairly Good - 12 years',
            finalTime: '12 years (0.6521203607)'
          })

          // AC4.
          await details.broadHabitatSelect.selectOption('Heathland and shrub')
          await expect(
            details.habitatTypeSelect.getByRole('option')
          ).toHaveText(SCRUB_TYPES)
          await expect(
            details.targetConditionSelect.getByRole('option')
          ).toHaveText(['Choose target condition'])
          await expect(details.habitatUnitsValue).toHaveText(
            ENHANCED_AREA_EXACT_UNITS.toFixed(2)
          )
        })

        // AC12 Scenario A. Sole real-data witness that an Enhanced area save
        // reaches the list with its enhanced units. Backend
        // enhanced-area-edit.test.js:519 and integration-tests/habitats.test.js
        // cover the calculation and storage. Scenario B is left out until the
        // team rules on the list blanking an incomplete Enhanced row's derived
        // columns (see the flow doc, Step 11).
        test('saving a complete edit recalculates the enhanced units, the row and the total', async ({
          browser,
          page,
          postInterventionHabitatDetailsPage
        }) => {
          const { id } = await getCreatedAreaSaveProject(
            browser,
            'enhanced-area-save-complete',
            COMPLETE_PI_FILE
          )
          const newRef = 'H2-3-new'
          // Upland acid grassland (Medium 4), Fairly Good (2.5), High (1.15),
          // delay 2 on the 12-year enhancement: 14 years (0.6072707829).
          // (0.3052136111 x 4 + (0.3052136111 x 10 - 0.3052136111 x 4) x
          // 0.6072707829) x 1.15
          const expectedUnits = 2.6829
          await openPiTabFor(page, id, 'area', ENHANCED_AREA_REF)
          const totalBefore = await areaPostInterventionUnits(page)
          await piPage(page, 'area')
            .refLink('Enhanced', ENHANCED_AREA_REF)
            .click()
          const details = postInterventionHabitatDetailsPage

          await details.habitatReferenceInput.fill(newRef)
          await details.habitatTypeSelect.selectOption('Upland acid grassland')
          await details.targetConditionSelect.selectOption('Fairly Good')
          await details.strategicSignificanceSelect.selectOption('High')
          await details.delayYearsSelect.selectOption('2')
          await details.saveButton.click()

          await expect(page).toHaveURL(piPageUrl(id, 'area'))
          const totalAfter = await areaPostInterventionUnits(page)
          expect(
            Math.abs(
              totalAfter -
                (totalBefore - ENHANCED_AREA_EXACT_UNITS + expectedUnits)
            )
          ).toBeLessThan(TILE_ROUNDING)
          expect(await areaRowByRef(page, id, newRef)).toMatchObject({
            Status: STATUS_COMPLETE,
            Units: expectedUnits.toFixed(2),
            'Broad habitat': 'Grassland',
            'Habitat type': 'Upland acid grassland',
            Distinctiveness: 'Medium (4)',
            'Strategic significance': 'High (1.15)',
            'Target condition': 'Fairly Good (2.5)',
            Delay: '2 years',
            'Final time to target': '14 years (0.6072707829)'
          })
        })
      }
    )

    // ─── Cross-user access ────────────────────────────────────────────────────
    // The backend scopes projects by owner (visibleToUser), so a direct
    // object URL from a different authenticated user must 404 without
    // leaking any of the creator's data (IDOR).

    test.describe('cross-user access', { tag: '@regression' }, () => {
      test.skip(skipInE2e(NO_PROJECTS_STORAGE_STATE), E2E_SKIP_REASON)

      test('a feature in one user’s project cannot be opened directly by a different user', async ({
        browser
      }) => {
        const shared = await getRunDetailsProject(browser)
        const featureId = isServiceTemplateRun()
          ? await creatorFeatureId(
              browser,
              shared.id,
              'area',
              SERVICE_TEMPLATE_RETAINED_AREA.ref
            )
          : shared.retainedNoBaseline
        const otherContext = await browser.newContext({
          storageState: NO_PROJECTS_STORAGE_STATE,
          baseURL: baseUrl
        })
        try {
          const otherPage = await otherContext.newPage()
          const response = await otherPage.goto(
            detailsUrl({
              projectId: shared.id,
              featureId
            })
          )
          expect(response.status()).toBe(HTTP_NOT_FOUND)
          // None of the creator's feature data is rendered.
          await expect(
            otherPage.getByText(
              isServiceTemplateRun()
                ? SERVICE_TEMPLATE_RETAINED_AREA.habitatType
                : 'Modified grassland'
            )
          ).toBeHidden()
          await expect(otherPage.getByText(shared.name)).toBeHidden()
        } finally {
          await otherContext.close()
        }
      })
    })
  })

  // ─── Mixed-project scenarios ────────────────────────────────────────────────
  // Every test in this block reads the same shared mixed-fixture project;
  // none of them mutate it.

  test.describe(
    'Post-intervention habitat details — mixed-project scenarios',
    { tag: LEGACY_ONLY },
    () => {
      // ─── Retained area habitat — baseline-side value sourcing ────────────────
      // For a retained feature the engine derives everything from the baseline
      // side, so the view-only page reads descriptive values from the
      // feature's baseline sub-object. The mixed fixture's H1 has entirely
      // blank proposed columns — if the page read proposed-side values these
      // rows would be empty.

      test.describe('retained value sourcing', { tag: '@regression' }, () => {
        test.use({ storageState: STORAGE_STATE })
        test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

        // Restored 2026-11-16 (BMD-1043 signed off). A post-intervention-only
        // upload now derives its baseline from the file (BMD-1056, backend
        // PR#478), so the unit-type post-intervention page lists H1 and its
        // featureId is harvested from the grid again.
        test('retained parcel with blank proposed columns shows baseline-side values', async ({
          browser,
          postInterventionHabitatDetailsPage,
          page
        }) => {
          const shared = await getMixedProject(browser)
          await postInterventionHabitatDetailsPage.open(
            shared.id,
            shared.retainedBlankProposed
          )

          await expect(
            postInterventionHabitatDetailsPage.viewOnlyHeading
          ).toBeVisible()
          await expect(page.getByText(RETAINED, { exact: true })).toBeVisible()
          // Baseline-side values (the proposed columns are blank in the
          // fixture).
          await expect(page.getByText('Urban', { exact: true })).toBeVisible()
          await expect(
            page.getByText('Developed land; sealed surface', { exact: true })
          ).toBeVisible()
          // Condition "6. N/A - Other" renders with its list prefix stripped
          // (unanchored: getByText regexes match raw, un-normalised text).
          await expect(page.getByText(/N\/A - Other/)).toBeVisible()
          await expect(
            postInterventionHabitatDetailsPage.habitatUnitsValue
          ).toHaveText(shared.retainedBlankProposedUnits)
          // The baseline derived from the same file holds H1, so the link
          // resolves (it was hidden before BMD-1056, with no baseline at all).
          await expect(
            postInterventionHabitatDetailsPage.viewBaselineLink
          ).toBeVisible()
        })
      })
    }
  )

  // ─── Retained hedgerow — reference form (BMD-723, BMD-1180) ────────────────

  test.describe(
    'Post-intervention habitat details — retained hedgerow display',
    { tag: LEGACY_ONLY },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // BMD-1180: "Habitat <ref>" on every retained type (PO ruling 2026-11-03,
      // frontend PR#482), though the baseline hedgerow page reads "Hedgerow <ref>".
      test(
        'retained hedgerow heading is "Habitat" followed by its reference',
        { tag: '@regression' },
        async ({ browser, postInterventionHabitatDetailsPage, page }) => {
          const shared = await getHedgerowsProject(browser)
          await postInterventionHabitatDetailsPage.open(
            shared.id,
            shared.retainedHedgerow
          )

          await expect(
            page.getByRole('heading', {
              name: `Habitat ${RETAINED_HEDGEROW_REF}`,
              exact: true
            })
          ).toBeVisible()
        }
      )

      test(
        'retained hedgerow renders its rows read-only, with only its reference editable and no Broad habitat row',
        { tag: '@smoke' },
        async ({ browser, postInterventionHabitatDetailsPage, page }) => {
          const shared = await getHedgerowsProject(browser)
          await postInterventionHabitatDetailsPage.open(
            shared.id,
            shared.retainedHedgerow
          )

          const detailsPage = postInterventionHabitatDetailsPage
          await expect(detailsPage.viewOnlyHeading).toBeVisible()
          await expect(detailsPage.interventionKey).toBeVisible()
          await expect(detailsPage.sizeKilometresKey).toBeVisible()
          await expect(detailsPage.lengthKey).toBeHidden()
          await expect(detailsPage.habitatTypeKey).toBeVisible()
          // Hedgerows have no broad-habitat dimension and no area size row.
          await expect(detailsPage.broadHabitatKey).toBeHidden()
          await expect(detailsPage.sizeHectaresKey).toBeHidden()
          await expect(
            page.getByText('Native hedgerow', { exact: true })
          ).toBeVisible()
          await detailsPage.assertRetainedRefForm({
            ref: RETAINED_HEDGEROW_REF
          })
          await expect(detailsPage.habitatTypeSelect).toBeHidden()

          // The back-link witness for every hedgerow page (BMD-723, BMD-733 and
          // BMD-737 AC2): the controller sets the back href from the feature type
          // alone — see the Created area back-link test.
          await detailsPage.backLink.click()
          await expectOnPiPage(page, shared.id, 'hedgerow')
        }
      )

      test(
        'retained hedgerow shows its saved values with multiplier formatting',
        { tag: '@regression' },
        async ({ browser, postInterventionHabitatDetailsPage, page }) => {
          const shared = await getHedgerowsProject(browser)
          // Arrive the way the user does (BMD-723 AC1): open the hedgerows grid
          // tab and click the hedgerow's ref link rather than deep-linking.
          await openPiFeatureDetails(
            page,
            shared.id,
            'hedgerow',
            RETAINED_HEDGEROW_REF
          )
          await expect(page).toHaveURL(DETAILS_URL_PATTERN)

          await expect(postInterventionHabitatDetailsPage.caption).toHaveText(
            shared.name
          )
          await expect(
            postInterventionHabitatDetailsPage.habitatReferenceInput
          ).toHaveValue(RETAINED_HEDGEROW_REF)
          // HR1: Native hedgerow / Moderate / 90 m (fixture values); "Low (2)"
          // and "Moderate (2)" are the engine's reference distinctiveness and
          // condition for that habitat type. The "Size (kilometres)" label
          // carries the unit, so the value renders bare with trailing zeros
          // trimmed.
          await expect(page.getByText(RETAINED, { exact: true })).toBeVisible()
          await expect(
            postInterventionHabitatDetailsPage.stackedSizeValue
          ).toHaveText(/^\s*0\.09\s*$/)
          await expect(page.getByText('Low (2)', { exact: true })).toBeVisible()
          await expect(
            page.getByText('Moderate (2)', { exact: true })
          ).toBeVisible()
          await expect(
            postInterventionHabitatDetailsPage.strategicSignificanceValue
          ).toBeVisible()
          // "Habitat units delivered" matches the Units cell of the same
          // hedgerow's grid row.
          await expect(
            postInterventionHabitatDetailsPage.habitatUnitsValue
          ).toHaveText(shared.retainedHedgerowUnits)
        }
      )

      test(
        '"View baseline details" links to the ref-matched baseline hedgerow',
        { tag: '@regression' },
        async ({ browser, postInterventionHabitatDetailsPage, page }) => {
          const shared = await getHedgerowsProject(browser)
          await postInterventionHabitatDetailsPage.open(
            shared.id,
            shared.retainedHedgerow
          )

          await expect(
            postInterventionHabitatDetailsPage.viewBaselineLink
          ).toBeVisible()
          await postInterventionHabitatDetailsPage.viewBaselineLink.click()
          await expect(page).toHaveURL(BASELINE_DETAILS_URL_PATTERN)

          // The baseline and PI uploads assign independent featureIds, so the
          // link must resolve the baseline feature by parcel ref — a different
          // featureId from the PI feature the user came from.
          const baselineFeatureId = new URL(page.url()).searchParams.get(
            'featureId'
          )
          expect(baselineFeatureId).not.toBe(shared.retainedHedgerow)
          await expect(postInterventionHabitatDetailsPage.heading).toHaveText(
            `Hedgerow ${RETAINED_HEDGEROW_REF}`
          )
        }
      )

      // BMD-1180 AC5. Sole real-data witness for renaming a Retained hedgerow
      // through this page: backend integration-tests/features.test.js renames a
      // retained area parcel and a tree, and the hedgerow rename is covered only
      // by apply-retained-ref-edit.test.js on a fabricated project. Do not delete
      // without adding a hedgerow PUT to that integration test first.
      test(
        'saving a new reference on a retained hedgerow returns to the hedgerow page and leaves the units alone',
        { tag: '@regression' },
        async ({ browser, page, postInterventionHabitatDetailsPage }) => {
          const { id } = await getHedgerowsProject(
            browser,
            'retained-hedgerow-rename'
          )
          const newRef = `${RETAINED_HEDGEROW_REF}-NEW`

          await expectRetainedRename(page, postInterventionHabitatDetailsPage, {
            projectId: id,
            type: 'hedgerow',
            ref: RETAINED_HEDGEROW_REF,
            typed: newRef,
            newRef,
            rowByRef: hedgerowRowByRef,
            tileUnits: hedgerowPostInterventionUnits
          })
        }
      )
    }
  )

  // ─── Enhanced hedgerow — edit form (BMD-1046) ───────────────────────────────
  // Since frontend PR #526 and backend PR #660 an Enhanced hedgerow opens the
  // hedgerow edit form, its choices limited to the valid enhancements of its
  // baseline (BMD-733's read-only page is gone). HG018 of the all-unit-types
  // pair is the only Enhanced hedgerow that is priced: Line of trees, Poor ->
  // Moderate. HG032 is the incomplete one. The previews and buttons this form
  // shares with the Created hedgerow form (AC3, AC7, AC11-AC13) are left to
  // "Created hedgerow habitats — editing".

  test.describe(
    'Enhanced hedgerow habitats — editing',
    { tag: ['@regression', LEGACY_ONLY] },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // AC1 and AC9. Replaces the BMD-733 read-only page test. The standard
      // time also pins the condition transition of frontend PR#193 against
      // the static wording it replaced.
      test(
        'an Enhanced hedgerow opens the hedgerow edit form, offering only valid enhancements of its baseline',
        { tag: '@smoke' },
        async ({
          browser,
          page,
          postInterventionHabitatDetailsPage,
          baselineHabitatDetailsPage
        }) => {
          const shared = await getAllTypesProject(browser)
          await openPiFeatureDetails(
            page,
            shared.id,
            'hedgerow',
            ENHANCED_UPLIFT_HEDGEROW_REF
          )
          const details = postInterventionHabitatDetailsPage

          await details.assertEnhancedHedgerowEditForm({
            ref: ENHANCED_UPLIFT_HEDGEROW_REF
          })
          await expect(details.caption).toHaveText(shared.name)
          await expectCreatedAreaSelections(
            details,
            ENHANCED_HEDGEROW_SELECTIONS
          )
          await expect(
            details.habitatTypeSelect.getByRole('option')
          ).toHaveText(ENHANCED_HEDGEROW_TYPES)
          await expect(
            details.targetConditionSelect.getByRole('option')
          ).toHaveText(['Choose target condition', 'Good (3)', 'Moderate (2)'])
          await expect(
            details.strategicSignificanceSelect.getByRole('option')
          ).toHaveText(STRATEGIC_SIGNIFICANCE_OPTIONS)
          await expect(
            details.advanceYearsSelect.getByRole('option')
          ).toHaveText(['Choose advance', ...TIMING_YEARS])
          await expect(details.delayYearsSelect.getByRole('option')).toHaveText(
            ['Choose delay', ...TIMING_YEARS]
          )
          await expectEnhancedFormValues(details, {
            intervention: 'Enhanced',
            size: ENHANCED_UPLIFT_HEDGEROW_KM,
            ...ENHANCED_HEDGEROW_VALUES
          })
          await expect(
            details.createdFormValue('standardTime', { baselineLink: true })
          ).not.toContainText(STALE_TIME_TO_TARGET_TEXT)
          await expect(details.habitatUnitsValue).toHaveText(
            shared.enhancedUpliftHedgerowUnits
          )

          // AC9. Unsaved changes are left behind.
          await details.habitatReferenceInput.fill('Not saved')
          await details.viewBaselineLink.click()
          await expect(page).toHaveURL(BASELINE_DETAILS_URL_PATTERN)
          await expect(baselineHabitatDetailsPage.headingTitle).toHaveText(
            `Hedgerow ${ENHANCED_UPLIFT_HEDGEROW_REF}`
          )
          await openPiFeatureDetails(
            page,
            shared.id,
            'hedgerow',
            ENHANCED_UPLIFT_HEDGEROW_REF
          )
          await expect(details.habitatReferenceInput).toHaveValue(
            ENHANCED_UPLIFT_HEDGEROW_REF
          )
        }
      )

      // AC2, under the PO ruling of frontend PR #532: a significance rejected
      // on import shows the default option, with no "(imported value)" option
      // kept. Sole real-data witness; frontend
      // controller-enhanced-hedgerow-edit.test.js covers it on a made-up
      // feature.
      test('an incomplete Enhanced hedgerow shows its rejected significance as the default option and zero units', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage
      }) => {
        const shared = await getAllTypesProject(browser)
        await openPiFeatureDetails(
          page,
          shared.id,
          'hedgerow',
          ENHANCED_REJECTED_HEDGEROW_REF
        )
        const details = postInterventionHabitatDetailsPage

        await expect(details.habitatReferenceInput).toHaveValue(
          ENHANCED_REJECTED_HEDGEROW_REF
        )
        await expectCreatedAreaSelections(details, {
          type: ENHANCED_REJECTED_HEDGEROW_TYPE,
          significance: '',
          condition: 'Good',
          advance: '0',
          delay: '0'
        })
        await expect(
          details.strategicSignificanceSelect.getByRole('option')
        ).toHaveText(STRATEGIC_SIGNIFICANCE_OPTIONS)
        await expect(details.habitatTypeSelect.getByRole('option')).toHaveText([
          'Choose habitat type',
          ENHANCED_REJECTED_HEDGEROW_TYPE
        ])
        await expect(
          details.targetConditionSelect.getByRole('option')
        ).toHaveText(['Choose target condition', 'Good (3)'])
        await expect(details.habitatUnitsValue).toHaveText('0.00')
        await expect(details.saveButton).toBeVisible()
      })

      // AC4, AC5, AC6 and AC8. Each choice lists only the enhancements of the
      // baseline (Line of trees, Poor). A move to a higher-distinctiveness
      // type takes the metric's G-6 type-to-type time, whatever the condition.
      test('the choices stay within the valid enhancements of the baseline as they change', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage
      }) => {
        const shared = await getAllTypesProject(browser)
        await openPiFeatureDetails(
          page,
          shared.id,
          'hedgerow',
          ENHANCED_UPLIFT_HEDGEROW_REF
        )
        const details = postInterventionHabitatDetailsPage

        // AC6, condition to condition within Line of trees.
        await details.targetConditionSelect.selectOption('Good')
        await expectEnhancedFormValues(details, {
          ...ENHANCED_HEDGEROW_VALUES,
          standardTime: 'Poor to Good - 30 years',
          finalTime: '30 years (0.3434151104)'
        })

        // AC4.
        await details.habitatTypeSelect.selectOption(NATIVE_HEDGEROW_WITH_TREES)
        await expectCreatedAreaSelections(details, {
          ...ENHANCED_HEDGEROW_SELECTIONS,
          type: NATIVE_HEDGEROW_WITH_TREES,
          condition: ''
        })
        await expect(
          details.targetConditionSelect.getByRole('option')
        ).toHaveText([
          'Choose target condition',
          'Good (3)',
          'Moderate (2)',
          'Poor (1)'
        ])
        await expectEnhancedFormValues(details, {
          distinctiveness: 'Medium (4)',
          standardTime: '',
          difficulty: 'Low',
          finalTime: '',
          applied: '1'
        })

        // AC6, type to type (G-6): 12 years from Poor and to Good alike.
        await details.targetConditionSelect.selectOption('Poor')
        await expectEnhancedFormValues(details, {
          standardTime: 'Poor to Poor - 12 years',
          finalTime: '12 years (0.6521203607)'
        })
        await details.targetConditionSelect.selectOption('Good')
        await expectEnhancedFormValues(details, {
          standardTime: 'Poor to Good - 12 years'
        })

        // AC8.
        const finalTime = details.createdFormValue('finalTime', {
          baselineLink: true
        })
        await details.delayYearsSelect.selectOption('2')
        await expect(finalTime).toHaveText('14 years (0.6072707829)')
        await details.advanceYearsSelect.selectOption('2')
        await expect(finalTime).toHaveText('')
        await expect(details.errorSummary).toBeHidden()
        await details.delayYearsSelect.selectOption('0')
        await details.advanceYearsSelect.selectOption('25')
        await expect(finalTime).toHaveText('0 years (1)')

        // AC5.
        await details.habitatTypeSelect.selectOption({
          label: 'Choose habitat type'
        })
        await expect(
          details.targetConditionSelect.getByRole('option')
        ).toHaveText(['Choose target condition'])
        await expectEnhancedFormValues(details, {
          distinctiveness: '',
          standardTime: '',
          difficulty: '',
          finalTime: '',
          applied: ''
        })
        await expect(details.habitatUnitsValue).toHaveText(
          shared.enhancedUpliftHedgerowUnits
        )
      })

      // AC10 Scenario A. Backend enhanced-hedgerow-edit.test.js:113 and
      // integration-tests/habitats.test.js ("BMD-1046 Enhanced hedgerow
      // editing") cover the calculation and storage; this proves the list and
      // the hedgerow tile show it.
      test('saving a complete edit recalculates the enhanced units, the row and the total', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage
      }) => {
        const { id } = await getAllTypesProjectCopy(
          browser,
          'enhanced-hedgerow-save-complete'
        )
        const newRef = `${ENHANCED_UPLIFT_HEDGEROW_REF}-new`
        // Native hedgerow with trees (Medium 4), Moderate (2), Low (1), delay
        // 2 on the 12-year G-6 move: 14 years (0.6072707829).
        // 0.3903847 x 4 x 2 = T, 0.3903847 x 2 x 1 = B,
        // (B + (T - B) x 0.6072707829 x 1) x 1 = 2.2032
        const expectedUnits = 2.2032
        await openPiTabFor(page, id, 'hedgerow', ENHANCED_UPLIFT_HEDGEROW_REF)
        const totalBefore = await hedgerowPostInterventionUnits(page)
        await piPage(page, 'hedgerow')
          .refLink('Enhanced', ENHANCED_UPLIFT_HEDGEROW_REF)
          .click()
        const details = postInterventionHabitatDetailsPage

        await details.habitatReferenceInput.fill(newRef)
        await details.habitatTypeSelect.selectOption(NATIVE_HEDGEROW_WITH_TREES)
        await details.targetConditionSelect.selectOption('Moderate')
        await details.strategicSignificanceSelect.selectOption('Low')
        await details.delayYearsSelect.selectOption('2')
        await details.saveButton.click()

        await expectOnPiPage(page, id, 'hedgerow')
        const totalAfter = await hedgerowPostInterventionUnits(page)
        expect(
          Math.abs(
            totalAfter -
              (totalBefore -
                ENHANCED_UPLIFT_HEDGEROW_EXACT_UNITS +
                expectedUnits)
          )
        ).toBeLessThan(TILE_ROUNDING)
        expect(await hedgerowRowByRef(page, id, newRef)).toMatchObject({
          Status: STATUS_COMPLETE,
          Units: expectedUnits.toFixed(2),
          'Habitat type': NATIVE_HEDGEROW_WITH_TREES,
          Distinctiveness: 'Medium (4)',
          'Strategic significance': 'Low (1)',
          'Target condition': 'Moderate (2)',
          Delay: '2 years',
          'Final time to target': '14 years (0.6072707829)'
        })
      })

      // AC10 Scenario B. The list's other derived columns after an incomplete
      // save await the same ruling as the Created hedgerow's, so only the
      // status, the 0.00 and the total are asserted.
      test('saving with the significance cleared shows zero units and leaves the hedgerow out of the total', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage
      }) => {
        const { id } = await getAllTypesProjectCopy(
          browser,
          'enhanced-hedgerow-save-incomplete'
        )
        await openPiTabFor(page, id, 'hedgerow', ENHANCED_UPLIFT_HEDGEROW_REF)
        const totalBefore = await hedgerowPostInterventionUnits(page)
        await piPage(page, 'hedgerow')
          .refLink('Enhanced', ENHANCED_UPLIFT_HEDGEROW_REF)
          .click()
        const details = postInterventionHabitatDetailsPage

        await details.strategicSignificanceSelect.selectOption({
          label: 'Choose strategic significance'
        })
        await details.saveButton.click()

        await expectOnPiPage(page, id, 'hedgerow')
        const totalAfter = await hedgerowPostInterventionUnits(page)
        expect(
          Math.abs(
            totalAfter - (totalBefore - ENHANCED_UPLIFT_HEDGEROW_EXACT_UNITS)
          )
        ).toBeLessThan(TILE_ROUNDING)
        expect(
          await hedgerowRowByRef(page, id, ENHANCED_UPLIFT_HEDGEROW_REF)
        ).toMatchObject({ Status: STATUS_INCOMPLETE, Units: '0.00' })

        await openPiFeatureDetails(
          page,
          id,
          'hedgerow',
          ENHANCED_UPLIFT_HEDGEROW_REF
        )
        await expectCreatedAreaSelections(details, {
          ...ENHANCED_HEDGEROW_SELECTIONS,
          significance: ''
        })
        await expect(details.habitatUnitsValue).toHaveText('0.00')
      })
    }
  )

  // BMD-1049: real uploaded Created hedgerows render the shared edit form.
  // Keep both baseline-transition and absent-baseline fixtures as witnesses.

  test.describe(
    'Created hedgerow habitats are editable',
    { tag: ['@regression', LEGACY_ONLY] },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('a Created hedgerow renders the editable form with transition values', async ({
        browser,
        postInterventionHabitatDetailsPage,
        page
      }) => {
        const shared = await getHedgerowsProject(browser)
        await openPiFeatureDetails(
          page,
          shared.id,
          'hedgerow',
          CREATED_HEDGEROW_REF
        )
        await expect(page).toHaveURL(DETAILS_URL_PATTERN)

        const detailsPage = postInterventionHabitatDetailsPage
        await detailsPage.assertCreatedHedgerowEditForm({
          ref: CREATED_HEDGEROW_REF
        })
        await expectCreatedHedgerowSelections(detailsPage, {
          habitatType: 'Native hedgerow',
          condition: 'Moderate',
          significance: 'Low'
        })
        await expect(detailsPage.lengthKey).toBeVisible()
        await expect(detailsPage.createdLengthValue).toHaveText('0.024km')
        await expect(detailsPage.broadHabitatSelect).toBeHidden()

        // AC1 asks for labels *and* values. The edit-form helper pins the six
        // time-to-target labels; the standard time-to-target value proves
        // section 2 resolves its data.
        //
        // HR3 is the *transition* branch, not the created one: it is Created in
        // the fixture but still carries a real Baseline Condition ("Moderate"),
        // so formatStandardTimeToTarget names both conditions. A genuinely
        // created hedgerow has no prior condition and takes the short form
        // instead — covered separately below on HG013, which is what BMD-737's
        // re-work actually changed. Keep both: this pins the transition wording
        // frontend PR#193 introduced against the static text it replaced.
        await expect(detailsPage.standardTimeToTargetValue).toHaveText(
          CREATED_MODERATE_TIME
        )
        await expect(detailsPage.standardTimeToTargetValue).not.toContainText(
          STALE_TIME_TO_TARGET_TEXT
        )
        // "Habitat units delivered" matches the Units cell of the same
        // hedgerow's grid row.
        await expect(detailsPage.habitatUnitsValue).toHaveText(
          shared.createdHedgerowUnits
        )
      })

      // BMD-737 AC1, on a hedgerow that is created in the sense the ticket's
      // preconditions mean it: Retention Category "Created" with no usable
      // baseline condition. The HR3 test above pins the labels and the
      // transition branch, but cannot pin the values that depend on there being
      // no baseline side — which is precisely what the re-work changed.
      test('a Created hedgerow with no baseline condition shows its section-2 values and units delivered', async ({
        browser,
        postInterventionHabitatDetailsPage,
        page
      }) => {
        const shared = await getCreatedLinearProject(browser)
        await openPiFeatureDetails(
          page,
          shared.id,
          'hedgerow',
          CREATED_LINEAR_HEDGEROW_REF
        )
        await expect(page).toHaveURL(DETAILS_URL_PATTERN)

        const detailsPage = postInterventionHabitatDetailsPage
        // HG013's baseline condition is the GeoPackage sentinel "N/A", which
        // PR#206 made count as absent — so the row drops the transition and
        // shows the target alone (PR#211). createdTimeToTargetValue cannot
        // match a value carrying " to ", so this catches both halves of the
        // regression BMD-737 was re-worked for: a blank row leaves the locator
        // unresolved, and so does a reappearing transition prefix. It also
        // proves the sentinel itself never reaches the page.
        await detailsPage.assertCreatedHedgerowEditForm({
          ref: CREATED_LINEAR_HEDGEROW_REF
        })
        await detailsPage.assertCreatedAbsentBaselineValues({
          projectName: shared.name,
          timeToTarget: CREATED_LINEAR_HEDGEROW_TIME_TO_TARGET,
          units: shared.createdLinearHedgerowUnits
        })
        // Created hedgerows label the size field "Length (km)" and have no
        // broad-habitat dimension.
        await expectCreatedHedgerowSelections(detailsPage, {
          habitatType: NATIVE_HEDGEROW_WITH_TREES,
          condition: 'Good',
          significance: 'High'
        })
        await expect(detailsPage.lengthKey).toBeVisible()
        // HG013 geometry is 175.1389248737094 m; the Length column is rounded.
        await expect(detailsPage.createdLengthValue).toHaveText('0.1751389km')
        await expect(detailsPage.broadHabitatKey).toBeHidden()
        // This fixture has no explicit stored parent, so there is no baseline link.
        await expect(detailsPage.viewBaselineLink).toBeHidden()
        // BMD-1049 AC1 and AC7: the derived values and the remaining option
        // lists, from the real /reference/hedgerow-creation.
        await expectCreatedAreaValues(detailsPage, CREATED_HEDGEROW_VALUES)
        await expect(
          detailsPage.strategicSignificanceSelect.getByRole('option')
        ).toHaveText([
          'Choose strategic significance',
          'High (1.15)',
          'Low (1)'
        ])
        await expect(
          detailsPage.advanceYearsSelect.getByRole('option')
        ).toHaveText(['Choose advance', ...TIMING_YEARS])
        await expect(
          detailsPage.delayYearsSelect.getByRole('option')
        ).toHaveText(['Choose delay', ...TIMING_YEARS])
      })
      test(
        'saves a Created hedgerow reference and reloads the edited row',
        { tag: '@happy-path' },
        async ({ browser, page, postInterventionHabitatDetailsPage }) => {
          const shared = await getHedgerowsProject(
            browser,
            'hedgerows-edit-save'
          )
          await openPiFeatureDetails(
            page,
            shared.id,
            'hedgerow',
            CREATED_HEDGEROW_REF
          )
          const details = postInterventionHabitatDetailsPage
          const updatedRef = `${CREATED_HEDGEROW_REF} edited`
          await details.habitatReferenceInput.fill(updatedRef)
          await details.targetConditionSelect.selectOption('Poor')
          await details.saveButton.click()
          await expectOnPiPage(page, shared.id, 'hedgerow')
          // HR3: 0.024 km of Native hedgerow, Poor condition, zero timing.
          expect(
            await unitsByRef(page, shared.id, 'hedgerow', updatedRef)
          ).toBe('0.05')
          await openPiFeatureDetails(page, shared.id, 'hedgerow', updatedRef)
          await expect(details.habitatReferenceInput).toHaveValue(updatedRef)
          await expect(details.targetConditionSelect).toHaveValue('Poor')
          await expect(details.habitatUnitsValue).toHaveText('0.05')
        }
      )
    }
  )

  // BMD-1049 AC2-AC12 on HG013, a hedgerow created with no baseline condition.
  // The previews run in the browser against the real /reference/hedgerow-creation;
  // frontend created-hedgerow-details.test.js covers the same rules on made-up
  // reference data. Only the saves change a project, so each gets its own copy;
  // every other test reuses the read-only created-linear project.
  test.describe(
    'Created hedgerow habitats — editing',
    { tag: ['@regression', LEGACY_ONLY] },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // AC2. Sole real-data witness for an import-incomplete Created hedgerow
      // on the form. The hedgerow list's 0.00 is also witnessed by
      // upload-post-intervention.spec.js (conflicting timing, HG001).
      test('an incomplete Created hedgerow shows its saved values, default options and zero units', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage
      }) => {
        const { id } = await getCreatedLinearProjectCopy(
          browser,
          'created-hedgerow-partly-blank',
          CREATED_HEDGEROW_PARTLY_BLANK_PI_FILE
        )
        expect(
          await hedgerowRowByRef(page, id, CREATED_LINEAR_HEDGEROW_REF)
        ).toMatchObject({ Units: '0.00' })

        await openCreatedHedgerow(page, id)
        const details = postInterventionHabitatDetailsPage
        await expect(details.habitatReferenceInput).toHaveValue(
          CREATED_LINEAR_HEDGEROW_REF
        )
        await expectCreatedAreaSelections(details, {
          type: CREATED_HEDGEROW_SELECTIONS.type,
          significance: '',
          condition: '',
          advance: '',
          delay: ''
        })
        await expectCreatedAreaValues(details, {
          ...CREATED_HEDGEROW_VALUES,
          standardTime: '',
          finalTime: ''
        })
        await expect(details.standardTimeToTargetKey).toBeVisible()
        await expect(details.finalTimeToTargetMultiplierKey).toBeVisible()
        await expect(details.habitatUnitsValue).toHaveText('0.00')
        await expect(details.saveButton).toBeVisible()
        await expect(details.uploadFileButton).toBeVisible()
      })

      // AC4 and AC5. Habitat type drives the type-only values, leaves out a
      // type's "Not Possible" conditions, and clearing it blanks them all.
      test('choosing a habitat type resets the target condition and shows its values, and clearing it blanks them', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage
      }) => {
        const shared = await openSharedCreatedHedgerow(browser, page)
        const details = postInterventionHabitatDetailsPage

        await details.habitatTypeSelect.selectOption('Native hedgerow')
        await expectCreatedAreaSelections(details, {
          ...CREATED_HEDGEROW_SELECTIONS,
          type: 'Native hedgerow',
          condition: ''
        })
        await expect(
          details.targetConditionSelect.getByRole('option')
        ).toHaveText(HEDGEROW_CREATION_CONDITIONS)
        await expectCreatedAreaValues(details, {
          distinctiveness: 'Low (2)',
          standardTime: '',
          difficulty: 'Low',
          finalTime: '',
          applied: '1'
        })

        await details.habitatTypeSelect.selectOption(
          'Non-native and ornamental hedgerow'
        )
        await expect(
          details.targetConditionSelect.getByRole('option')
        ).toHaveText(['Choose target condition', 'Poor (1)'])
        await expect(details.createdFormValue('distinctiveness')).toHaveText(
          'V.Low (1)'
        )

        await details.habitatTypeSelect.selectOption({
          label: 'Choose habitat type'
        })
        await expect(
          details.targetConditionSelect.getByRole('option')
        ).toHaveText(['Choose target condition'])
        await expectCreatedAreaValues(details, {
          distinctiveness: '',
          standardTime: '',
          difficulty: '',
          finalTime: '',
          applied: ''
        })
        await expect(details.habitatUnitsValue).toHaveText(
          shared.createdLinearHedgerowUnits
        )
      })

      // AC6. Target condition drives both time-to-target rows only.
      test('choosing and clearing the target condition updates only the time to target', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage
      }) => {
        const shared = await openSharedCreatedHedgerow(browser, page)
        const details = postInterventionHabitatDetailsPage

        await details.targetConditionSelect.selectOption('Moderate')
        await expectCreatedAreaValues(details, {
          ...CREATED_HEDGEROW_VALUES,
          standardTime: 'Moderate - 10 years',
          finalTime: '10 years (0.7002822742)'
        })

        await details.targetConditionSelect.selectOption({
          label: 'Choose target condition'
        })
        await expectCreatedAreaValues(details, {
          ...CREATED_HEDGEROW_VALUES,
          standardTime: '',
          finalTime: ''
        })
        await expectCreatedAreaSelections(details, {
          ...CREATED_HEDGEROW_SELECTIONS,
          condition: ''
        })
        await expect(details.habitatUnitsValue).toHaveText(
          shared.createdLinearHedgerowUnits
        )
      })

      // AC8. Final time is standard time + delay - advance, floored at 0,
      // and blank when both are above zero or either is cleared.
      test('advance and delay recalculate the final time to target', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage
      }) => {
        const shared = await openSharedCreatedHedgerow(browser, page)
        const details = postInterventionHabitatDetailsPage
        const finalTime = details.createdFormValue('finalTime')

        await details.delayYearsSelect.selectOption('3')
        await expect(finalTime).toHaveText('23 years (0.4406849377)')
        await details.advanceYearsSelect.selectOption('2')
        await expect(finalTime).toHaveText('')
        await expect(details.errorSummary).toBeHidden()

        await details.delayYearsSelect.selectOption('0')
        await details.advanceYearsSelect.selectOption('5')
        await expect(finalTime).toHaveText('15 years (0.5860163055)')
        await details.advanceYearsSelect.selectOption('30')
        await expect(finalTime).toHaveText('0 years (1)')

        await details.advanceYearsSelect.selectOption('0')
        await details.delayYearsSelect.selectOption('30+')
        await expect(finalTime).toHaveText('30+ years (0.3197967361)')
        await details.advanceYearsSelect.selectOption({
          label: 'Choose advance'
        })
        await expectCreatedAreaValues(details, {
          ...CREATED_HEDGEROW_VALUES,
          finalTime: ''
        })
        await expect(details.habitatUnitsValue).toHaveText(
          shared.createdLinearHedgerowUnits
        )
      })

      // AC9 Scenario A. Backend integration-tests/habitats.test.js ("BMD-1049
      // Created hedgerow editing") covers the stored result; this proves the
      // list and the hedgerow tile show it.
      test('saving a complete edit recalculates the row, the units and the total', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage
      }) => {
        const { id } = await getCreatedLinearProjectCopy(
          browser,
          'created-hedgerow-save-complete'
        )
        const editedRef = `${CREATED_LINEAR_HEDGEROW_REF}-new`
        await openPiTabFor(page, id, 'hedgerow', CREATED_LINEAR_HEDGEROW_REF)
        const totalBefore = await hedgerowPostInterventionUnits(page)
        await openCreatedHedgerow(page, id)
        const details = postInterventionHabitatDetailsPage

        await details.habitatReferenceInput.fill(editedRef)
        await details.habitatTypeSelect.selectOption(
          'Species-rich native hedgerow'
        )
        await details.strategicSignificanceSelect.selectOption('Low')
        await details.targetConditionSelect.selectOption('Moderate')
        await details.delayYearsSelect.selectOption('2')
        await details.saveButton.click()

        await expectOnPiPage(page, id, 'hedgerow')
        // 0.1751389 km x 4 x 2 x 1 x 0.7792758067 x 1 = 1.0919
        const totalAfter = await hedgerowPostInterventionUnits(page)
        expect(
          Math.abs(
            totalAfter -
              (totalBefore -
                CREATED_HEDGEROW_EXACT_UNITS +
                CREATED_HEDGEROW_EDITED_UNITS)
          )
        ).toBeLessThan(TILE_ROUNDING)
        expect(await hedgerowRowByRef(page, id, editedRef)).toMatchObject({
          Units: '1.09',
          'Habitat type': 'Species-rich native hedgerow',
          Distinctiveness: 'Medium (4)',
          'Strategic significance': 'Low (1)',
          'Target condition': 'Moderate (2)',
          Delay: '2 years',
          'Final time to target': '7 years (0.7792758067)'
        })

        await openCreatedHedgerow(page, id, editedRef)
        await expect(details.habitatReferenceInput).toHaveValue(editedRef)
        await expectCreatedAreaSelections(details, {
          type: 'Species-rich native hedgerow',
          significance: 'Low',
          condition: 'Moderate',
          advance: '0',
          delay: '2'
        })
        await expect(details.habitatUnitsValue).toHaveText('1.09')
      })

      // AC9 Scenario B, as the page shows it. The AC says zero is saved, but
      // the backend stores units: null for an incomplete hedgerow edit
      // (created-hedgerow-edit.test.js asserts it), and the list then blanks
      // Distinctiveness and Strategic significance; both await a PO ruling, so
      // only the 0.00 and the total are asserted.
      //
      // BMD-1102: the row's Status tag follows the save, Complete to
      // Incomplete. Backend post-intervention-persistence.test.js:140 checks
      // the stored status after a save; this is the only test that shows the
      // grid re-reads it. Without it, a grid that kept the upload-time status
      // would go unnoticed.
      test('saving with the target condition cleared shows zero units and leaves the hedgerow out of the total', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage
      }) => {
        const { id } = await getCreatedLinearProjectCopy(
          browser,
          'created-hedgerow-save-incomplete'
        )
        expect(
          await hedgerowRowByRef(page, id, CREATED_LINEAR_HEDGEROW_REF)
        ).toMatchObject({ Status: STATUS_COMPLETE })
        const totalBefore = await hedgerowPostInterventionUnits(page)
        await openCreatedHedgerow(page, id)
        const details = postInterventionHabitatDetailsPage

        await details.targetConditionSelect.selectOption({
          label: 'Choose target condition'
        })
        await details.saveButton.click()

        await expectOnPiPage(page, id, 'hedgerow')
        const totalAfter = await hedgerowPostInterventionUnits(page)
        expect(
          Math.abs(totalAfter - (totalBefore - CREATED_HEDGEROW_EXACT_UNITS))
        ).toBeLessThan(TILE_ROUNDING)
        expect(
          await hedgerowRowByRef(page, id, CREATED_LINEAR_HEDGEROW_REF)
        ).toMatchObject({
          Status: STATUS_INCOMPLETE,
          Units: '0.00',
          'Target condition': ''
        })

        await openCreatedHedgerow(page, id)
        await expectCreatedAreaSelections(details, {
          ...CREATED_HEDGEROW_SELECTIONS,
          condition: ''
        })
        await expect(details.habitatUnitsValue).toHaveText('0.00')
      })

      // AC10, with AC3: a reference change alters nothing else on the page.
      test('Cancel discards the changes and returns to the hedgerow page', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage
      }) => {
        const shared = await getCreatedLinearProject(browser)
        await openPiTabFor(
          page,
          shared.id,
          'hedgerow',
          CREATED_LINEAR_HEDGEROW_REF
        )
        const totalBefore = await hedgerowPostInterventionUnits(page)
        await openCreatedHedgerow(page, shared.id)
        const details = postInterventionHabitatDetailsPage

        await details.habitatReferenceInput.fill('Not saved')
        await expectCreatedAreaSelections(details, CREATED_HEDGEROW_SELECTIONS)
        await expectCreatedAreaValues(details, CREATED_HEDGEROW_VALUES)
        await details.habitatTypeSelect.selectOption('Line of trees')
        await details.strategicSignificanceSelect.selectOption('Low')
        await details.delayYearsSelect.selectOption('4')

        await details.cancelLink.click()

        await expectOnPiPage(page, shared.id, 'hedgerow')
        expect(await hedgerowPostInterventionUnits(page)).toBe(totalBefore)
        expect(
          await hedgerowRowByRef(page, shared.id, CREATED_LINEAR_HEDGEROW_REF)
        ).toMatchObject({
          Units: shared.createdLinearHedgerowUnits,
          'Habitat type': CREATED_HEDGEROW_SELECTIONS.type
        })
        await openCreatedHedgerow(page, shared.id)
        await expect(details.habitatReferenceInput).toHaveValue(
          CREATED_LINEAR_HEDGEROW_REF
        )
        await expectCreatedAreaSelections(details, CREATED_HEDGEROW_SELECTIONS)
      })

      // AC11. Frontend controller-created-hedgerow.test.js covers both rules
      // against a mocked backend. This proves both errors render together, as
      // UCD worded them, and that nothing is saved.
      test('a save breaking both rules shows one error per rule, keeps the input and saves nothing', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage
      }) => {
        const shared = await openSharedCreatedHedgerow(browser, page)
        const details = postInterventionHabitatDetailsPage
        const entered = {
          type: 'Native hedgerow',
          significance: 'Low',
          condition: 'Poor',
          advance: '2',
          delay: '3'
        }
        await details.habitatReferenceInput.fill('')
        await details.habitatTypeSelect.selectOption(entered.type)
        await details.strategicSignificanceSelect.selectOption(
          entered.significance
        )
        await details.targetConditionSelect.selectOption(entered.condition)
        await details.advanceYearsSelect.selectOption(entered.advance)
        await details.delayYearsSelect.selectOption(entered.delay)

        await details.saveButton.click()

        await expect(details.errorSummary.getByRole('link')).toHaveCount(2)
        await expect(
          details.errorSummaryLink(INVALID_REF_SUMMARY)
        ).toHaveAttribute('href', '#ref')
        await expect(
          details.errorSummaryLink(TIMING_CONFLICT_SUMMARY)
        ).toHaveAttribute('href', '#advanceYears')
        await expect(details.inlineError(INVALID_REF_INLINE)).toBeVisible()
        await expect(details.inlineError(TIMING_CONFLICT_INLINE)).toBeVisible()
        await expect(details.habitatReferenceInput).toHaveValue('')
        await expectCreatedAreaSelections(details, entered)

        await openCreatedHedgerow(page, shared.id)
        await expectCreatedAreaSelections(details, CREATED_HEDGEROW_SELECTIONS)
      })

      // AC11, duplicate references are permitted. Sole witness: no backend or
      // frontend test saves a post-intervention hedgerow under a reference
      // another feature carries, while the baseline edit refuses one
      // (HABITAT_REF_IN_USE). Do not delete without adding a duplicate-ref
      // save to backend src/routes/created-hedgerow-edit.test.js first.
      test('a reference another hedgerow already carries is saved', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage
      }) => {
        const { id } = await getCreatedLinearProjectCopy(
          browser,
          'created-hedgerow-duplicate-ref'
        )
        await openCreatedHedgerow(page, id)
        const details = postInterventionHabitatDetailsPage

        await details.habitatReferenceInput.fill(OTHER_CREATED_HEDGEROW_REF)
        await details.saveButton.click()

        await expectOnPiPage(page, id, 'hedgerow')
        const { unitPage, label } = await openPiTabFor(
          page,
          id,
          'hedgerow',
          OTHER_CREATED_HEDGEROW_REF
        )
        await expect(
          unitPage.refLink(label, OTHER_CREATED_HEDGEROW_REF)
        ).toHaveCount(2)
        await expect(
          unitPage.refLink(label, CREATED_LINEAR_HEDGEROW_REF)
        ).toHaveCount(0)
      })

      // AC12.
      test('Upload file leaves unsaved changes behind without a prompt', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage,
        uploadFilePage
      }) => {
        const shared = await openSharedCreatedHedgerow(browser, page)
        const details = postInterventionHabitatDetailsPage
        let dialogs = 0
        page.on('dialog', async (dialog) => {
          dialogs += 1
          await dialog.dismiss()
        })
        await details.habitatReferenceInput.fill('Not saved')
        await details.strategicSignificanceSelect.selectOption('Low')

        await details.uploadFileButton.click()

        await expect(page).toHaveURL(
          new RegExp(`/projects/${shared.id}/upload-file`)
        )
        await expect(uploadFilePage.heading).toBeVisible()
        expect(dialogs).toBe(0)
        expect(
          await hedgerowRowByRef(page, shared.id, CREATED_LINEAR_HEDGEROW_REF)
        ).toMatchObject({
          Units: shared.createdLinearHedgerowUnits,
          'Strategic significance': 'High (1.15)'
        })
      })
    }
  )

  // ─── Retained watercourse — reference form (BMD-724, BMD-1180) ─────────────

  test.describe(
    'Post-intervention habitat details — retained watercourse display',
    { tag: LEGACY_ONLY },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // BMD-1180: "Habitat <ref>" on every retained type (PO ruling 2026-11-03,
      // frontend PR#482), though the baseline watercourse page reads
      // "Watercourse <ref>".
      test(
        'retained watercourse heading is "Habitat" followed by its reference',
        { tag: '@regression' },
        async ({ browser, postInterventionHabitatDetailsPage, page }) => {
          const shared = await getWatercoursesProject(browser)
          await postInterventionHabitatDetailsPage.open(
            shared.id,
            shared.retainedWatercourse
          )

          await expect(
            page.getByRole('heading', {
              name: `Habitat ${RETAINED_WATERCOURSE_REF}`,
              exact: true
            })
          ).toBeVisible()
        }
      )

      test(
        'retained watercourse renders both encroachment rows read-only, with only its reference editable',
        { tag: '@smoke' },
        async ({ browser, postInterventionHabitatDetailsPage, page }) => {
          const shared = await getWatercoursesProject(browser)
          await postInterventionHabitatDetailsPage.open(
            shared.id,
            shared.retainedWatercourse
          )

          const detailsPage = postInterventionHabitatDetailsPage
          // BMD-724 (PR#192) moved this page to the stacked sections layout: the
          // parcel ref is in the H1, and the size label is "Size (kilometres)".
          await expect(detailsPage.viewOnlyHeading).toBeVisible()
          await expect(detailsPage.interventionKey).toBeVisible()
          await expect(detailsPage.sizeKilometresKey).toBeVisible()
          await expect(detailsPage.lengthKey).toBeHidden()
          await expect(detailsPage.watercourseEncroachmentKey).toBeVisible()
          await expect(detailsPage.riparianEncroachmentKey).toBeVisible()
          await expect(
            detailsPage.stackedStrategicSignificanceKey
          ).toBeVisible()
          await expect(page.getByText('Ditches', { exact: true })).toBeVisible()
          // Encroachment values come from the baseline side and render as
          // "Value (multiplier)"; the multiplier is engine data, so assert the
          // value prefix. WC1: "No Encroachment" / "No Encroachment/No
          // Encroachment" (fixture values). getByText regexes match raw,
          // un-normalised text, so allow surrounding whitespace; the anchors
          // keep the two rows distinct (the riparian value contains the
          // watercourse value as a substring).
          await expect(
            page.getByText(/^\s*No Encroachment( \(.+\))?\s*$/)
          ).toBeVisible()
          await expect(
            page.getByText(/^\s*No Encroachment\/No Encroachment( \(.+\))?\s*$/)
          ).toBeVisible()
          // BMD-1180: the reference is the only editable value, so no dropdowns
          // (including the watercourse-only encroachment selects).
          await detailsPage.assertRetainedRefForm({
            ref: RETAINED_WATERCOURSE_REF
          })
          await expect(detailsPage.watercourseEncroachmentSelect).toBeHidden()
          await expect(detailsPage.riparianEncroachmentSelect).toBeHidden()
          // Baseline WC1 shares the parcel ref, so the link renders.
          await expect(detailsPage.viewBaselineLink).toBeVisible()

          // The back-link witness for every watercourse page (BMD-724, BMD-735
          // and BMD-739 AC2): the controller sets the back href from the feature
          // type alone, and all three watercourse pages share one layout.
          await detailsPage.backLink.click()
          await expectOnPiPage(page, shared.id, 'watercourse')
        }
      )

      test(
        'retained watercourse shows its saved values with multiplier formatting',
        { tag: '@regression' },
        async ({ browser, postInterventionHabitatDetailsPage, page }) => {
          const shared = await getWatercoursesProject(browser)
          // Arrive the way the user does (BMD-724 AC1): select the
          // Watercourses tab and click the watercourse's ref link rather than
          // deep-linking.
          await openPiFeatureDetails(
            page,
            shared.id,
            'watercourse',
            RETAINED_WATERCOURSE_REF
          )
          await expect(page).toHaveURL(DETAILS_URL_PATTERN)

          await expect(postInterventionHabitatDetailsPage.caption).toHaveText(
            shared.name
          )
          await expect(
            postInterventionHabitatDetailsPage.habitatReferenceInput
          ).toHaveValue(RETAINED_WATERCOURSE_REF)
          // WC1: Ditches / Moderate / 90 m (fixture values); "Medium (n)" and
          // "Moderate (n)" are the engine's reference distinctiveness and
          // condition for that river type. The "Size (kilometres)" label carries
          // the unit, so the value renders bare with trailing zeros trimmed.
          await expect(page.getByText(RETAINED, { exact: true })).toBeVisible()
          await expect(
            postInterventionHabitatDetailsPage.stackedSizeValue
          ).toHaveText(/^\s*0\.09\s*$/)
          await expect(
            page.getByText(/^\s*Medium \(\d+(\.\d+)?\)\s*$/)
          ).toBeVisible()
          await expect(
            page.getByText(/^\s*Moderate \(\d+(\.\d+)?\)\s*$/)
          ).toBeVisible()
          await expect(
            postInterventionHabitatDetailsPage.strategicSignificanceValue
          ).toBeVisible()
          // "Habitat units delivered" matches the Units cell of the same
          // watercourse's grid row.
          await expect(
            postInterventionHabitatDetailsPage.habitatUnitsValue
          ).toHaveText(shared.retainedWatercourseUnits)
        }
      )

      test(
        '"View baseline details" links to the ref-matched baseline watercourse',
        { tag: '@regression' },
        async ({ browser, postInterventionHabitatDetailsPage, page }) => {
          const shared = await getWatercoursesProject(browser)
          await postInterventionHabitatDetailsPage.open(
            shared.id,
            shared.retainedWatercourse
          )

          await expect(
            postInterventionHabitatDetailsPage.viewBaselineLink
          ).toBeVisible()
          await postInterventionHabitatDetailsPage.viewBaselineLink.click()
          await expect(page).toHaveURL(BASELINE_DETAILS_URL_PATTERN)

          // The baseline and PI uploads assign independent featureIds, so the
          // link must resolve the baseline feature by parcel ref — a different
          // featureId from the PI feature the user came from.
          const baselineFeatureId = new URL(page.url()).searchParams.get(
            'featureId'
          )
          expect(baselineFeatureId).not.toBe(shared.retainedWatercourse)
          await expect(postInterventionHabitatDetailsPage.heading).toHaveText(
            `Watercourse ${RETAINED_WATERCOURSE_REF}`
          )
        }
      )

      // BMD-1180 AC5. Sole real-data witness for renaming a Retained
      // watercourse through this page: backend integration-tests/features.test.js
      // renames a retained area parcel and a tree, and the watercourse rename is
      // covered only by apply-retained-ref-edit.test.js on a fabricated project.
      // Do not delete without adding a watercourse PUT to that integration test
      // first.
      test(
        'saving a new reference on a retained watercourse returns to the watercourse page and leaves the units alone',
        { tag: '@regression' },
        async ({ browser, page, postInterventionHabitatDetailsPage }) => {
          const { id } = await getWatercoursesProjectCopy(
            browser,
            'retained-watercourse-rename'
          )
          const newRef = `${RETAINED_WATERCOURSE_REF}-NEW`

          await expectRetainedRename(page, postInterventionHabitatDetailsPage, {
            projectId: id,
            type: 'watercourse',
            ref: RETAINED_WATERCOURSE_REF,
            typed: newRef,
            newRef,
            rowByRef: watercourseRowByRef,
            tileUnits: watercoursePostInterventionUnits
          })
        }
      )
    }
  )

  // ─── Enhanced watercourse — values, navigation and baseline link (BMD-735) ──
  // The Enhanced watercourse page's *structure* is asserted in the
  // "non-retained watercourse habitats" block below, which reads
  // the mixed-retention fixture. That fixture cannot reach the rest of BMD-735's
  // ACs: its Enhanced watercourse (WC2) is Moderate→Moderate, so the
  // time-to-target section renders blank, and its baseline file carries only
  // WC1 — so WC2 has no ref-matching baseline feature and the "View baseline
  // details" link is correctly hidden, putting AC1's link and all of AC3 out of
  // reach. R007 in the "all unit and intervention types" pair is Enhanced,
  // improves Fairly Poor → Fairly Good, and exists in the baseline upload.

  test.describe(
    'Post-intervention habitat details — Enhanced watercourse display',
    { tag: LEGACY_ONLY },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test(
        'Enhanced watercourse shows its km length, proposed-side encroachments and section-2 values',
        { tag: '@regression' },
        async ({ browser, postInterventionHabitatDetailsPage, page }) => {
          const shared = await getAllTypesProject(browser)
          await postInterventionHabitatDetailsPage.open(
            shared.id,
            shared.enhancedUpliftWatercourse
          )

          const detailsPage = postInterventionHabitatDetailsPage
          // BMD-735's headline deviation from the area-habitat design: the size
          // row is "Length" and the value carries the km unit — asserting the
          // label alone would pass on an "expressed in hectares" regression.
          await expect(detailsPage.enhancedLengthKey).toBeVisible()
          await expect(detailsPage.stackedSizeValue).toHaveText(
            LENGTH_KM_PATTERN
          )

          // Encroachments are read from `proposed` on a Created/Enhanced
          // watercourse — the opposite of the retained page's baseline-first
          // read. R007 differs on both sides (watercourse Major → No
          // Encroachment; riparian No Encroachment/No Encroachment → Minor/No
          // Encroachment), so asserting the proposed values *and* the absence of
          // the baseline ones is what distinguishes the two sourcing rules.
          // getByText regexes match raw, un-normalised text, so allow
          // surrounding whitespace; the anchors keep the rows distinct, since
          // one encroachment value is a substring of the other.
          await expect(
            page.getByText(/^\s*No Encroachment( \(.+\))?\s*$/)
          ).toBeVisible()
          await expect(
            page.getByText(/^\s*Minor\/No Encroachment( \(.+\))?\s*$/)
          ).toBeVisible()
          await expect(page.getByText(/^\s*Major( \(.+\))?\s*$/)).toHaveCount(0)
          await expect(
            page.getByText(/^\s*No Encroachment\/No Encroachment( \(.+\))?\s*$/)
          ).toHaveCount(0)

          // The standard time-to-target value proves the section-2 values render
          // *and* pins the dynamic condition transition frontend PR#193
          // introduced: "<baseline condition> to <target condition> - N years".
          // A shape-only assertion would also pass on the old static "Baseline
          // condition to target condition" wording, so assert the exact
          // transition and exclude that stale text.
          await expect(detailsPage.standardTimeToTargetValue).toHaveText(
            ENHANCED_UPLIFT_WATERCOURSE_TIME
          )
          await expect(detailsPage.standardTimeToTargetValue).not.toContainText(
            STALE_TIME_TO_TARGET_TEXT
          )
          // "Habitat units delivered" matches the Units cell of the same
          // watercourse's grid row.
          await expect(detailsPage.habitatUnitsValue).toHaveText(
            shared.enhancedUpliftWatercourseUnits
          )
        }
      )
    }
  )

  // ─── Created / Enhanced watercourses (BMD-739, BMD-735, BMD-1050) ───────────
  // An Enhanced watercourse renders its own two-section read-only template
  // (pi-watercourse-details-enhanced, frontend PR#188). Its rows sit in an
  // order that differs from the retained page: Strategic significance comes
  // *above* the two encroachment rows, whose values are read from `proposed`
  // (the retained page reads them baseline-first). A Created watercourse has
  // rendered the shared Created edit form since BMD-1050 (frontend PR#444),
  // with a dropdown for each encroachment. Reached the way the user does:
  // click the Ref link in the watercourses post-intervention grid.

  test.describe(
    'non-retained watercourse habitats',
    { tag: ['@regression', LEGACY_ONLY] },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('an Enhanced watercourse renders the two-section read-only page', async ({
        browser,
        postInterventionHabitatDetailsPage,
        page
      }) => {
        const shared = await getWatercoursesProject(browser)
        await openPiFeatureDetails(
          page,
          shared.id,
          'watercourse',
          ENHANCED_WATERCOURSE_REF
        )
        await expect(page).toHaveURL(DETAILS_URL_PATTERN)

        const detailsPage = postInterventionHabitatDetailsPage
        await detailsPage.assertTwoSectionLayout({
          ref: ENHANCED_WATERCOURSE_REF,
          intervention: 'Enhanced'
        })
        // Page chrome (BMD-735 AC1): the back link and the project-name
        // caption sit outside the two sections, so assertTwoSectionLayout
        // does not reach them.
        await expect(detailsPage.backLink).toBeVisible()
        await expect(detailsPage.caption).toHaveText(shared.name)
        // Watercourse specifics: the size row is "Length" (unit on the
        // value), plus the two encroachment rows the hedgerow page lacks.
        // BMD-735 AC1 asks for the length "expressed in km", so assert the
        // km-suffixed value too — the label alone would survive a regression
        // that rendered hectares against it.
        await expect(detailsPage.enhancedLengthKey).toBeVisible()
        await expect(detailsPage.stackedSizeValue).toHaveText(LENGTH_KM_PATTERN)
        await expect(detailsPage.watercourseEncroachmentKey).toBeVisible()
        await expect(detailsPage.riparianEncroachmentKey).toBeVisible()
        await expect(detailsPage.broadHabitatKey).toBeHidden()
        await expect(detailsPage.watercourseEncroachmentSelect).toBeHidden()
        await expect(detailsPage.riparianEncroachmentSelect).toBeHidden()
      })

      test('a Created watercourse renders the Created edit form', async ({
        browser,
        postInterventionHabitatDetailsPage,
        page
      }) => {
        const shared = await getWatercoursesProject(browser)
        await openPiFeatureDetails(
          page,
          shared.id,
          'watercourse',
          CREATED_WATERCOURSE_REF
        )
        await expect(page).toHaveURL(DETAILS_URL_PATTERN)

        const detailsPage = postInterventionHabitatDetailsPage
        await detailsPage.assertCreatedWatercourseEditForm({
          ref: CREATED_WATERCOURSE_REF
        })
        await expect(detailsPage.backLink).toBeVisible()
        await expect(detailsPage.caption).toHaveText(shared.name)
        // BMD-739 AC1's length "expressed in km".
        await expect(detailsPage.createdLengthValue).toHaveText(
          LENGTH_KM_PATTERN
        )
        // BMD-1050 AC1: each saved value, and the option lists from the real
        // /reference/watercourse-creation. The encroachments are two separate
        // lists, each with its own default.
        await expectCreatedAreaSelections(
          detailsPage,
          CREATED_WATERCOURSE_SELECTIONS
        )
        await expectCreatedAreaValues(detailsPage, CREATED_WATERCOURSE_VALUES)
        await expect(
          detailsPage.habitatTypeSelect.getByRole('option')
        ).toHaveText(WATERCOURSE_CREATION_TYPES)
        await expect(
          detailsPage.targetConditionSelect.getByRole('option')
        ).toHaveText(AREA_CREATION_CONDITIONS)
        await expect(
          detailsPage.strategicSignificanceSelect.getByRole('option')
        ).toHaveText([
          'Choose strategic significance',
          'High (1.15)',
          'Low (1)'
        ])
        await expect(
          detailsPage.watercourseEncroachmentSelect.getByRole('option')
        ).toHaveText(WATERCOURSE_ENCROACHMENTS)
        await expect(
          detailsPage.riparianEncroachmentSelect.getByRole('option')
        ).toHaveText(RIPARIAN_ENCROACHMENTS)
        await expect(
          detailsPage.advanceYearsSelect.getByRole('option')
        ).toHaveText(['Choose advance', ...TIMING_YEARS])
        await expect(
          detailsPage.delayYearsSelect.getByRole('option')
        ).toHaveText(['Choose delay', ...TIMING_YEARS])
      })

      // BMD-739 AC1 asks for labels *and* values. The two tests above pin the
      // labels for both refs; the section-2 values can only be asserted on the
      // Created WC3, since the Enhanced WC2 is Moderate→Moderate and renders a
      // blank time-to-target (the Enhanced watercourse's values are covered on
      // R007 in the BMD-735 describe above).
      //
      // WC3 is Created *with* a real baseline condition, so this test covers the
      // transition branch only. The absent-baseline branch the BMD-739 re-work
      // changed is covered on R003 in the test below.
      test('a Created watercourse shows its section-2 values and units delivered', async ({
        browser,
        postInterventionHabitatDetailsPage,
        page
      }) => {
        const shared = await getWatercoursesProject(browser)
        await openPiFeatureDetails(
          page,
          shared.id,
          'watercourse',
          CREATED_WATERCOURSE_REF
        )

        const detailsPage = postInterventionHabitatDetailsPage
        // The standard time-to-target value proves section 2 resolves its data
        // *and* pins the dynamic condition transition frontend PR#193
        // introduced ("<baseline condition> to <target condition> - N years")
        // against the static wording it replaced.
        await expect(detailsPage.standardTimeToTargetValue).toHaveText(
          CREATED_MODERATE_TIME
        )
        await expect(detailsPage.standardTimeToTargetValue).not.toContainText(
          STALE_TIME_TO_TARGET_TEXT
        )
        // "Habitat units delivered" renders to 2 decimal places and matches
        // the Units cell of the same watercourse's grid row.
        await expect(detailsPage.habitatUnitsValue).toHaveText(
          UNITS_TWO_DP_PATTERN
        )
        await expect(detailsPage.habitatUnitsValue).toHaveText(
          shared.createdWatercourseUnits
        )
      })

      // BMD-739 AC1, on a watercourse that is created in the sense the ticket's
      // preconditions mean it: Retention Category "Created" with no usable
      // baseline condition. The WC3 test above pins the labels and the
      // transition branch, but cannot pin the values that depend on there being
      // no baseline side — which is precisely what the re-work changed.
      test('a Created watercourse with no baseline condition shows its section-2 values and units delivered', async ({
        browser,
        postInterventionHabitatDetailsPage,
        page
      }) => {
        const shared = await getCreatedLinearProject(browser)
        await openPiFeatureDetails(
          page,
          shared.id,
          'watercourse',
          CREATED_LINEAR_WATERCOURSE_REF
        )
        await expect(page).toHaveURL(DETAILS_URL_PATTERN)

        const detailsPage = postInterventionHabitatDetailsPage
        // R003's baseline condition is the GeoPackage sentinel "N/A", which
        // PR#206 made count as absent — so the row drops the transition and
        // shows the target alone (PR#211). createdTimeToTargetValue cannot
        // match a value carrying " to ", so this catches both halves of the
        // regression BMD-739 was re-worked for: a blank row leaves the locator
        // unresolved, and so does a reappearing transition prefix. It also
        // proves the sentinel itself never reaches the page.
        await detailsPage.assertCreatedWatercourseEditForm({
          ref: CREATED_LINEAR_WATERCOURSE_REF
        })
        await detailsPage.assertCreatedAbsentBaselineValues({
          projectName: shared.name,
          timeToTarget: CREATED_LINEAR_WATERCOURSE_TIME_TO_TARGET,
          units: shared.createdLinearWatercourseUnits
        })
        await expect(detailsPage.createdLengthValue).toHaveText(
          LENGTH_KM_PATTERN
        )
        // No "View baseline details" assertion here, unlike the Created area
        // and hedgerow tests. The baseline half of this pair carries R003, so a
        // ref match exists and the link *does* render — Created watercourses do
        // not suppress it the way Created hedgerows do (flow doc Step 8). The
        // product decision on whether that is correct is still open, so
        // asserting either way would cement it.
      })
    }
  )

  // BMD-1050 AC2-AC14 on WC3. The previews run in the browser against the real
  // /reference/watercourse-creation; frontend created-watercourse-details.test.js
  // covers the same rules on made-up reference data. Only the saves change a
  // project, so each gets its own copy; every other test reuses the read-only
  // watercourses project. AC2 without a habitat type is left to that frontend
  // test, as for Created hedgerows.
  test.describe(
    'Created watercourse habitats — editing',
    { tag: ['@regression', LEGACY_ONLY] },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // AC2. Sole real-data witness for an import-incomplete Created
      // watercourse on the form and in the list.
      test('an incomplete Created watercourse shows its saved values, default options and zero units', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage
      }) => {
        const { id } = await getWatercoursesProjectCopy(
          browser,
          'created-watercourse-partly-blank',
          CREATED_WATERCOURSE_PARTLY_BLANK_PI_FILE
        )
        expect(
          await watercourseRowByRef(page, id, CREATED_WATERCOURSE_REF)
        ).toMatchObject({ Status: STATUS_INCOMPLETE, Units: '0.00' })

        await openCreatedWatercourse(page, id)
        const details = postInterventionHabitatDetailsPage
        await expect(details.habitatReferenceInput).toHaveValue(
          CREATED_WATERCOURSE_REF
        )
        await expectCreatedAreaSelections(details, {
          type: CREATED_WATERCOURSE_SELECTIONS.type,
          significance: '',
          condition: '',
          watercourse: '',
          riparian: '',
          advance: '',
          delay: ''
        })
        await expectCreatedAreaValues(details, {
          ...CREATED_WATERCOURSE_VALUES,
          standardTime: '',
          finalTime: ''
        })
        await expect(details.standardTimeToTargetKey).toBeVisible()
        await expect(details.finalTimeToTargetMultiplierKey).toBeVisible()
        await expect(details.habitatUnitsValue).toHaveText('0.00')
        await expect(details.saveButton).toBeVisible()
        await expect(details.uploadFileButton).toBeVisible()
      })

      // AC4 and AC5. A Culvert can only be created to Poor, so its condition
      // list proves the type's "Not Possible" conditions are left out.
      test('choosing a habitat type resets the target condition and shows its values, and clearing it blanks them', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage
      }) => {
        const shared = await openSharedCreatedWatercourse(browser, page)
        const details = postInterventionHabitatDetailsPage

        await details.habitatTypeSelect.selectOption('Culvert')
        await expectCreatedAreaSelections(details, {
          ...CREATED_WATERCOURSE_SELECTIONS,
          type: 'Culvert',
          condition: ''
        })
        await expect(
          details.targetConditionSelect.getByRole('option')
        ).toHaveText(['Choose target condition', 'Poor (1)'])
        await expectCreatedAreaValues(details, {
          distinctiveness: 'Low (2)',
          standardTime: '',
          difficulty: 'Medium',
          finalTime: '',
          applied: '0.67'
        })

        await details.habitatTypeSelect.selectOption({
          label: 'Choose habitat type'
        })
        await expect(
          details.targetConditionSelect.getByRole('option')
        ).toHaveText(['Choose target condition'])
        await expectCreatedAreaValues(details, {
          distinctiveness: '',
          standardTime: '',
          difficulty: '',
          finalTime: '',
          applied: ''
        })
        await expect(details.habitatUnitsValue).toHaveText(
          shared.createdWatercourseUnits
        )
      })

      // AC6. Target condition drives both time-to-target rows only. WC3 has a
      // baseline condition, so the standard time names the transition.
      test('choosing and clearing the target condition updates only the time to target', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage
      }) => {
        const shared = await openSharedCreatedWatercourse(browser, page)
        const details = postInterventionHabitatDetailsPage

        await details.targetConditionSelect.selectOption('Good')
        await expectCreatedAreaValues(details, {
          ...CREATED_WATERCOURSE_VALUES,
          standardTime: 'Moderate to Good - 10 years',
          finalTime: '10 years (0.7002822742)'
        })

        await details.targetConditionSelect.selectOption({
          label: 'Choose target condition'
        })
        await expectCreatedAreaValues(details, {
          ...CREATED_WATERCOURSE_VALUES,
          standardTime: '',
          finalTime: ''
        })
        await expectCreatedAreaSelections(details, {
          ...CREATED_WATERCOURSE_SELECTIONS,
          condition: ''
        })
        await expect(details.habitatUnitsValue).toHaveText(
          shared.createdWatercourseUnits
        )
      })

      // AC7-AC9. The two encroachments are independent: changing or clearing
      // one leaves the other, and neither (nor significance) changes a
      // derived value.
      test('strategic significance and each encroachment change alone, with no derived value changing', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage
      }) => {
        const shared = await openSharedCreatedWatercourse(browser, page)
        const details = postInterventionHabitatDetailsPage

        await details.strategicSignificanceSelect.selectOption('Low')
        await details.watercourseEncroachmentSelect.selectOption('Major')
        await expectCreatedAreaSelections(details, {
          ...CREATED_WATERCOURSE_SELECTIONS,
          significance: 'Low',
          watercourse: 'Major'
        })
        await details.riparianEncroachmentSelect.selectOption('Major/Minor')
        await expect(details.watercourseEncroachmentSelect).toHaveValue('Major')

        await details.watercourseEncroachmentSelect.selectOption({
          label: 'Choose watercourse encroachment'
        })
        await expect(details.riparianEncroachmentSelect).toHaveValue(
          'Major/Minor'
        )
        await details.riparianEncroachmentSelect.selectOption({
          label: 'Choose riparian encroachment'
        })
        await details.strategicSignificanceSelect.selectOption({
          label: 'Choose strategic significance'
        })
        await expectCreatedAreaSelections(details, {
          ...CREATED_WATERCOURSE_SELECTIONS,
          significance: '',
          watercourse: '',
          riparian: ''
        })
        await expectCreatedAreaValues(details, CREATED_WATERCOURSE_VALUES)
        await expect(details.habitatUnitsValue).toHaveText(
          shared.createdWatercourseUnits
        )
      })

      // AC10. Final time is standard time + delay - advance, floored at 0,
      // and blank when both are above zero or either is cleared.
      test('advance and delay recalculate the final time to target', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage
      }) => {
        const shared = await openSharedCreatedWatercourse(browser, page)
        const details = postInterventionHabitatDetailsPage
        const finalTime = details.createdFormValue('finalTime')

        await details.delayYearsSelect.selectOption('3')
        await expect(finalTime).toHaveText('8 years (0.7520011535)')
        await details.advanceYearsSelect.selectOption('2')
        await expect(finalTime).toHaveText('')
        await expect(details.errorSummary).toBeHidden()

        await details.delayYearsSelect.selectOption('0')
        await details.advanceYearsSelect.selectOption('30')
        await expect(finalTime).toHaveText('0 years (1)')

        await details.advanceYearsSelect.selectOption('0')
        await details.delayYearsSelect.selectOption('30+')
        await expect(finalTime).toHaveText('30+ years (0.3197967361)')
        await details.advanceYearsSelect.selectOption({
          label: 'Choose advance'
        })
        await expectCreatedAreaValues(details, {
          ...CREATED_WATERCOURSE_VALUES,
          finalTime: ''
        })
        await expect(details.habitatUnitsValue).toHaveText(
          shared.createdWatercourseUnits
        )
      })

      // AC11 Scenario A. Backend integration-tests/habitats.test.js ("BMD-1050
      // Created watercourse saves") covers the stored result; this proves the
      // list and the watercourse tile show it, both encroachment multipliers
      // included.
      // BMD-1153 AC4: the only journey save of a Created watercourse's
      // comment. The frontend's watercourse kind sets its own save path, so
      // the hedgerow save in baseline-habitat-details.spec.js does not cover
      // it. The exact units below also show the comment leaves them alone.
      test('saving a complete edit recalculates the row, the units and the total', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage
      }) => {
        const { id } = await getWatercoursesProjectCopy(
          browser,
          'created-watercourse-save-complete'
        )
        const editedRef = `${CREATED_WATERCOURSE_REF}-new`
        await openPiTabFor(page, id, 'watercourse', CREATED_WATERCOURSE_REF)
        const totalBefore = await watercoursePostInterventionUnits(page)
        await openCreatedWatercourse(page, id)
        const details = postInterventionHabitatDetailsPage

        await details.habitatReferenceInput.fill(editedRef)
        await details.strategicSignificanceSelect.selectOption('Low')
        await details.targetConditionSelect.selectOption('Good')
        await details.watercourseEncroachmentSelect.selectOption('Minor')
        await details.riparianEncroachmentSelect.selectOption('Minor/Minor')
        await details.delayYearsSelect.selectOption('2')
        await details.commentInput.fill(` ${CREATED_WATERCOURSE_COMMENT} `)
        await details.saveButton.click()

        await expectOnPiPage(page, id, 'watercourse')
        const totalAfter = await watercoursePostInterventionUnits(page)
        expect(
          Math.abs(
            totalAfter -
              (totalBefore -
                CREATED_WATERCOURSE_EXACT_UNITS +
                CREATED_WATERCOURSE_EDITED_UNITS)
          )
        ).toBeLessThan(TILE_ROUNDING)
        expect(await watercourseRowByRef(page, id, editedRef)).toMatchObject({
          Status: STATUS_COMPLETE,
          Units: '0.10',
          'Habitat type': 'Ditches',
          Distinctiveness: 'Medium (4)',
          'Strategic significance': 'Low (1)',
          'Target condition': 'Good (3)',
          'Watercourse encroachment': 'Minor (0.8)',
          'Riparian encroachment': 'Minor/Minor (0.95)',
          Delay: '2 years',
          'Final time to target': '12 years (0.6521203607)'
        })

        await openCreatedWatercourse(page, id, editedRef)
        await expect(details.habitatReferenceInput).toHaveValue(editedRef)
        await expectCreatedAreaSelections(details, {
          ...CREATED_WATERCOURSE_SELECTIONS,
          significance: 'Low',
          condition: 'Good',
          watercourse: 'Minor',
          riparian: 'Minor/Minor',
          delay: '2'
        })
        await expect(details.habitatUnitsValue).toHaveText('0.10')
        await expect(details.commentInput).toHaveValue(
          CREATED_WATERCOURSE_COMMENT
        )
      })

      // AC11 Scenario B. Backend created-watercourse-edit.test.js covers the
      // stored zero; frontend watercourses-post-intervention controller.test.js
      // covers the list's 0.00 on a mocked project. This is the only test that
      // shows the two meet. The save stores the derived values as null, as
      // Created areas do under the PO ruling of 2026-11-06, so the list's
      // Distinctiveness is looked up from the type and Standard difficulty is
      // blank; only the values the ruling asks for are asserted.
      test('saving with the riparian encroachment cleared shows zero units and leaves the watercourse out of the total', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage
      }) => {
        const { id } = await getWatercoursesProjectCopy(
          browser,
          'created-watercourse-save-incomplete'
        )
        expect(
          await watercourseRowByRef(page, id, CREATED_WATERCOURSE_REF)
        ).toMatchObject({ Status: STATUS_COMPLETE })
        const totalBefore = await watercoursePostInterventionUnits(page)
        await openCreatedWatercourse(page, id)
        const details = postInterventionHabitatDetailsPage

        await details.riparianEncroachmentSelect.selectOption({
          label: 'Choose riparian encroachment'
        })
        await details.saveButton.click()

        await expectOnPiPage(page, id, 'watercourse')
        const totalAfter = await watercoursePostInterventionUnits(page)
        expect(
          Math.abs(totalAfter - (totalBefore - CREATED_WATERCOURSE_EXACT_UNITS))
        ).toBeLessThan(TILE_ROUNDING)
        expect(
          await watercourseRowByRef(page, id, CREATED_WATERCOURSE_REF)
        ).toMatchObject({
          Status: STATUS_INCOMPLETE,
          Units: '0.00',
          Distinctiveness: 'Medium (4)',
          'Strategic significance': 'High (1.15)',
          'Watercourse encroachment': 'No Encroachment',
          'Riparian encroachment': ''
        })

        await openCreatedWatercourse(page, id)
        await expectCreatedAreaSelections(details, {
          ...CREATED_WATERCOURSE_SELECTIONS,
          riparian: ''
        })
        await expect(details.habitatUnitsValue).toHaveText('0.00')
      })

      // AC12, with AC3: a reference change alters nothing else on the page.
      test('Cancel discards the changes and returns to the watercourse page', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage
      }) => {
        const shared = await getWatercoursesProject(browser)
        await openPiTabFor(
          page,
          shared.id,
          'watercourse',
          CREATED_WATERCOURSE_REF
        )
        const totalBefore = await watercoursePostInterventionUnits(page)
        await openCreatedWatercourse(page, shared.id)
        const details = postInterventionHabitatDetailsPage

        await details.habitatReferenceInput.fill('Not saved')
        await expectCreatedAreaSelections(
          details,
          CREATED_WATERCOURSE_SELECTIONS
        )
        await expectCreatedAreaValues(details, CREATED_WATERCOURSE_VALUES)
        await details.habitatTypeSelect.selectOption('Canals')
        await details.strategicSignificanceSelect.selectOption('Low')
        await details.watercourseEncroachmentSelect.selectOption('Major')
        await details.delayYearsSelect.selectOption('4')

        await details.cancelLink.click()

        await expectOnPiPage(page, shared.id, 'watercourse')
        expect(await watercoursePostInterventionUnits(page)).toBe(totalBefore)
        expect(
          await watercourseRowByRef(page, shared.id, CREATED_WATERCOURSE_REF)
        ).toMatchObject({
          Units: shared.createdWatercourseUnits,
          'Habitat type': CREATED_WATERCOURSE_SELECTIONS.type
        })
        await openCreatedWatercourse(page, shared.id)
        await expect(details.habitatReferenceInput).toHaveValue(
          CREATED_WATERCOURSE_REF
        )
        await expectCreatedAreaSelections(
          details,
          CREATED_WATERCOURSE_SELECTIONS
        )
      })

      // AC13. Frontend controller-created-watercourse-edit.test.js covers both
      // rules against a mocked backend. This proves both errors render
      // together, both encroachments are kept, and nothing is saved.
      test('a save breaking both rules shows one error per rule, keeps the input and saves nothing', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage
      }) => {
        const shared = await openSharedCreatedWatercourse(browser, page)
        const details = postInterventionHabitatDetailsPage
        const entered = {
          type: 'Canals',
          significance: 'Low',
          condition: 'Poor',
          watercourse: 'Major',
          riparian: 'Moderate/Minor',
          advance: '2',
          delay: '3'
        }
        await details.habitatReferenceInput.fill('')
        await details.habitatTypeSelect.selectOption(entered.type)
        await details.strategicSignificanceSelect.selectOption(
          entered.significance
        )
        await details.targetConditionSelect.selectOption(entered.condition)
        await details.watercourseEncroachmentSelect.selectOption(
          entered.watercourse
        )
        await details.riparianEncroachmentSelect.selectOption(entered.riparian)
        await details.advanceYearsSelect.selectOption(entered.advance)
        await details.delayYearsSelect.selectOption(entered.delay)

        await details.saveButton.click()

        await expect(details.errorSummary.getByRole('link')).toHaveCount(2)
        await expect(
          details.errorSummaryLink(INVALID_REF_SUMMARY)
        ).toHaveAttribute('href', '#ref')
        await expect(
          details.errorSummaryLink(TIMING_CONFLICT_SUMMARY)
        ).toHaveAttribute('href', '#advanceYears')
        await expect(details.inlineError(INVALID_REF_INLINE)).toBeVisible()
        await expect(details.inlineError(TIMING_CONFLICT_INLINE)).toBeVisible()
        await expect(details.habitatReferenceInput).toHaveValue('')
        await expectCreatedAreaSelections(details, entered)

        await openCreatedWatercourse(page, shared.id)
        await expectCreatedAreaSelections(
          details,
          CREATED_WATERCOURSE_SELECTIONS
        )
      })

      // AC13, duplicate references are permitted. Sole witness: no backend or
      // frontend test saves a post-intervention watercourse under a reference
      // another feature carries, while the baseline edit refuses one
      // (HABITAT_REF_IN_USE). Do not delete without adding a duplicate-ref
      // save to backend src/routes/created-watercourse-edit.test.js first.
      test('a reference another watercourse already carries is saved', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage
      }) => {
        const { id } = await getWatercoursesProjectCopy(
          browser,
          'created-watercourse-duplicate-ref'
        )
        await openCreatedWatercourse(page, id)
        const details = postInterventionHabitatDetailsPage

        // WC1 is the Retained watercourse in the same file.
        await details.habitatReferenceInput.fill(RETAINED_WATERCOURSE_REF)
        await details.saveButton.click()

        await expectOnPiPage(page, id, 'watercourse')
        const unitPage = piPage(page, 'watercourse')
        await unitPage.tab(CREATED).click()
        await expect(
          unitPage.refLink(CREATED, RETAINED_WATERCOURSE_REF)
        ).toHaveCount(1)
        await expect(
          unitPage.refLink(CREATED, CREATED_WATERCOURSE_REF)
        ).toHaveCount(0)
        await unitPage.tab(RETAINED).click()
        await expect(
          unitPage.refLink(RETAINED, RETAINED_WATERCOURSE_REF)
        ).toHaveCount(1)
      })

      // AC14.
      test('Upload file leaves unsaved changes behind without a prompt', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage,
        uploadFilePage
      }) => {
        const shared = await openSharedCreatedWatercourse(browser, page)
        const details = postInterventionHabitatDetailsPage
        let dialogs = 0
        page.on('dialog', async (dialog) => {
          dialogs += 1
          await dialog.dismiss()
        })
        await details.habitatReferenceInput.fill('Not saved')
        await details.strategicSignificanceSelect.selectOption('Low')
        await details.watercourseEncroachmentSelect.selectOption('Major')

        await details.uploadFileButton.click()

        await expect(page).toHaveURL(
          new RegExp(`/projects/${shared.id}/upload-file`)
        )
        await expect(uploadFilePage.heading).toBeVisible()
        expect(dialogs).toBe(0)
        expect(
          await watercourseRowByRef(page, shared.id, CREATED_WATERCOURSE_REF)
        ).toMatchObject({
          Units: shared.createdWatercourseUnits,
          'Strategic significance': 'High (1.15)',
          'Watercourse encroachment': expect.stringMatching(/^No Encroachment/)
        })
      })
    }
  )

  // ─── Retained individual tree (BMD-1172) ────────────────────────────────────
  // Frontend PR#475 gave individual trees the area details page, with two tree
  // rows after Size. This replaced the unsupported-feature placeholder, which
  // now renders only for a feature type with no details page, and no upload
  // produces one. It is covered by the frontend controller tests alone.

  test.describe(
    'Post-intervention habitat details — retained individual tree',
    { tag: ['@regression', LEGACY_ONLY] },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // Sole journey witness for a tree's details page: frontend controller
      // tests mock the backend's tree feature, so nothing else proves the
      // backend sends a tree that the page renders with its size class and
      // count. Restored from the BMD-1043 placeholder test on 2026-11-16.
      test('a Retained individual tree renders the area details page with its tree rows', async ({
        browser,
        postInterventionHabitatDetailsPage,
        page
      }) => {
        const shared = await getTreesProject(browser)
        const { unitPage } = await openPiTabFor(page, shared.id, 'area', 'T001')
        const row = await unitPage.rowByRef(RETAINED, 'T001')
        await unitPage.refLink(RETAINED, 'T001').click()

        await expect(
          page.getByRole('heading', { name: 'Habitat T001', exact: true })
        ).toBeVisible()
        await expect(
          postInterventionHabitatDetailsPage.stackedFieldLabels
        ).toHaveText([
          'Intervention',
          'Size (hectares)',
          'Tree size',
          'Number of trees',
          'Broad habitat',
          'Habitat type',
          'Distinctiveness',
          'Condition',
          'Strategic significance',
          'Supporting information'
        ])
        // T001 is a small urban tree, counted once; the rest match its grid row.
        await expect(
          postInterventionHabitatDetailsPage.stackedValues
        ).toHaveText([
          RETAINED,
          /^\d+(\.\d+)?$/,
          'Small',
          '1',
          row['Broad habitat'],
          row['Habitat type'],
          row.Distinctiveness,
          row.Condition,
          row['Strategic significance'],
          'No data'
        ])
        // A post-intervention tree's page links to no baseline tree.
        await expect(
          postInterventionHabitatDetailsPage.viewBaselineLink
        ).toBeHidden()
        await expect(
          postInterventionHabitatDetailsPage.habitatUnitsValue
        ).toHaveText(row.Units)
        await postInterventionHabitatDetailsPage.assertRetainedRefForm({
          ref: 'T001'
        })
        await expect(
          postInterventionHabitatDetailsPage.unsupportedFeatureMessage
        ).toBeHidden()

        await postInterventionHabitatDetailsPage.backLink.click()
        await expectOnPiPage(page, shared.id, 'area')
      })
    }
  )

  // ─── Created individual tree — supporting information (BMD-1153) ────────────
  // T005 is the created-linear pair's only Created tree. A tree saves through
  // its own backend route (post-intervention-tree-edit.js) and frontend kind
  // (tree-edit-kinds.js), so the area, hedgerow and watercourse comment saves
  // do not cover it.

  test.describe(
    'Post-intervention habitat details — Created individual tree',
    { tag: ['@regression', LEGACY_ONLY] },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // Sole journey witness for a Created tree's comment. The backend
      // integration test (comment-import.test.js) saves it through the API,
      // and the frontend's controller-created-tree.test.js mocks the backend,
      // so neither shows the box on a real tree or the comment coming back.
      // Also the Created half of BMD-1184's "no baseline link on a tree page":
      // the baseline file has an N/A placeholder tree with the same ref, T005,
      // for a by-ref link to land on. The Retained and Enhanced halves are the
      // retained individual tree test and baseline-habitat-details.spec.js.
      test("saves a Created tree's comment trimmed, leaving its units alone", async ({
        browser,
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const comment = 'Standard oak planted with a guard and stake.'
        const { id } = await getCreatedLinearProjectCopy(
          browser,
          'created-tree-comment'
        )
        const rowBefore = await areaRowByRef(page, id, CREATED_TREE_REF)

        await openPiFeatureDetails(page, id, 'area', CREATED_TREE_REF)
        await expect(details.commentInput).toHaveValue('')
        await expect(details.commentHint).toHaveText(CREATED_COMMENT_HINT)
        await expect(details.viewBaselineLink).toHaveCount(0)
        await details.commentInput.fill(`  ${comment}  `)
        await details.saveButton.click()

        await expectOnPiPage(page, id, 'area')
        expect(await areaRowByRef(page, id, CREATED_TREE_REF)).toMatchObject({
          Status: rowBefore.Status,
          Units: rowBefore.Units
        })
        await openPiFeatureDetails(page, id, 'area', CREATED_TREE_REF)
        await expect(details.commentInput).toHaveValue(comment)
      })
    }
  )

  // ─── Save is not implemented for read-only features ─────────────────────────
  // Created and Enhanced edit forms and Retained reference forms post here.
  // The route answers 501 for every other feature, so a stale page or client
  // gets an explicit "not implemented" response rather than a save. The
  // handler checks a save against its form's own schema first (400 for a
  // malformed body), so the request must be aimed at a read-only feature to
  // reach that branch.
  //
  // BNG Service template only. Since BMD-1047 made an Enhanced watercourse
  // editable, only vertical area habitats are read-only, and only the BNG
  // Service template has them. A legacy project has no read-only feature.

  test.describe(
    'Post-intervention habitat details — save not implemented for read-only features',
    { tag: ['@regression', SERVICE_TEMPLATE_ONLY] },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('POST /post-intervention-habitat-details for an Enhanced vertical area habitat returns 501 Not Implemented', async ({
        browser,
        page
      }) => {
        const shared = await getRunAllUnitTypesPostInterventionProject(browser)
        const featureId = await featureIdByRef(
          page,
          shared.id,
          'area',
          SERVICE_TEMPLATE_ENHANCED_VERTICAL_REF
        )
        // No read-only page renders a form, so there is no crumb-carrying HTML
        // form to submit via a real browser action. Any response sets the
        // httpOnly `crumb` cookie (@hapi/crumb, restful: false); read it from
        // the context and echo it back in the payload the same way a real form
        // submission would.
        await page.goto('/')
        const crumbCookie = (await page.context().cookies()).find(
          (cookie) => cookie.name === 'crumb'
        )
        const response = await page.request.post(
          '/post-intervention-habitat-details',
          {
            data: {
              projectId: shared.id,
              featureId,
              ref: SERVICE_TEMPLATE_ENHANCED_VERTICAL_REF,
              crumb: crumbCookie.value
            }
          }
        )
        expect(response.status()).toBe(HTTP_NOT_IMPLEMENTED)
      })
    }
  )

  // BMD-1058 AC3. The PI file spells the ref ' Café–Ω H003' and the baseline
  // spells it 'Café–Ω H003'. The heading carries the PI ref as saved, so it
  // proves the trim. The "View baseline details" link proves the two halves
  // matched on the cleaned ref. The trim is covered by backend
  // extract-post-intervention.test.js:1188 against made-up features only.
  test.describe(
    'Post-intervention habitat details — habitat reference cleaning',
    { tag: ['@regression', LEGACY_ONLY] },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('saves a padded ref trimmed, and links it to its baseline', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage
      }) => {
        const { id } = await getLongPaddedRefsProject(browser)
        const name = gridRefName(LONG_PADDED_REFS.nonAscii)
        const { unitPage, label } = await openPiTabFor(page, id, 'area', name)
        await unitPage.refLink(label, name).click()

        expect(await postInterventionHabitatDetailsPage.rawHeadingText()).toBe(
          `Habitat ${LONG_PADDED_REFS.nonAscii}`
        )
        await expect(
          postInterventionHabitatDetailsPage.viewBaselineLink
        ).toBeVisible()
      })
    }
  )

  // ─── BNG Service template features (BMD-1088 AC7) ───────────────────────────

  test.describe(
    'Post-intervention habitat details — BNG Service template features',
    { tag: ['@regression', SERVICE_TEMPLATE_ONLY] },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.describe.configure({ timeout: SHARED_BUILD_TEST_TIMEOUT })

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getRunAllUnitTypesPostInterventionProject(browser)
      })

      test('"View baseline details" opens the baseline feature each one names as its parent', async ({
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        for (const {
          type,
          ref,
          parentHeading
        } of SERVICE_TEMPLATE_BASELINE_LINKS) {
          await openPiFeatureDetails(page, project.id, type, ref)
          await expect(piDetailsHeading(page, ref), ref).toBeVisible()

          await details.viewBaselineLink.click()
          await expect(page).toHaveURL(BASELINE_DETAILS_URL_PATTERN)
          await expect(
            page.getByRole('heading', { name: parentHeading, exact: true }),
            ref
          ).toBeVisible()
        }
      })

      test('a feature with no parent, and every tree, has no "View baseline details" link', async ({
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        for (const { type, ref } of SERVICE_TEMPLATE_UNLINKED) {
          await openPiFeatureDetails(page, project.id, type, ref)
          await expect(piDetailsHeading(page, ref), ref).toBeVisible()
          await expect(details.viewBaselineLink, ref).toBeHidden()
        }
      })

      test("a Retained feature shows its parent's comment as its supporting information", async ({
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        for (const {
          type,
          ref,
          comment
        } of SERVICE_TEMPLATE_RETAINED_COMMENTS) {
          await openPiFeatureDetails(page, project.id, type, ref)
          await expect(piDetailsHeading(page, ref), ref).toBeVisible()
          await expect(details.supportingInformationValue, ref).toHaveText(
            comment
          )
        }
      })
    }
  )

  // ─── BNG Service template edit forms (BMD-1088) ─────────────────────────────

  test.describe(
    'Post-intervention habitat details — BNG Service template edits',
    { tag: ['@regression', SERVICE_TEMPLATE_ONLY] },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.describe.configure({ timeout: SHARED_BUILD_TEST_TIMEOUT })

      // Its own copy of the default site: these tests save edits, which the
      // shared read-only project must not see. Each edits a different feature,
      // so they do not depend on one another and need no serial mode: a failed
      // test restarts the worker, whose beforeAll builds a fresh copy, so a
      // retry still finds the saved significance it starts from.
      let projectId
      test.beforeAll(async ({ browser }) => {
        ;({ id: projectId } = await buildPostInterventionOnlyProject(
          browser,
          DEFAULT_SITE
        ))
      })

      for (const edit of SERVICE_TEMPLATE_SIGNIFICANCE_EDITS) {
        test(`${edit.category} ${edit.feature} ${edit.ref} saved at ${edit.to} strategic significance recalculates its units, its row and the total`, async ({
          page,
          postInterventionHabitatDetailsPage: details
        }) => {
          await openPiTabFor(page, projectId, edit.type, edit.ref)
          const totalBefore = await piTileUnits(page, edit.type)

          await openPiFeatureDetails(page, projectId, edit.type, edit.ref)
          await expect(details.strategicSignificanceSelect).toHaveValue(
            edit.from
          )
          await details.strategicSignificanceSelect.selectOption(edit.to)
          await details.saveButton.click()

          await expectOnPiPage(page, projectId, edit.type)
          const totalAfter = await piTileUnits(page, edit.type)
          expect(
            Math.abs(totalAfter - (totalBefore - edit.before + edit.after))
          ).toBeLessThan(TILE_ROUNDING)

          const { unitPage, label } = await openPiTabFor(
            page,
            projectId,
            edit.type,
            edit.ref
          )
          expect(label).toBe(edit.category)
          expect(await unitPage.rowByRef(label, edit.ref)).toMatchObject({
            Status: STATUS_COMPLETE,
            Units: edit.after.toFixed(2),
            'Strategic significance': SIGNIFICANCE_DISPLAY[edit.to]
          })
        })
      }
    }
  )

  // ─── BNG Service template hedgerows and watercourses (BMD-1088) ─────────────
  // The legacy hedgerow and watercourse describes above, on BNG Service
  // template features. A feature that gets worse is Created, in its own type,
  // naming its parent; a Retained one is renamed alone. The read-only tests
  // share the default site (and trading-all-met for its Enhanced hedgerow);
  // the saves have their own copy below.

  test.describe(
    'Post-intervention habitat details — BNG Service template hedgerows',
    { tag: ['@regression', SERVICE_TEMPLATE_ONLY] },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.describe.configure({ timeout: SHARED_BUILD_TEST_TIMEOUT })

      test(
        'a Retained hedgerow is headed "Habitat" and its reference, with its saved values read-only and only its reference editable',
        { tag: '@smoke' },
        async ({
          browser,
          page,
          postInterventionHabitatDetailsPage: details
        }) => {
          const shared = await getServiceTemplateLinearProject(browser)
          const units = await unitsByRef(
            page,
            shared.id,
            'hedgerow',
            ST_RETAINED_HEDGEROW_REF
          )
          await openPiFeatureDetails(
            page,
            shared.id,
            'hedgerow',
            ST_RETAINED_HEDGEROW_REF
          )

          await expect(
            page.getByRole('heading', {
              name: `Habitat ${ST_RETAINED_HEDGEROW_REF}`,
              exact: true
            })
          ).toBeVisible()
          await expect(details.caption).toHaveText(shared.name)
          await expect(details.viewOnlyHeading).toBeVisible()
          await expect(details.interventionKey).toBeVisible()
          await expect(page.getByText(RETAINED, { exact: true })).toBeVisible()
          await expect(details.sizeKilometresKey).toBeVisible()
          await expect(details.stackedSizeValue).toHaveText(
            /^\s*0\.3569333\s*$/
          )
          await expect(details.lengthKey).toBeHidden()
          await expect(details.broadHabitatKey).toBeHidden()
          await expect(details.sizeHectaresKey).toBeHidden()
          await expect(details.habitatTypeKey).toBeVisible()
          await expect(
            page.getByText(NATIVE_HEDGEROW_WITH_TREES, { exact: true })
          ).toBeVisible()
          await expect(
            page.getByText('Medium (4)', { exact: true })
          ).toBeVisible()
          await expect(
            page.getByText('Moderate (2)', { exact: true })
          ).toBeVisible()
          await expect(details.strategicSignificanceValue).toBeVisible()
          await expect(details.habitatUnitsValue).toHaveText(units)
          await details.assertRetainedRefForm({ ref: ST_RETAINED_HEDGEROW_REF })
          await expect(details.habitatTypeSelect).toBeHidden()

          await details.backLink.click()
          await expectOnPiPage(page, shared.id, 'hedgerow')
        }
      )

      // Its parent's condition is Good, so the time to target names the
      // transition, as the legacy HR3's does.
      test('a hedgerow that gets worse renders the Created hedgerow form with the transition from its parent', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const shared = await getServiceTemplateLinearProject(browser)
        const units = await unitsByRef(
          page,
          shared.id,
          'hedgerow',
          ST_WORSE_HEDGEROW_REF
        )
        await openPiFeatureDetails(
          page,
          shared.id,
          'hedgerow',
          ST_WORSE_HEDGEROW_REF
        )

        await details.assertCreatedHedgerowEditForm({
          ref: ST_WORSE_HEDGEROW_REF
        })
        await expectCreatedAreaSelections(details, {
          type: 'Native hedgerow',
          significance: 'Low',
          condition: 'Moderate'
        })
        await expect(details.habitatTypeSelect.getByRole('option')).toHaveText(
          HEDGEROW_CREATION_OPTIONS
        )
        await expect(
          details.targetConditionSelect.getByRole('option')
        ).toHaveText(HEDGEROW_CREATION_CONDITIONS)
        await expect(details.createdLengthValue).toHaveText('0.05454062km')
        await expect(details.standardTimeToTargetValue).toHaveText(
          'Good to Moderate - 5 years'
        )
        await expect(details.standardTimeToTargetValue).not.toContainText(
          STALE_TIME_TO_TARGET_TEXT
        )
        await expect(details.viewBaselineLink).toBeVisible()
        await expect(details.habitatUnitsValue).toHaveText(units)
      })

      test('a Created hedgerow with no parent shows its section-2 values and units delivered', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const shared = await getServiceTemplateLinearProject(browser)
        await openPiFeatureDetails(
          page,
          shared.id,
          'hedgerow',
          ST_CREATED_HEDGEROW_REF
        )

        await details.assertCreatedHedgerowEditForm({
          ref: ST_CREATED_HEDGEROW_REF
        })
        await details.assertCreatedAbsentBaselineValues({
          projectName: shared.name,
          timeToTarget: CREATED_LINEAR_HEDGEROW_TIME_TO_TARGET,
          units: ST_CREATED_HEDGEROW_UNITS
        })
        await expectCreatedHedgerowSelections(details, {
          habitatType: NATIVE_HEDGEROW_WITH_TREES,
          condition: 'Good',
          significance: 'Low'
        })
        await expect(details.createdLengthValue).toHaveText('0.3500455km')
        await expect(details.viewBaselineLink).toBeHidden()
        await expectCreatedAreaValues(details, ST_CREATED_HEDGEROW_VALUES)
        await expect(
          details.strategicSignificanceSelect.getByRole('option')
        ).toHaveText(STRATEGIC_SIGNIFICANCE_OPTIONS)
        await expect(details.advanceYearsSelect.getByRole('option')).toHaveText(
          ['Choose advance', ...TIMING_YEARS]
        )
        await expect(details.delayYearsSelect.getByRole('option')).toHaveText([
          'Choose delay',
          ...TIMING_YEARS
        ])
      })

      test('choosing a Created hedgerow type resets the target condition and shows its values, and clearing it blanks them', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const shared = await getServiceTemplateLinearProject(browser)
        await openPiFeatureDetails(
          page,
          shared.id,
          'hedgerow',
          ST_CREATED_HEDGEROW_REF
        )

        await details.habitatTypeSelect.selectOption('Native hedgerow')
        await expectCreatedAreaSelections(details, {
          ...ST_CREATED_HEDGEROW_SELECTIONS,
          type: 'Native hedgerow',
          condition: ''
        })
        await expect(
          details.targetConditionSelect.getByRole('option')
        ).toHaveText(HEDGEROW_CREATION_CONDITIONS)
        await expectCreatedAreaValues(details, {
          distinctiveness: 'Low (2)',
          standardTime: '',
          difficulty: 'Low',
          finalTime: '',
          applied: '1'
        })

        await details.habitatTypeSelect.selectOption(
          'Non-native and ornamental hedgerow'
        )
        await expect(
          details.targetConditionSelect.getByRole('option')
        ).toHaveText(['Choose target condition', 'Poor (1)'])
        await expect(details.createdFormValue('distinctiveness')).toHaveText(
          'V.Low (1)'
        )

        await details.habitatTypeSelect.selectOption({
          label: 'Choose habitat type'
        })
        await expect(
          details.targetConditionSelect.getByRole('option')
        ).toHaveText(['Choose target condition'])
        await expectCreatedAreaValues(details, {
          distinctiveness: '',
          standardTime: '',
          difficulty: '',
          finalTime: '',
          applied: ''
        })
        await expect(details.habitatUnitsValue).toHaveText(
          ST_CREATED_HEDGEROW_UNITS
        )
      })

      test('choosing and clearing a Created hedgerow target condition updates only the time to target', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const shared = await getServiceTemplateLinearProject(browser)
        await openPiFeatureDetails(
          page,
          shared.id,
          'hedgerow',
          ST_CREATED_HEDGEROW_REF
        )

        await details.targetConditionSelect.selectOption('Moderate')
        await expectCreatedAreaValues(details, {
          ...ST_CREATED_HEDGEROW_VALUES,
          standardTime: 'Moderate - 10 years',
          finalTime: '10 years (0.7002822742)'
        })

        await details.targetConditionSelect.selectOption({
          label: 'Choose target condition'
        })
        await expectCreatedAreaValues(details, {
          ...ST_CREATED_HEDGEROW_VALUES,
          standardTime: '',
          finalTime: ''
        })
        await expectCreatedAreaSelections(details, {
          ...ST_CREATED_HEDGEROW_SELECTIONS,
          condition: ''
        })
        await expect(details.habitatUnitsValue).toHaveText(
          ST_CREATED_HEDGEROW_UNITS
        )
      })

      test('advance and delay recalculate a Created hedgerow final time to target', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const shared = await getServiceTemplateLinearProject(browser)
        await openPiFeatureDetails(
          page,
          shared.id,
          'hedgerow',
          ST_CREATED_HEDGEROW_REF
        )
        const finalTime = details.createdFormValue('finalTime')

        await details.delayYearsSelect.selectOption('3')
        await expect(finalTime).toHaveText('23 years (0.4406849377)')
        await details.advanceYearsSelect.selectOption('2')
        await expect(finalTime).toHaveText('')
        await expect(details.errorSummary).toBeHidden()

        await details.delayYearsSelect.selectOption('0')
        await details.advanceYearsSelect.selectOption('5')
        await expect(finalTime).toHaveText('15 years (0.5860163055)')
        await details.advanceYearsSelect.selectOption('30')
        await expect(finalTime).toHaveText('0 years (1)')

        await details.advanceYearsSelect.selectOption('0')
        await details.delayYearsSelect.selectOption('30+')
        await expect(finalTime).toHaveText('30+ years (0.3197967361)')
        await details.advanceYearsSelect.selectOption({
          label: 'Choose advance'
        })
        await expectCreatedAreaValues(details, {
          ...ST_CREATED_HEDGEROW_VALUES,
          finalTime: ''
        })
        await expect(details.habitatUnitsValue).toHaveText(
          ST_CREATED_HEDGEROW_UNITS
        )
      })

      test('Cancel discards the Created hedgerow changes and returns to the hedgerow page', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const shared = await getServiceTemplateLinearProject(browser)
        await openPiTabFor(page, shared.id, 'hedgerow', ST_CREATED_HEDGEROW_REF)
        const totalBefore = await hedgerowPostInterventionUnits(page)
        await openPiFeatureDetails(
          page,
          shared.id,
          'hedgerow',
          ST_CREATED_HEDGEROW_REF
        )

        await details.habitatReferenceInput.fill('Not saved')
        await expectCreatedAreaSelections(
          details,
          ST_CREATED_HEDGEROW_SELECTIONS
        )
        await expectCreatedAreaValues(details, ST_CREATED_HEDGEROW_VALUES)
        await chooseCreatedAreaSelections(details, {
          type: 'Line of trees',
          significance: 'High',
          delay: '4'
        })

        await details.cancelLink.click()

        await expectOnPiPage(page, shared.id, 'hedgerow')
        expect(await hedgerowPostInterventionUnits(page)).toBe(totalBefore)
        expect(
          await hedgerowRowByRef(page, shared.id, ST_CREATED_HEDGEROW_REF)
        ).toMatchObject({
          Units: ST_CREATED_HEDGEROW_UNITS,
          'Habitat type': NATIVE_HEDGEROW_WITH_TREES
        })
        await openPiFeatureDetails(
          page,
          shared.id,
          'hedgerow',
          ST_CREATED_HEDGEROW_REF
        )
        await expect(details.habitatReferenceInput).toHaveValue(
          ST_CREATED_HEDGEROW_REF
        )
        await expectCreatedAreaSelections(
          details,
          ST_CREATED_HEDGEROW_SELECTIONS
        )
      })

      test('a Created hedgerow save breaking both rules shows one error per rule, keeps the input and saves nothing', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const shared = await getServiceTemplateLinearProject(browser)
        await openPiFeatureDetails(
          page,
          shared.id,
          'hedgerow',
          ST_CREATED_HEDGEROW_REF
        )
        const entered = {
          type: 'Native hedgerow',
          significance: 'High',
          condition: 'Poor',
          advance: '2',
          delay: '3'
        }
        await details.habitatReferenceInput.fill('')
        await chooseCreatedAreaSelections(details, entered)

        await details.saveButton.click()

        await expectBothRulesRefused(details, entered)
        await openPiFeatureDetails(
          page,
          shared.id,
          'hedgerow',
          ST_CREATED_HEDGEROW_REF
        )
        await expectCreatedAreaSelections(
          details,
          ST_CREATED_HEDGEROW_SELECTIONS
        )
      })

      test('Upload file leaves unsaved Created hedgerow changes behind without a prompt', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage: details,
        uploadFilePage
      }) => {
        const shared = await getServiceTemplateLinearProject(browser)
        await openPiFeatureDetails(
          page,
          shared.id,
          'hedgerow',
          ST_CREATED_HEDGEROW_REF
        )
        await details.habitatReferenceInput.fill('Not saved')
        await details.strategicSignificanceSelect.selectOption('High')

        await leaveForUploadFile(page, details, uploadFilePage, shared.id)

        expect(
          await hedgerowRowByRef(page, shared.id, ST_CREATED_HEDGEROW_REF)
        ).toMatchObject({
          Units: ST_CREATED_HEDGEROW_UNITS,
          'Strategic significance': 'Low (1)'
        })
      })

      test(
        'an Enhanced hedgerow opens the hedgerow edit form, offering only valid enhancements of its baseline',
        { tag: '@smoke' },
        async ({
          browser,
          page,
          postInterventionHabitatDetailsPage: details,
          baselineHabitatDetailsPage
        }) => {
          const shared =
            await getServiceTemplateEnhancedHedgerowProject(browser)
          await openPiFeatureDetails(
            page,
            shared.id,
            'hedgerow',
            ST_ENHANCED_HEDGEROW_REF
          )

          await details.assertEnhancedHedgerowEditForm({
            ref: ST_ENHANCED_HEDGEROW_REF
          })
          await expect(details.caption).toHaveText(shared.name)
          await expectCreatedAreaSelections(
            details,
            ST_ENHANCED_HEDGEROW_SELECTIONS
          )
          await expect(
            details.habitatTypeSelect.getByRole('option')
          ).toHaveText(ST_ENHANCED_HEDGEROW_TYPES)
          await expect(
            details.targetConditionSelect.getByRole('option')
          ).toHaveText(['Choose target condition', 'Good (3)', 'Moderate (2)'])
          await expect(
            details.strategicSignificanceSelect.getByRole('option')
          ).toHaveText(STRATEGIC_SIGNIFICANCE_OPTIONS)
          await expect(
            details.advanceYearsSelect.getByRole('option')
          ).toHaveText(['Choose advance', ...TIMING_YEARS])
          await expect(details.delayYearsSelect.getByRole('option')).toHaveText(
            ['Choose delay', ...TIMING_YEARS]
          )
          await expectEnhancedFormValues(details, {
            intervention: ENHANCED,
            size: '0.3335871',
            ...ST_ENHANCED_HEDGEROW_VALUES
          })
          await expect(details.habitatUnitsValue).toHaveText(
            ST_ENHANCED_HEDGEROW_UNITS
          )

          // Unsaved changes are left behind.
          await details.habitatReferenceInput.fill('Not saved')
          await details.viewBaselineLink.click()
          await expect(page).toHaveURL(BASELINE_DETAILS_URL_PATTERN)
          await expect(baselineHabitatDetailsPage.headingTitle).toHaveText(
            `Hedgerow ${ST_ENHANCED_HEDGEROW_REF}`
          )
          await openPiFeatureDetails(
            page,
            shared.id,
            'hedgerow',
            ST_ENHANCED_HEDGEROW_REF
          )
          await expect(details.habitatReferenceInput).toHaveValue(
            ST_ENHANCED_HEDGEROW_REF
          )
        }
      )

      // A Native hedgerow, Poor, can be enhanced in its own type or moved to a
      // Medium one, which takes the metric's G-6 type-to-type time.
      test('the Enhanced hedgerow choices stay within the valid enhancements of the baseline as they change', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const shared = await getServiceTemplateEnhancedHedgerowProject(browser)
        await openPiFeatureDetails(
          page,
          shared.id,
          'hedgerow',
          ST_ENHANCED_HEDGEROW_REF
        )

        await details.targetConditionSelect.selectOption('Moderate')
        await expectEnhancedFormValues(details, {
          ...ST_ENHANCED_HEDGEROW_VALUES,
          standardTime: 'Poor to Moderate - 3 years',
          finalTime: '3 years (0.898632125)'
        })

        await details.habitatTypeSelect.selectOption(NATIVE_HEDGEROW_WITH_TREES)
        await expectCreatedAreaSelections(details, {
          ...ST_ENHANCED_HEDGEROW_SELECTIONS,
          type: NATIVE_HEDGEROW_WITH_TREES,
          condition: ''
        })
        await expect(
          details.targetConditionSelect.getByRole('option')
        ).toHaveText(HEDGEROW_CREATION_CONDITIONS)
        await expectEnhancedFormValues(details, {
          distinctiveness: 'Medium (4)',
          standardTime: '',
          difficulty: 'Low',
          finalTime: '',
          applied: '1'
        })

        await details.targetConditionSelect.selectOption('Poor')
        await expectEnhancedFormValues(details, {
          standardTime: 'Poor to Poor - 10 years',
          finalTime: '10 years (0.7002822742)'
        })
        await details.targetConditionSelect.selectOption('Good')
        await expectEnhancedFormValues(details, {
          standardTime: 'Poor to Good - 10 years'
        })

        const finalTime = details.createdFormValue('finalTime', {
          baselineLink: true
        })
        await details.delayYearsSelect.selectOption('2')
        await expect(finalTime).toHaveText('12 years (0.6521203607)')
        await details.advanceYearsSelect.selectOption('2')
        await expect(finalTime).toHaveText('')
        await expect(details.errorSummary).toBeHidden()
        await details.delayYearsSelect.selectOption('0')
        await details.advanceYearsSelect.selectOption('25')
        await expect(finalTime).toHaveText('0 years (1)')

        await details.habitatTypeSelect.selectOption({
          label: 'Choose habitat type'
        })
        await expect(
          details.targetConditionSelect.getByRole('option')
        ).toHaveText(['Choose target condition'])
        await expectEnhancedFormValues(details, {
          distinctiveness: '',
          standardTime: '',
          difficulty: '',
          finalTime: '',
          applied: ''
        })
        await expect(details.habitatUnitsValue).toHaveText(
          ST_ENHANCED_HEDGEROW_UNITS
        )
      })

      // The template offers no Medium significance to reject, so the nearest
      // incomplete Enhanced hedgerow is one whose enhancement the Metric does
      // not allow: the import clears every proposed value.
      test('an Enhanced hedgerow whose enhancement was refused on import shows the default options and zero units', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const shared = await getSharedProject(
          browser,
          'st-enhancement-not-possible',
          { piFile: HEDGEROW_ENHANCEMENT_NOT_POSSIBLE },
          async () => ({})
        )
        expect(await hedgerowRowByRef(page, shared.id, 'HG001')).toMatchObject({
          Status: STATUS_INCOMPLETE,
          Units: '0.00'
        })
        await openPiFeatureDetails(page, shared.id, 'hedgerow', 'HG001')

        await expect(details.habitatReferenceInput).toHaveValue('HG001')
        await expectCreatedAreaSelections(details, {
          type: '',
          significance: '',
          condition: '',
          advance: '',
          delay: ''
        })
        await expect(details.habitatTypeSelect.getByRole('option')).toHaveText(
          ST_ENHANCED_HEDGEROW_TYPES
        )
        await expect(
          details.targetConditionSelect.getByRole('option')
        ).toHaveText(['Choose target condition'])
        await expect(
          details.strategicSignificanceSelect.getByRole('option')
        ).toHaveText(STRATEGIC_SIGNIFICANCE_OPTIONS)
        await expect(details.habitatUnitsValue).toHaveText('0.00')
        await expect(details.saveButton).toBeVisible()
      })
    }
  )

  test.describe(
    'Post-intervention habitat details — BNG Service template watercourses',
    { tag: ['@regression', SERVICE_TEMPLATE_ONLY] },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.describe.configure({ timeout: SHARED_BUILD_TEST_TIMEOUT })

      test(
        'a Retained watercourse is headed "Habitat" and its reference, with both encroachments and its saved values read-only and only its reference editable',
        { tag: '@smoke' },
        async ({
          browser,
          page,
          postInterventionHabitatDetailsPage: details
        }) => {
          const shared = await getServiceTemplateLinearProject(browser)
          const units = await unitsByRef(
            page,
            shared.id,
            'watercourse',
            ST_RETAINED_WATERCOURSE_REF
          )
          await openPiFeatureDetails(
            page,
            shared.id,
            'watercourse',
            ST_RETAINED_WATERCOURSE_REF
          )

          await expect(
            page.getByRole('heading', {
              name: `Habitat ${ST_RETAINED_WATERCOURSE_REF}`,
              exact: true
            })
          ).toBeVisible()
          await expect(details.caption).toHaveText(shared.name)
          await expect(details.viewOnlyHeading).toBeVisible()
          await expect(page.getByText(RETAINED, { exact: true })).toBeVisible()
          await expect(details.sizeKilometresKey).toBeVisible()
          // Shorter than its parent: its own length, not the parent's.
          await expect(details.stackedSizeValue).toHaveText(
            /^\s*0\.1067453\s*$/
          )
          await expect(details.lengthKey).toBeHidden()
          await expect(page.getByText('Ditches', { exact: true })).toBeVisible()
          await expect(
            page.getByText('Medium (4)', { exact: true })
          ).toBeVisible()
          await expect(
            page.getByText('Poor (1)', { exact: true })
          ).toBeVisible()
          await expect(details.watercourseEncroachmentKey).toBeVisible()
          await expect(details.riparianEncroachmentKey).toBeVisible()
          await expect(
            page.getByText('No Encroachment (1)', { exact: true })
          ).toBeVisible()
          await expect(
            page.getByText('Major/Minor (0.84)', { exact: true })
          ).toBeVisible()
          await expect(details.stackedStrategicSignificanceKey).toBeVisible()
          await expect(details.strategicSignificanceValue).toBeVisible()
          await expect(details.habitatUnitsValue).toHaveText(units)
          await details.assertRetainedRefForm({
            ref: ST_RETAINED_WATERCOURSE_REF
          })
          await expect(details.watercourseEncroachmentSelect).toBeHidden()
          await expect(details.riparianEncroachmentSelect).toBeHidden()

          await details.backLink.click()
          await expectOnPiPage(page, shared.id, 'watercourse')
        }
      )

      test('"View baseline details" on a Retained watercourse opens its parent', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const shared = await getServiceTemplateLinearProject(browser)
        const featureId = await featureIdByRef(
          page,
          shared.id,
          'watercourse',
          ST_RETAINED_WATERCOURSE_REF
        )
        await openPiFeatureDetails(
          page,
          shared.id,
          'watercourse',
          ST_RETAINED_WATERCOURSE_REF
        )

        await details.viewBaselineLink.click()
        await expect(page).toHaveURL(BASELINE_DETAILS_URL_PATTERN)
        expect(new URL(page.url()).searchParams.get('featureId')).not.toBe(
          featureId
        )
        await expect(details.heading).toHaveText(
          `Watercourse ${ST_RETAINED_WATERCOURSE_REF}`
        )
      })

      // An Enhanced watercourse has been edited on the watercourse form since
      // the Enhanced watercourse read-only page gave way to it.
      test('an Enhanced watercourse opens the watercourse edit form, offering only valid enhancements of its baseline', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const shared = await getServiceTemplateLinearProject(browser)
        await openPiFeatureDetails(
          page,
          shared.id,
          'watercourse',
          ST_ENHANCED_WATERCOURSE_REF
        )

        await details.assertCreatedEditForm({
          ref: ST_ENHANCED_WATERCOURSE_REF,
          kind: 'watercourse',
          intervention: ENHANCED,
          sizeKey: details.sizeKilometresKey
        })
        await expect(details.viewBaselineLink).toBeVisible()
        await expect(details.backLink).toBeVisible()
        await expect(details.caption).toHaveText(shared.name)
        await expect(details.habitatTypeSelect.getByRole('option')).toHaveText([
          'Choose habitat type',
          'Canals'
        ])
        await expect(
          details.targetConditionSelect.getByRole('option')
        ).toHaveText(WATERCOURSE_ENHANCED_CONDITIONS)
        await expect(
          details.watercourseEncroachmentSelect.getByRole('option')
        ).toHaveText(WATERCOURSE_ENCROACHMENTS)
        await expect(
          details.riparianEncroachmentSelect.getByRole('option')
        ).toHaveText(RIPARIAN_ENCROACHMENTS)
        await expect(details.broadHabitatKey).toBeHidden()
      })

      // Re-meandered onto a longer route, it is priced on its own length.
      test('an Enhanced watercourse shows its own length, its proposed encroachments and its section-2 values', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const shared = await getServiceTemplateLinearProject(browser)
        const units = await unitsByRef(
          page,
          shared.id,
          'watercourse',
          ST_ENHANCED_WATERCOURSE_REF
        )
        await openPiFeatureDetails(
          page,
          shared.id,
          'watercourse',
          ST_ENHANCED_WATERCOURSE_REF
        )

        await expectCreatedAreaSelections(details, {
          type: 'Canals',
          significance: 'Low',
          condition: 'Good',
          watercourse: 'Major',
          riparian: 'Moderate/Minor',
          advance: '0',
          delay: '0'
        })
        await expectEnhancedFormValues(details, {
          intervention: ENHANCED,
          size: '0.1439403',
          distinctiveness: 'Medium (4)',
          standardTime: 'Fairly Poor to Good - 6 years',
          difficulty: 'Low',
          finalTime: '6 years (0.8075396961)',
          applied: '1'
        })
        await expect(details.standardTimeToTargetValue).not.toContainText(
          STALE_TIME_TO_TARGET_TEXT
        )
        await expect(details.habitatUnitsValue).toHaveText(units)
      })

      test('a Created watercourse renders the Created edit form', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const shared = await getServiceTemplateLinearProject(browser)
        await openPiFeatureDetails(
          page,
          shared.id,
          'watercourse',
          ST_CREATED_WATERCOURSE_REF
        )

        await details.assertCreatedWatercourseEditForm({
          ref: ST_CREATED_WATERCOURSE_REF
        })
        await expect(details.backLink).toBeVisible()
        await expect(details.caption).toHaveText(shared.name)
        await expect(details.createdLengthValue).toHaveText('0.1300647km')
        await expectCreatedAreaSelections(
          details,
          ST_CREATED_WATERCOURSE_SELECTIONS
        )
        await expect(details.habitatTypeSelect.getByRole('option')).toHaveText(
          WATERCOURSE_CREATION_TYPES
        )
        await expect(
          details.targetConditionSelect.getByRole('option')
        ).toHaveText(AREA_CREATION_CONDITIONS)
        await expect(
          details.strategicSignificanceSelect.getByRole('option')
        ).toHaveText(STRATEGIC_SIGNIFICANCE_OPTIONS)
        await expect(
          details.watercourseEncroachmentSelect.getByRole('option')
        ).toHaveText(WATERCOURSE_ENCROACHMENTS)
        await expect(
          details.riparianEncroachmentSelect.getByRole('option')
        ).toHaveText(RIPARIAN_ENCROACHMENTS)
        await expect(details.advanceYearsSelect.getByRole('option')).toHaveText(
          ['Choose advance', ...TIMING_YEARS]
        )
        await expect(details.delayYearsSelect.getByRole('option')).toHaveText([
          'Choose delay',
          ...TIMING_YEARS
        ])
      })

      // R004 names its parent, so its time to target names the transition.
      test('a Created watercourse whose encroachment alone increases shows its section-2 values and units delivered', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const shared = await getServiceTemplateLinearProject(browser)
        const units = await unitsByRef(
          page,
          shared.id,
          'watercourse',
          ST_CREATED_WATERCOURSE_REF
        )
        await openPiFeatureDetails(
          page,
          shared.id,
          'watercourse',
          ST_CREATED_WATERCOURSE_REF
        )

        await expect(details.standardTimeToTargetValue).toHaveText(
          ST_CREATED_WATERCOURSE_VALUES.standardTime
        )
        await expect(details.standardTimeToTargetValue).not.toContainText(
          STALE_TIME_TO_TARGET_TEXT
        )
        await expectCreatedAreaValues(details, ST_CREATED_WATERCOURSE_VALUES, {
          baselineLink: true
        })
        await expect(details.viewBaselineLink).toBeVisible()
        await expect(details.habitatUnitsValue).toHaveText(UNITS_TWO_DP_PATTERN)
        await expect(details.habitatUnitsValue).toHaveText(units)
        expect(units).toBe(ST_CREATED_WATERCOURSE_UNITS)
      })

      test('a Created watercourse with no parent shows its section-2 values and units delivered', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const shared = await getServiceTemplateLinearProject(browser)
        const units = await unitsByRef(
          page,
          shared.id,
          'watercourse',
          ST_NO_PARENT_WATERCOURSE_REF
        )
        await openPiFeatureDetails(
          page,
          shared.id,
          'watercourse',
          ST_NO_PARENT_WATERCOURSE_REF
        )

        await details.assertCreatedWatercourseEditForm({
          ref: ST_NO_PARENT_WATERCOURSE_REF
        })
        await details.assertCreatedAbsentBaselineValues({
          projectName: shared.name,
          timeToTarget: 'Poor - 1 years',
          units
        })
        await expect(details.createdLengthValue).toHaveText('0.4317485km')
        await expect(details.viewBaselineLink).toBeHidden()
      })

      // Its condition gets worse with neither advance nor delay, so it is saved
      // Incomplete, its values kept and its timing cleared.
      test('an incomplete Created watercourse shows its saved values, default timing and zero units', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const shared = await getServiceTemplateLinearProject(browser)
        expect(
          await watercourseRowByRef(
            page,
            shared.id,
            ST_INCOMPLETE_WATERCOURSE_REF
          )
        ).toMatchObject({ Status: STATUS_INCOMPLETE, Units: '0.00' })
        await openPiFeatureDetails(
          page,
          shared.id,
          'watercourse',
          ST_INCOMPLETE_WATERCOURSE_REF
        )

        await expect(details.habitatReferenceInput).toHaveValue(
          ST_INCOMPLETE_WATERCOURSE_REF
        )
        await expectCreatedAreaSelections(details, {
          type: 'Ditches',
          significance: 'Low',
          condition: 'Poor',
          watercourse: 'Minor',
          riparian: 'Major/Major',
          advance: '',
          delay: ''
        })
        await expectCreatedAreaValues(
          details,
          {
            distinctiveness: 'Medium (4)',
            standardTime: 'Moderate to Poor - 1 years',
            difficulty: 'Medium',
            finalTime: '',
            applied: '0.67'
          },
          { baselineLink: true }
        )
        await expect(details.standardTimeToTargetKey).toBeVisible()
        await expect(details.finalTimeToTargetMultiplierKey).toBeVisible()
        await expect(details.habitatUnitsValue).toHaveText('0.00')
        await expect(details.saveButton).toBeVisible()
        await expect(details.uploadFileButton).toBeVisible()
      })

      // A Culvert can only be created to Poor.
      test('choosing a Created watercourse type resets the target condition and shows its values, and clearing it blanks them', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const shared = await getServiceTemplateLinearProject(browser)
        await openPiFeatureDetails(
          page,
          shared.id,
          'watercourse',
          ST_CREATED_WATERCOURSE_REF
        )

        await details.habitatTypeSelect.selectOption('Culvert')
        await expectCreatedAreaSelections(details, {
          ...ST_CREATED_WATERCOURSE_SELECTIONS,
          type: 'Culvert',
          condition: ''
        })
        await expect(
          details.targetConditionSelect.getByRole('option')
        ).toHaveText(['Choose target condition', 'Poor (1)'])
        await expectCreatedAreaValues(
          details,
          {
            distinctiveness: 'Low (2)',
            standardTime: '',
            difficulty: 'Medium',
            finalTime: '',
            applied: '0.67'
          },
          { baselineLink: true }
        )

        await details.habitatTypeSelect.selectOption({
          label: 'Choose habitat type'
        })
        await expect(
          details.targetConditionSelect.getByRole('option')
        ).toHaveText(['Choose target condition'])
        await expectCreatedAreaValues(
          details,
          {
            distinctiveness: '',
            standardTime: '',
            difficulty: '',
            finalTime: '',
            applied: ''
          },
          { baselineLink: true }
        )
        await expect(details.habitatUnitsValue).toHaveText(
          ST_CREATED_WATERCOURSE_UNITS
        )
      })

      test('choosing and clearing a Created watercourse target condition updates only the time to target', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const shared = await getServiceTemplateLinearProject(browser)
        await openPiFeatureDetails(
          page,
          shared.id,
          'watercourse',
          ST_CREATED_WATERCOURSE_REF
        )

        await details.targetConditionSelect.selectOption('Good')
        await expectCreatedAreaValues(
          details,
          {
            ...ST_CREATED_WATERCOURSE_VALUES,
            standardTime: 'Fairly Poor to Good - 10 years'
          },
          { baselineLink: true }
        )

        await details.targetConditionSelect.selectOption({
          label: 'Choose target condition'
        })
        await expectCreatedAreaValues(
          details,
          { ...ST_CREATED_WATERCOURSE_VALUES, standardTime: '', finalTime: '' },
          { baselineLink: true }
        )
        await expectCreatedAreaSelections(details, {
          ...ST_CREATED_WATERCOURSE_SELECTIONS,
          condition: ''
        })
        await expect(details.habitatUnitsValue).toHaveText(
          ST_CREATED_WATERCOURSE_UNITS
        )
      })

      test('a Created watercourse strategic significance and each encroachment change alone, with no derived value changing', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const shared = await getServiceTemplateLinearProject(browser)
        await openPiFeatureDetails(
          page,
          shared.id,
          'watercourse',
          ST_CREATED_WATERCOURSE_REF
        )

        await details.strategicSignificanceSelect.selectOption('High')
        await details.watercourseEncroachmentSelect.selectOption('Major')
        await expectCreatedAreaSelections(details, {
          ...ST_CREATED_WATERCOURSE_SELECTIONS,
          significance: 'High',
          watercourse: 'Major'
        })
        await details.riparianEncroachmentSelect.selectOption('Minor/Minor')
        await expect(details.watercourseEncroachmentSelect).toHaveValue('Major')

        await details.watercourseEncroachmentSelect.selectOption({
          label: 'Choose watercourse encroachment'
        })
        await expect(details.riparianEncroachmentSelect).toHaveValue(
          'Minor/Minor'
        )
        await details.riparianEncroachmentSelect.selectOption({
          label: 'Choose riparian encroachment'
        })
        await details.strategicSignificanceSelect.selectOption({
          label: 'Choose strategic significance'
        })
        await expectCreatedAreaSelections(details, {
          ...ST_CREATED_WATERCOURSE_SELECTIONS,
          significance: '',
          watercourse: '',
          riparian: ''
        })
        await expectCreatedAreaValues(details, ST_CREATED_WATERCOURSE_VALUES, {
          baselineLink: true
        })
        await expect(details.habitatUnitsValue).toHaveText(
          ST_CREATED_WATERCOURSE_UNITS
        )
      })

      test('advance and delay recalculate a Created watercourse final time to target', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const shared = await getServiceTemplateLinearProject(browser)
        await openPiFeatureDetails(
          page,
          shared.id,
          'watercourse',
          ST_CREATED_WATERCOURSE_REF
        )
        const finalTime = details.createdFormValue('finalTime', {
          baselineLink: true
        })

        await details.advanceYearsSelect.selectOption('0')
        await details.delayYearsSelect.selectOption('3')
        await expect(finalTime).toHaveText('5 years (0.8368287006)')
        await details.advanceYearsSelect.selectOption('2')
        await expect(finalTime).toHaveText('')
        await expect(details.errorSummary).toBeHidden()

        await details.delayYearsSelect.selectOption('0')
        await details.advanceYearsSelect.selectOption('30')
        await expect(finalTime).toHaveText('0 years (1)')

        await details.advanceYearsSelect.selectOption('0')
        await details.delayYearsSelect.selectOption('30+')
        await expect(finalTime).toHaveText('30+ years (0.3197967361)')
        await details.advanceYearsSelect.selectOption({
          label: 'Choose advance'
        })
        await expectCreatedAreaValues(
          details,
          { ...ST_CREATED_WATERCOURSE_VALUES, finalTime: '' },
          { baselineLink: true }
        )
        await expect(details.habitatUnitsValue).toHaveText(
          ST_CREATED_WATERCOURSE_UNITS
        )
      })

      test('Cancel discards the Created watercourse changes and returns to the watercourse page', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const shared = await getServiceTemplateLinearProject(browser)
        await openPiTabFor(
          page,
          shared.id,
          'watercourse',
          ST_CREATED_WATERCOURSE_REF
        )
        const totalBefore = await watercoursePostInterventionUnits(page)
        await openPiFeatureDetails(
          page,
          shared.id,
          'watercourse',
          ST_CREATED_WATERCOURSE_REF
        )

        await details.habitatReferenceInput.fill('Not saved')
        await expectCreatedAreaSelections(
          details,
          ST_CREATED_WATERCOURSE_SELECTIONS
        )
        await expectCreatedAreaValues(details, ST_CREATED_WATERCOURSE_VALUES, {
          baselineLink: true
        })
        await chooseCreatedAreaSelections(details, {
          type: 'Canals',
          significance: 'High',
          watercourse: 'Major',
          delay: '4'
        })

        await details.cancelLink.click()

        await expectOnPiPage(page, shared.id, 'watercourse')
        expect(await watercoursePostInterventionUnits(page)).toBe(totalBefore)
        expect(
          await watercourseRowByRef(page, shared.id, ST_CREATED_WATERCOURSE_REF)
        ).toMatchObject({
          Units: ST_CREATED_WATERCOURSE_UNITS,
          'Habitat type': ST_CREATED_WATERCOURSE_SELECTIONS.type
        })
        await openPiFeatureDetails(
          page,
          shared.id,
          'watercourse',
          ST_CREATED_WATERCOURSE_REF
        )
        await expect(details.habitatReferenceInput).toHaveValue(
          ST_CREATED_WATERCOURSE_REF
        )
        await expectCreatedAreaSelections(
          details,
          ST_CREATED_WATERCOURSE_SELECTIONS
        )
      })

      test('a Created watercourse save breaking both rules shows one error per rule, keeps the input and saves nothing', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const shared = await getServiceTemplateLinearProject(browser)
        await openPiFeatureDetails(
          page,
          shared.id,
          'watercourse',
          ST_CREATED_WATERCOURSE_REF
        )
        const entered = {
          type: 'Canals',
          significance: 'High',
          condition: 'Poor',
          watercourse: 'Major',
          riparian: 'Moderate/Minor',
          advance: '2',
          delay: '3'
        }
        await details.habitatReferenceInput.fill('')
        await chooseCreatedAreaSelections(details, entered)

        await details.saveButton.click()

        await expectBothRulesRefused(details, entered)
        await openPiFeatureDetails(
          page,
          shared.id,
          'watercourse',
          ST_CREATED_WATERCOURSE_REF
        )
        await expectCreatedAreaSelections(
          details,
          ST_CREATED_WATERCOURSE_SELECTIONS
        )
      })

      test('Upload file leaves unsaved Created watercourse changes behind without a prompt', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage: details,
        uploadFilePage
      }) => {
        const shared = await getServiceTemplateLinearProject(browser)
        await openPiFeatureDetails(
          page,
          shared.id,
          'watercourse',
          ST_CREATED_WATERCOURSE_REF
        )
        await details.habitatReferenceInput.fill('Not saved')
        await details.strategicSignificanceSelect.selectOption('High')
        await details.watercourseEncroachmentSelect.selectOption('Major')

        await leaveForUploadFile(page, details, uploadFilePage, shared.id)

        expect(
          await watercourseRowByRef(page, shared.id, ST_CREATED_WATERCOURSE_REF)
        ).toMatchObject({
          Units: ST_CREATED_WATERCOURSE_UNITS,
          'Strategic significance': 'Low (1)',
          'Watercourse encroachment': expect.stringMatching(/^Minor/)
        })
      })
    }
  )

  test.describe(
    'Post-intervention habitat details — BNG Service template hedgerow and watercourse saves',
    { tag: ['@regression', SERVICE_TEMPLATE_ONLY] },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
      test.describe.configure({ timeout: SHARED_BUILD_TEST_TIMEOUT })

      // Its own copy of the default site, as the edits above have. Each test
      // saves a different feature and reads the total it starts from, so none
      // depends on another, and a retry's fresh copy serves it as well. The
      // units are the backend's for the same save, replayed through its PUT
      // route's payload schema, edit check and applyFeatureUpdate.
      let projectId
      test.beforeAll(async ({ browser }) => {
        ;({ id: projectId } = await buildPostInterventionOnlyProject(
          browser,
          DEFAULT_SITE
        ))
      })

      test(
        'saves a Created hedgerow reference and target condition and reloads the edited row',
        { tag: '@happy-path' },
        async ({ page, postInterventionHabitatDetailsPage: details }) => {
          // Within the grids' 10 characters, so it is shown whole.
          const updatedRef = 'HG009 new'
          await openPiFeatureDetails(page, projectId, 'hedgerow', 'HG009')
          await details.habitatReferenceInput.fill(updatedRef)
          await details.targetConditionSelect.selectOption('Moderate')
          await details.saveButton.click()

          await expectOnPiPage(page, projectId, 'hedgerow')
          // 0.3157582 km of Line of trees - associated with bank or ditch,
          // Moderate over 20 years: 0.3157582 x 2 x 2 x 1 x 0.4903952635.
          expect(
            await unitsByRef(page, projectId, 'hedgerow', updatedRef)
          ).toBe('0.62')
          await openPiFeatureDetails(page, projectId, 'hedgerow', updatedRef)
          await expect(details.habitatReferenceInput).toHaveValue(updatedRef)
          await expect(details.targetConditionSelect).toHaveValue('Moderate')
          await expect(details.habitatUnitsValue).toHaveText('0.62')
        }
      )

      test('saving a complete Created hedgerow edit recalculates the row, the units and the total', async ({
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const editedRef = `${ST_CREATED_HEDGEROW_REF}-new`
        // Species-rich native hedgerow (Medium 4), Moderate (2), Low (1),
        // delay 2 on 5 years: 0.3500455 x 4 x 2 x 1 x 0.7792758067.
        const expectedUnits = 2.1823
        await openPiTabFor(page, projectId, 'hedgerow', ST_CREATED_HEDGEROW_REF)
        const totalBefore = await hedgerowPostInterventionUnits(page)
        await openPiFeatureDetails(
          page,
          projectId,
          'hedgerow',
          ST_CREATED_HEDGEROW_REF
        )

        await details.habitatReferenceInput.fill(editedRef)
        await chooseCreatedAreaSelections(details, {
          type: 'Species-rich native hedgerow',
          significance: 'Low',
          condition: 'Moderate',
          delay: '2'
        })
        await details.saveButton.click()

        await expectOnPiPage(page, projectId, 'hedgerow')
        const totalAfter = await hedgerowPostInterventionUnits(page)
        expect(
          Math.abs(
            totalAfter -
              (totalBefore - ST_CREATED_HEDGEROW_EXACT_UNITS + expectedUnits)
          )
        ).toBeLessThan(TILE_ROUNDING)
        expect(
          await hedgerowRowByRef(page, projectId, editedRef)
        ).toMatchObject({
          Status: STATUS_COMPLETE,
          Units: expectedUnits.toFixed(2),
          'Habitat type': 'Species-rich native hedgerow',
          Distinctiveness: 'Medium (4)',
          'Strategic significance': 'Low (1)',
          'Target condition': 'Moderate (2)',
          Delay: '2 years',
          'Final time to target': '7 years (0.7792758067)'
        })

        await openPiFeatureDetails(page, projectId, 'hedgerow', editedRef)
        await expect(details.habitatReferenceInput).toHaveValue(editedRef)
        await expectCreatedAreaSelections(details, {
          type: 'Species-rich native hedgerow',
          significance: 'Low',
          condition: 'Moderate',
          advance: '0',
          delay: '2'
        })
        await expect(details.habitatUnitsValue).toHaveText(
          expectedUnits.toFixed(2)
        )
      })

      test('saving a Created hedgerow with the target condition cleared shows zero units and leaves it out of the total', async ({
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        // HG014: 0.429584 km of Non-native and ornamental hedgerow, Poor, High,
        // created a year in advance: 0.429584 x 1 x 1 x 1.15.
        const ref = 'HG014'
        const unitsBefore = 0.494
        expect(await hedgerowRowByRef(page, projectId, ref)).toMatchObject({
          Status: STATUS_COMPLETE
        })
        const totalBefore = await hedgerowPostInterventionUnits(page)
        await openPiFeatureDetails(page, projectId, 'hedgerow', ref)

        await details.targetConditionSelect.selectOption({
          label: 'Choose target condition'
        })
        await details.saveButton.click()

        await expectOnPiPage(page, projectId, 'hedgerow')
        const totalAfter = await hedgerowPostInterventionUnits(page)
        expect(Math.abs(totalAfter - (totalBefore - unitsBefore))).toBeLessThan(
          TILE_ROUNDING
        )
        expect(await hedgerowRowByRef(page, projectId, ref)).toMatchObject({
          Status: STATUS_INCOMPLETE,
          Units: '0.00',
          'Target condition': ''
        })

        await openPiFeatureDetails(page, projectId, 'hedgerow', ref)
        await expect(details.targetConditionSelect).toHaveValue('')
        await expect(details.habitatUnitsValue).toHaveText('0.00')
      })

      test('a reference another Created hedgerow already carries is saved', async ({
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const duplicatedRef = 'HG016'
        await openPiFeatureDetails(page, projectId, 'hedgerow', 'HG008')
        await details.habitatReferenceInput.fill(duplicatedRef)
        await details.saveButton.click()

        await expectOnPiPage(page, projectId, 'hedgerow')
        const unitPage = piPage(page, 'hedgerow')
        await unitPage.tab(CREATED).click()
        await expect(unitPage.refLink(CREATED, duplicatedRef)).toHaveCount(2)
        await expect(unitPage.refLink(CREATED, 'HG008')).toHaveCount(0)
      })

      test('saving an Enhanced hedgerow with the significance cleared shows zero units and leaves it out of the total', async ({
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        await openPiTabFor(
          page,
          projectId,
          'hedgerow',
          ST_HIGH_ENHANCED_HEDGEROW_REF
        )
        const totalBefore = await hedgerowPostInterventionUnits(page)
        await openPiFeatureDetails(
          page,
          projectId,
          'hedgerow',
          ST_HIGH_ENHANCED_HEDGEROW_REF
        )

        await details.strategicSignificanceSelect.selectOption({
          label: 'Choose strategic significance'
        })
        await details.saveButton.click()

        await expectOnPiPage(page, projectId, 'hedgerow')
        const totalAfter = await hedgerowPostInterventionUnits(page)
        expect(
          Math.abs(
            totalAfter - (totalBefore - ST_HIGH_ENHANCED_HEDGEROW_EXACT_UNITS)
          )
        ).toBeLessThan(TILE_ROUNDING)
        expect(
          await hedgerowRowByRef(page, projectId, ST_HIGH_ENHANCED_HEDGEROW_REF)
        ).toMatchObject({ Status: STATUS_INCOMPLETE, Units: '0.00' })

        await openPiFeatureDetails(
          page,
          projectId,
          'hedgerow',
          ST_HIGH_ENHANCED_HEDGEROW_REF
        )
        await expectCreatedAreaSelections(details, {
          type: NATIVE_HEDGEROW_WITH_TREES,
          significance: '',
          condition: 'Good',
          advance: '0',
          delay: '0'
        })
        await expect(details.habitatUnitsValue).toHaveText('0.00')
      })

      test('saving a new reference on a Retained hedgerow renames it alone and leaves its units and its parent alone', async ({
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        await expectServiceTemplateRetainedRename(page, details, {
          projectId,
          type: 'hedgerow',
          ref: ST_RETAINED_HEDGEROW_REF,
          newRef: `${ST_RETAINED_HEDGEROW_REF}-NEW`
        })
      })

      test('saving a complete Created watercourse edit recalculates the row, the units and the total', async ({
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const editedRef = `${ST_NO_PARENT_WATERCOURSE_REF}-new`
        // R003 was a Culvert, Poor, High, delayed 30+ years:
        // 0.4317485 km x 2 x 1 x 1.15 x 0.3197967361 x 0.67 x 0.68 x 1.
        const unitsBefore = 0.1447
        // Ditches (Medium 4), Good (3), Low (1), Minor (0.8), Minor/Minor
        // (0.95), delay 2 on 10 years:
        // 0.4317485 x 4 x 3 x 1 x 0.6521203607 x 0.67 x 0.8 x 0.95.
        const expectedUnits = 1.7204
        await openPiTabFor(
          page,
          projectId,
          'watercourse',
          ST_NO_PARENT_WATERCOURSE_REF
        )
        const totalBefore = await watercoursePostInterventionUnits(page)
        await openPiFeatureDetails(
          page,
          projectId,
          'watercourse',
          ST_NO_PARENT_WATERCOURSE_REF
        )

        await details.habitatReferenceInput.fill(editedRef)
        const chosen = {
          type: 'Ditches',
          significance: 'Low',
          condition: 'Good',
          watercourse: 'Minor',
          riparian: 'Minor/Minor',
          advance: '0',
          delay: '2'
        }
        await chooseCreatedAreaSelections(details, chosen)
        await details.commentInput.fill(` ${CREATED_WATERCOURSE_COMMENT} `)
        await details.saveButton.click()

        await expectOnPiPage(page, projectId, 'watercourse')
        const totalAfter = await watercoursePostInterventionUnits(page)
        expect(
          Math.abs(totalAfter - (totalBefore - unitsBefore + expectedUnits))
        ).toBeLessThan(TILE_ROUNDING)
        expect(
          await watercourseRowByRef(page, projectId, editedRef)
        ).toMatchObject({
          Status: STATUS_COMPLETE,
          Units: expectedUnits.toFixed(2),
          'Habitat type': 'Ditches',
          Distinctiveness: 'Medium (4)',
          'Strategic significance': 'Low (1)',
          'Target condition': 'Good (3)',
          'Watercourse encroachment': 'Minor (0.8)',
          'Riparian encroachment': 'Minor/Minor (0.95)',
          Delay: '2 years',
          'Final time to target': '12 years (0.6521203607)'
        })

        await openPiFeatureDetails(page, projectId, 'watercourse', editedRef)
        await expect(details.habitatReferenceInput).toHaveValue(editedRef)
        await expectCreatedAreaSelections(details, chosen)
        await expect(details.habitatUnitsValue).toHaveText(
          expectedUnits.toFixed(2)
        )
        await expect(details.commentInput).toHaveValue(
          CREATED_WATERCOURSE_COMMENT
        )
      })

      test('saving a Created watercourse with the riparian encroachment cleared shows zero units and leaves it out of the total', async ({
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        expect(
          await watercourseRowByRef(page, projectId, ST_CREATED_WATERCOURSE_REF)
        ).toMatchObject({ Status: STATUS_COMPLETE })
        const totalBefore = await watercoursePostInterventionUnits(page)
        await openPiFeatureDetails(
          page,
          projectId,
          'watercourse',
          ST_CREATED_WATERCOURSE_REF
        )

        await details.riparianEncroachmentSelect.selectOption({
          label: 'Choose riparian encroachment'
        })
        await details.saveButton.click()

        await expectOnPiPage(page, projectId, 'watercourse')
        const totalAfter = await watercoursePostInterventionUnits(page)
        expect(
          Math.abs(
            totalAfter - (totalBefore - ST_CREATED_WATERCOURSE_EXACT_UNITS)
          )
        ).toBeLessThan(TILE_ROUNDING)
        expect(
          await watercourseRowByRef(page, projectId, ST_CREATED_WATERCOURSE_REF)
        ).toMatchObject({
          Status: STATUS_INCOMPLETE,
          Units: '0.00',
          'Watercourse encroachment': 'Minor',
          'Riparian encroachment': ''
        })

        await openPiFeatureDetails(
          page,
          projectId,
          'watercourse',
          ST_CREATED_WATERCOURSE_REF
        )
        await expectCreatedAreaSelections(details, {
          ...ST_CREATED_WATERCOURSE_SELECTIONS,
          riparian: ''
        })
        await expect(details.habitatUnitsValue).toHaveText('0.00')
      })

      test('a reference a Retained watercourse already carries is saved on a Created one', async ({
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        // R001 is the site's Retained culvert.
        const duplicatedRef = 'R001'
        await openPiFeatureDetails(
          page,
          projectId,
          'watercourse',
          ST_INCOMPLETE_WATERCOURSE_REF
        )
        await details.habitatReferenceInput.fill(duplicatedRef)
        await details.saveButton.click()

        await expectOnPiPage(page, projectId, 'watercourse')
        const unitPage = piPage(page, 'watercourse')
        await unitPage.tab(CREATED).click()
        await expect(unitPage.refLink(CREATED, duplicatedRef)).toHaveCount(1)
        await expect(
          unitPage.refLink(CREATED, ST_INCOMPLETE_WATERCOURSE_REF)
        ).toHaveCount(0)
        await unitPage.tab(RETAINED).click()
        await expect(unitPage.refLink(RETAINED, duplicatedRef)).toHaveCount(1)
      })

      test('saving a new reference on a Retained watercourse renames it alone and leaves its units and its parent alone', async ({
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        await expectServiceTemplateRetainedRename(page, details, {
          projectId,
          type: 'watercourse',
          ref: ST_RETAINED_WATERCOURSE_REF,
          newRef: `${ST_RETAINED_WATERCOURSE_REF}-NEW`
        })
      })

      // Trading-all-met's HG002, the one Enhanced hedgerow that can change
      // type, in a copy of its own.
      test('saving a complete Enhanced hedgerow edit recalculates the enhanced units, the row and the total', async ({
        browser,
        page,
        postInterventionHabitatDetailsPage: details
      }) => {
        const { id } = await getSharedProject(
          browser,
          'st-enhanced-hedgerow-save',
          { piFile: TRADING_ALL_MET },
          async () => ({})
        )
        const newRef = `${ST_ENHANCED_HEDGEROW_REF}-new`
        // Native hedgerow with trees (Medium 4), Moderate (2), Low (1), delay
        // 2 on the 10-year G-6 move: 12 years (0.6521203607).
        // B = 0.3335871 x 2 x 1, T = 0.3335871 x 4 x 2,
        // (B + (T - B) x 0.6521203607 x 1) x 1 = 1.9724
        const expectedUnits = 1.9724
        await openPiTabFor(page, id, 'hedgerow', ST_ENHANCED_HEDGEROW_REF)
        const totalBefore = await hedgerowPostInterventionUnits(page)
        await openPiFeatureDetails(
          page,
          id,
          'hedgerow',
          ST_ENHANCED_HEDGEROW_REF
        )

        await details.habitatReferenceInput.fill(newRef)
        await chooseCreatedAreaSelections(details, {
          type: NATIVE_HEDGEROW_WITH_TREES,
          condition: 'Moderate',
          significance: 'Low',
          delay: '2'
        })
        await details.saveButton.click()

        await expectOnPiPage(page, id, 'hedgerow')
        const totalAfter = await hedgerowPostInterventionUnits(page)
        expect(
          Math.abs(
            totalAfter -
              (totalBefore - ST_ENHANCED_HEDGEROW_EXACT_UNITS + expectedUnits)
          )
        ).toBeLessThan(TILE_ROUNDING)
        expect(await hedgerowRowByRef(page, id, newRef)).toMatchObject({
          Status: STATUS_COMPLETE,
          Units: expectedUnits.toFixed(2),
          'Habitat type': NATIVE_HEDGEROW_WITH_TREES,
          Distinctiveness: 'Medium (4)',
          'Strategic significance': 'Low (1)',
          'Target condition': 'Moderate (2)',
          Delay: '2 years',
          'Final time to target': '12 years (0.6521203607)'
        })
      })
    }
  )
})
