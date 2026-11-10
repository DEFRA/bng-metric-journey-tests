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
  openPiTabFor,
  piPage,
  piPageUrl
} from '@utils/post-intervention-grid.js'
import { UNITS_TWO_DP_PATTERN } from '@pages/post-intervention-habitat-details.page.js'
import {
  LONG_PADDED_REFS,
  getLongPaddedRefsProject
} from '@utils/summary-projects.js'
import { gridRefName } from '@utils/habitat-ref-display.js'
import { readTileUnits } from '@utils/tile-value.js'

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
const DETAILS_URL_PATTERN = /\/post-intervention-habitat-details/
const BASELINE_DETAILS_URL_PATTERN = /\/baseline-habitat-details/

// Fixture reachability (Retention Category per feature, read from the .gpkg):
// - COMPLETE_PI_FILE areas: H1 + H2-2 Retained, H2-3 + H3 Enhanced, H2-1…
//   Lost. The Retained parcels render the reference form (BMD-1180), the
//   Enhanced ones the read-only page.
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
// - TREES_FILE: T001-T004 individual trees (unsupported placeholder page).
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
const ENHANCED_HEDGEROW_REF = 'HR2'
const ENHANCED_UPLIFT_HEDGEROW_REF = 'HG018'
const ENHANCED_UPLIFT_HEDGEROW_TIME = 'Poor to Moderate - 20 years'
// BMD-1051: the same file's HG032 (a valid Moderate→Good enhancement) carries
// a Medium Proposed Strategic Significance, which the backend rejects and
// prices at zero. HG031 would not do: BMD-820 rejects its enhancement first.
const ENHANCED_REJECTED_HEDGEROW_REF = 'HG032'
// Any "{label} ({multiplier})" strategic significance — what the page showed
// for a nulled value ("Low (1)") before frontend PR #370.
const STRATEGIC_SIGNIFICANCE_WITH_MULTIPLIER = /^(Low|Medium|High) \([\d.]+\)$/
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
const TIMING_CONFLICT_SUMMARY =
  'A habitat cannot be created both in advance and with a delay.'
const TIMING_CONFLICT_INLINE =
  'Either the advance or delay field must be set at zero.'
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
const CREATED_LINEAR_WATERCOURSE_REF = 'R003'
const CREATED_LINEAR_WATERCOURSE_TIME_TO_TARGET = 'Fairly Poor - 2 years'
const ENHANCED_WATERCOURSE_REF = 'WC2'
const CREATED_WATERCOURSE_REF = 'WC3'
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
// reference form (H1 with a ref-matching baseline feature, H2-2 without), an
// Enhanced parcel, and a Lost parcel (H2-1) which the backend imports as
// Created — both prove retention no longer gates the read-only page.
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
      const enhancedWithBaseline = await harvestPiFeature(
        page,
        id,
        'area',
        'H3'
      )
      return {
        retainedWithBaseline: await featureIdByRef(page, id, 'area', 'H1'),
        retainedNoBaseline: retainedNoBaseline.featureId,
        retainedNoBaselineUnits: retainedNoBaseline.units,
        // Enhanced area parcel for the two-section read-only page (BMD-725):
        // H3 is Enhanced and shares its ref with a baseline feature (View
        // baseline link shown).
        enhancedWithBaseline: enhancedWithBaseline.featureId,
        enhancedWithBaselineUnits: enhancedWithBaseline.units
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
  'Native hedgerow with trees',
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
  delay: 'delayYearsSelect'
}

async function expectCreatedAreaSelections(details, expected) {
  for (const [name, value] of Object.entries(expected)) {
    await expect(details[CREATED_AREA_SELECTS[name]], name).toHaveValue(value)
  }
}

async function expectCreatedAreaValues(details, expected) {
  for (const [name, value] of Object.entries(expected)) {
    await expect(details.createdFormValue(name), name).toHaveText(value)
  }
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

// Baseline + PI hedgerow uploads in one project: retained hedgerows for the
// view-only page, with HR1 ref-matched to a baseline hedgerow so the
// "View baseline details" link renders (BMD-723 AC1/AC3). HR2 is Enhanced and
// also ref-matched (the baseline file has HR1/HR2), so it drives the two-section
// Enhanced hedgerow page with its View-baseline link shown (BMD-733).
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
      // HR2 — Enhanced hedgerow, ref-matched to a baseline hedgerow (View
      // baseline link shown) — for the two-section Enhanced page (BMD-733).
      const enhanced = await harvestPiFeature(
        page,
        id,
        'hedgerow',
        ENHANCED_HEDGEROW_REF
      )
      return {
        retainedHedgerow: retained.featureId,
        retainedHedgerowUnits: retained.units,
        enhancedHedgerow: enhanced.featureId,
        enhancedHedgerowUnits: enhanced.units,
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
// Poor→Moderate), so it can pin the dynamic condition-transition time text
// (frontend PR#193) on a hedgerow. HG018 is ref-matched to a baseline hedgerow,
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
      const hedgerow = await harvestPiFeature(
        page,
        id,
        'hedgerow',
        ENHANCED_UPLIFT_HEDGEROW_REF
      )
      const watercourse = await harvestPiFeature(
        page,
        id,
        'watercourse',
        ENHANCED_UPLIFT_WATERCOURSE_REF
      )
      return {
        enhancedUpliftHedgerow: hedgerow.featureId,
        enhancedUpliftHedgerowUnits: hedgerow.units,
        enhancedUpliftWatercourse: watercourse.featureId,
        enhancedUpliftWatercourseUnits: watercourse.units
      }
    }
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

function getTreesProject(browser) {
  return getSharedProject(
    browser,
    'trees',
    { piFile: TREES_FILE },
    async (page, id) => ({
      tree: await featureIdByRef(page, id, 'area', 'T001')
    })
  )
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
        const shared = await getCompleteProject(browser)
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

    test.describe('retained area habitat display', () => {
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
          await expect(
            page.getByText('Retained', { exact: true })
          ).toBeVisible()
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
    })

    // ─── Enhanced area habitat — two-section view-only display (BMD-725) ──────
    // An Enhanced area habitat renders a dedicated two-section read-only page
    // (pi-habitat-details-enhanced.njk): a "Post-intervention habitat details"
    // section, a "Time to target / difficulty" section, and a "Habitat units
    // delivered" summary row. The page heading is the feature ref, and every
    // value is sourced from the feature's `proposed` side. H3 is Enhanced and
    // shares its ref with a baseline feature (View baseline link shown); H2-3
    // is Enhanced with no baseline match (link hidden).

    test.describe('Enhanced area habitat display', () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test(
        'Enhanced area habitat renders the two-section read-only page with every row and no form controls',
        { tag: '@smoke' },
        async ({ browser, postInterventionHabitatDetailsPage, page }) => {
          const shared = await getCompleteProject(browser)
          // Arrive the way the user does (BMD-725): click the parcel's Ref link
          // in the area habitats post-intervention grid rather than deep-linking.
          await openPiFeatureDetails(page, shared.id, 'area', 'H3')
          await expect(page).toHaveURL(DETAILS_URL_PATTERN)

          const detailsPage = postInterventionHabitatDetailsPage
          await detailsPage.assertTwoSectionLayout({
            ref: 'H3',
            intervention: 'Enhanced'
          })
          await expect(detailsPage.caption).toHaveText(shared.name)
          // Area specifics: the size row is "Area" and there is a Broad habitat
          // row, neither of which the hedgerow/watercourse pages carry.
          await expect(detailsPage.enhancedAreaKey).toBeVisible()
          await expect(detailsPage.broadHabitatKey).toBeVisible()
          // "View baseline details" renders after section 1 (H3 is ref-matched).
          await expect(detailsPage.viewBaselineLink).toBeVisible()
          await expect(detailsPage.broadHabitatSelect).toBeHidden()
          await expect(detailsPage.habitatTypeSelect).toBeHidden()
          await expect(detailsPage.conditionSelect).toBeHidden()
        }
      )

      test(
        'Enhanced area habitat shows its section-2 values and units delivered',
        { tag: '@regression' },
        async ({ browser, postInterventionHabitatDetailsPage }) => {
          const shared = await getCompleteProject(browser)
          await postInterventionHabitatDetailsPage.open(
            shared.id,
            shared.enhancedWithBaseline
          )

          // The standard time-to-target value proves the section-2 values
          // render *and* pins the dynamic condition transition frontend PR#193
          // introduced: "<baseline condition> to <target condition> - N years"
          // (H3 improves Poor → Good over 10 years). A shape-only assertion
          // would also pass on the old static "Baseline condition to target
          // condition - N years" wording this ticket was re-worked away from, so
          // assert the exact transition and explicitly exclude that stale text.
          await expect(
            postInterventionHabitatDetailsPage.standardTimeToTargetValue
          ).toHaveText('Poor to Good - 10 years')
          await expect(
            postInterventionHabitatDetailsPage.standardTimeToTargetValue
          ).not.toContainText(STALE_TIME_TO_TARGET_TEXT)
          // "Habitat units delivered" matches the Units cell of the same
          // parcel's grid row.
          await expect(
            postInterventionHabitatDetailsPage.habitatUnitsValue
          ).toHaveText(shared.enhancedWithBaselineUnits)
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
      { tag: '@regression' },
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
      { tag: '@regression' },
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
        })

        // AC13. Frontend controller-created-area.test.js covers each rule on
        // its own against a mocked backend. This proves both errors render
        // together, as UCD worded them, and that nothing is saved.
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

          await details.saveButton.click()

          await expect(details.errorSummary.getByRole('link')).toHaveCount(2)
          await expect(
            details.errorSummaryLink(INVALID_REF_SUMMARY)
          ).toHaveAttribute('href', '#ref')
          await expect(
            details.errorSummaryLink(TIMING_CONFLICT_SUMMARY)
          ).toHaveAttribute('href', '#advanceYears')
          await expect(details.inlineError(INVALID_REF_INLINE)).toBeVisible()
          await expect(
            details.inlineError(TIMING_CONFLICT_INLINE)
          ).toBeVisible()
          await expect(details.habitatReferenceInput).toHaveValue('')
          await expectCreatedAreaSelections(details, entered)

          await openPiFeatureDetails(page, shared.id, 'area', CREATED_AREA_REF)
          await expectCreatedAreaSelections(details, CREATED_AREA_SELECTIONS)
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

    // ─── Cross-user access ────────────────────────────────────────────────────
    // The backend scopes projects by owner (visibleToUser), so a direct
    // object URL from a different authenticated user must 404 without
    // leaking any of the creator's data (IDOR).

    test.describe('cross-user access', { tag: '@regression' }, () => {
      test.skip(skipInE2e(NO_PROJECTS_STORAGE_STATE), E2E_SKIP_REASON)

      test('a feature in one user’s project cannot be opened directly by a different user', async ({
        browser
      }) => {
        const shared = await getCompleteProject(browser)
        const otherContext = await browser.newContext({
          storageState: NO_PROJECTS_STORAGE_STATE,
          baseURL: baseUrl
        })
        try {
          const otherPage = await otherContext.newPage()
          const response = await otherPage.goto(
            detailsUrl({
              projectId: shared.id,
              featureId: shared.retainedNoBaseline
            })
          )
          expect(response.status()).toBe(HTTP_NOT_FOUND)
          // None of the creator's feature data is rendered.
          await expect(otherPage.getByText('Modified grassland')).toBeHidden()
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

  test.describe('Post-intervention habitat details — mixed-project scenarios', () => {
    // ─── Retained area habitat — baseline-side value sourcing ────────────────
    // For a retained feature the engine derives everything from the baseline
    // side, so the view-only page reads descriptive values from the
    // feature's baseline sub-object. The mixed fixture's H1 has entirely
    // blank proposed columns — if the page read proposed-side values these
    // rows would be empty.

    test.describe('retained value sourcing', { tag: '@regression' }, () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // FIXME(BMD-1043): parked 2026-10-07 pending a team
      // ruling. This project has a post-intervention upload and no baseline.
      // Frontend PR#352 removed the post-intervention habitat list, which was
      // the only page that listed such a project's features — the unit-type
      // post-intervention pages redirect a no-baseline project to the summary —
      // so the featureId can no longer be harvested from the UI. Restore once
      // the team confirms whether that is intended (add a baseline upload) or
      // a regression (keep this setup).
      test.fixme('retained parcel with blank proposed columns shows baseline-side values', async ({
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
        await expect(page.getByText('Retained', { exact: true })).toBeVisible()
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
        // No baseline upload in this project, so no ref-matched feature and
        // no "View baseline details" link.
        await expect(
          postInterventionHabitatDetailsPage.viewBaselineLink
        ).toBeHidden()
      })
    })
  })

  // ─── Retained hedgerow — reference form (BMD-723, BMD-1180) ────────────────

  test.describe('Post-intervention habitat details — retained hedgerow display', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    // FIXME(BMD-1180): parked 2026-11-03. The PO ruled the H1 is "Habitat <ref>"
    // on every retained type, but frontend PR#423 renders "Hedgerow HR1". Restore
    // once the frontend follows the ruling.
    test.fixme(
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
        await detailsPage.assertRetainedRefForm({ ref: RETAINED_HEDGEROW_REF })
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
        await expect(page.getByText('Retained', { exact: true })).toBeVisible()
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
  })

  // ─── Enhanced hedgerow — two-section view-only display (BMD-733) ─────────────
  // An Enhanced hedgerow renders a dedicated two-section read-only page
  // (pi-hedgerow-details-enhanced.njk): a "Post-intervention habitat details"
  // section, a "Time to target / difficulty" section, and a "Habitat units
  // delivered" summary row. Like the single-list hedgerow page it has no Broad
  // habitat row and labels the size row "Length" (km); like the Enhanced area
  // page (BMD-725) every value is sourced from the feature's `proposed` side and
  // the page heading is the feature ref. HR2 is Enhanced and shares its ref with
  // a baseline hedgerow (View baseline link shown).

  test.describe('Post-intervention habitat details — Enhanced hedgerow display', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'Enhanced hedgerow renders the two-section read-only page with every row and no form controls',
      { tag: '@smoke' },
      async ({ browser, postInterventionHabitatDetailsPage, page }) => {
        const shared = await getHedgerowsProject(browser)
        // Arrive the way the user does (BMD-733 AC1): open the hedgerows grid
        // and click the hedgerow's Ref link rather than deep-linking.
        await openPiFeatureDetails(
          page,
          shared.id,
          'hedgerow',
          ENHANCED_HEDGEROW_REF
        )
        await expect(page).toHaveURL(DETAILS_URL_PATTERN)

        const detailsPage = postInterventionHabitatDetailsPage
        await detailsPage.assertTwoSectionLayout({
          ref: ENHANCED_HEDGEROW_REF,
          intervention: 'Enhanced'
        })
        await expect(detailsPage.caption).toHaveText(shared.name)
        // Hedgerow specifics: the size row is "Length" and there is no Broad
        // habitat row.
        await expect(detailsPage.enhancedLengthKey).toBeVisible()
        await expect(detailsPage.broadHabitatKey).toBeHidden()
        // "View baseline details" renders after section 1 (HR2 is ref-matched).
        await expect(detailsPage.viewBaselineLink).toBeVisible()
        await expect(detailsPage.habitatTypeSelect).toBeHidden()
        await expect(detailsPage.conditionSelect).toBeHidden()
      }
    )

    test(
      'Enhanced hedgerow shows its section-2 values and the dynamic condition-transition time (PR#193)',
      { tag: '@regression' },
      async ({ browser, postInterventionHabitatDetailsPage }) => {
        // HR2 (the mixed fixture's Enhanced hedge) is Moderate→Moderate, so
        // its time-to-target renders blank — the dynamic transition can only
        // be pinned on a hedge that actually improves. HG018 goes
        // Poor→Moderate.
        const shared = await getAllTypesProject(browser)
        await postInterventionHabitatDetailsPage.open(
          shared.id,
          shared.enhancedUpliftHedgerow
        )

        // The standard time-to-target value proves the section-2 values render
        // *and* pins the dynamic condition transition frontend PR#193 introduced:
        // "<baseline condition> to <target condition> - N years". A shape-only
        // assertion would also pass on the old static "Baseline condition to
        // target condition - N years" wording this ticket was re-worked away
        // from, so assert the exact transition and exclude that stale text.
        await expect(
          postInterventionHabitatDetailsPage.standardTimeToTargetValue
        ).toHaveText(ENHANCED_UPLIFT_HEDGEROW_TIME)
        await expect(
          postInterventionHabitatDetailsPage.standardTimeToTargetValue
        ).not.toContainText(STALE_TIME_TO_TARGET_TEXT)
        // "Habitat units delivered" matches the Units cell of the same
        // hedgerow's grid row.
        await expect(
          postInterventionHabitatDetailsPage.habitatUnitsValue
        ).toHaveText(shared.enhancedUpliftHedgerowUnits)
      }
    )

    // BMD-1051, frontend PR #370: a strategic significance nulled on import
    // shows nothing. Before #370 the page fell back to "Low (1)", so the
    // witness is that no "{label} ({multiplier})" value renders at all, with
    // the label still present. Since BMD-1070 (backend PR #498) the feature is
    // saved with null units rather than 0, so units delivered is empty too.
    test(
      'Enhanced hedgerow with a rejected strategic significance shows no value and no units delivered',
      { tag: '@regression' },
      async ({ browser, postInterventionHabitatDetailsPage, page }) => {
        const shared = await getAllTypesProject(browser)
        await openPiFeatureDetails(
          page,
          shared.id,
          'hedgerow',
          ENHANCED_REJECTED_HEDGEROW_REF
        )
        await expect(page).toHaveURL(DETAILS_URL_PATTERN)

        await expect(
          postInterventionHabitatDetailsPage.stackedStrategicSignificanceKey
        ).toBeVisible()
        await expect(
          page
            .getByRole('main')
            .getByText(STRATEGIC_SIGNIFICANCE_WITH_MULTIPLIER)
        ).toHaveCount(0)
        // The <dd> keeps its template whitespace, so match "nothing but
        // whitespace" rather than an exact empty string.
        await expect(
          postInterventionHabitatDetailsPage.habitatUnitsValue
        ).toHaveText(/^\s*$/)
      }
    )
  })

  // BMD-1049: real uploaded Created hedgerows render the shared edit form.
  // Keep both baseline-transition and absent-baseline fixtures as witnesses.

  test.describe(
    'Created hedgerow habitats are editable',
    { tag: '@regression' },
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
          habitatType: 'Native hedgerow with trees',
          condition: 'Good',
          significance: 'High'
        })
        await expect(detailsPage.lengthKey).toBeVisible()
        // HG013 geometry is 175.1389248737094 m; the Length column is rounded.
        await expect(detailsPage.createdLengthValue).toHaveText('0.1751389km')
        await expect(detailsPage.broadHabitatKey).toBeHidden()
        // This fixture has no explicit stored parent, so there is no baseline link.
        await expect(detailsPage.viewBaselineLink).toBeHidden()
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

  // ─── Retained watercourse — reference form (BMD-724, BMD-1180) ─────────────

  test.describe('Post-intervention habitat details — retained watercourse display', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    // FIXME(BMD-1180): parked 2026-11-03. The PO ruled the H1 is "Habitat <ref>"
    // on every retained type, but frontend PR#423 renders "Watercourse WC1".
    // Restore once the frontend follows the ruling.
    test.fixme(
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
        await expect(detailsPage.stackedStrategicSignificanceKey).toBeVisible()
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
        await expect(page.getByText('Retained', { exact: true })).toBeVisible()
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
  })

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

  test.describe('Post-intervention habitat details — Enhanced watercourse display', () => {
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
        await expect(detailsPage.stackedSizeValue).toHaveText(LENGTH_KM_PATTERN)

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
  })

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
    { tag: '@regression' },
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

  // ─── Unsupported feature placeholder (individual trees) ─────────────────────

  test.describe(
    'Post-intervention habitat details — unsupported tree feature',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // FIXME(BMD-1043): parked 2026-10-07 pending a team
      // ruling. This project has a post-intervention upload and no baseline.
      // Frontend PR#352 removed the post-intervention habitat list, which was
      // the only page that listed such a project's features — the unit-type
      // post-intervention pages redirect a no-baseline project to the summary —
      // so the featureId can no longer be harvested from the UI. Restore once
      // the team confirms whether that is intended (add a baseline upload) or
      // a regression (keep this setup).
      test.fixme('an individual tree renders the unsupported-feature placeholder', async ({
        browser,
        postInterventionHabitatDetailsPage,
        page
      }) => {
        const shared = await getTreesProject(browser)
        await postInterventionHabitatDetailsPage.open(shared.id, shared.tree)

        await expect(
          postInterventionHabitatDetailsPage.viewOnlyHeading
        ).toBeVisible()
        await expect(
          postInterventionHabitatDetailsPage.unsupportedFeatureMessage
        ).toBeVisible()
        await expect(postInterventionHabitatDetailsPage.saveButton).toBeHidden()

        await postInterventionHabitatDetailsPage.backLink.click()
        await expectOnPiPage(page, shared.id, 'area')
      })
    }
  )

  // ─── Save is not implemented for read-only features ─────────────────────────
  // Created area and hedgerow edit forms and Retained reference forms post here.
  // The route answers 501 for every other feature, so a stale page or client
  // gets an explicit "not implemented" response rather than a save. The handler
  // validates the payload first (400 for a malformed body), so the request must
  // be a well-formed save aimed at a read-only feature to reach that branch.

  test.describe(
    'Post-intervention habitat details — save not implemented for read-only features',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('POST /post-intervention-habitat-details for an Enhanced area habitat returns 501 Not Implemented', async ({
        browser,
        page
      }) => {
        const shared = await getCompleteProject(browser)
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
              featureId: shared.enhancedWithBaseline,
              ref: 'H3',
              broadHabitat: '',
              habitatType: '',
              condition: '',
              strategicSignificance: '',
              advanceYears: '',
              delayYears: '',
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
    { tag: '@regression' },
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
})
