// Shared baseline-only project for the project-summary page and its unit-type
// drill-downs (area summary, area baseline, hedgerows/watercourses summaries).
//
// Uploading is the slowest and flakiest step we own, and concurrent uploads
// clobber the single `pendingUploadId` yar key — so the project is built once
// and reused. `createProjectCache()` returns a fresh Map per call, which means a
// cache declared inside a spec file is private to that file: a second spec
// wanting the same project would pay for a second upload. Calling it ONCE here,
// at module scope, is what lets every spec that imports this share one build.
//
// Module state lives per worker, so the sharing holds whenever the importing
// specs run in the same worker — always true in CI (`workers: 1`). Locally,
// under full parallelism, a second worker may build its own copy; that costs an
// upload but is still correct.
import { STORAGE_STATE, baseUrl } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'
import { createProjectCache } from '@utils/shared-project.js'
import { CreateProjectFlow } from '@flows/project-management/create-project.flow.js'
import { UploadBaselineFileFlow } from '@flows/upload-baseline/upload-baseline-file.flow.js'
import { UploadPostInterventionFileFlow } from '@flows/upload-post-intervention/upload-post-intervention-file.flow.js'
import { ProjectDashboardPage } from '@pages/project-dashboard.page.js'

const PROJECT_LABEL = 'Project summary test'

// 50 habitat parcels, 25 urban trees and 3 rivers, but an EMPTY Hedgerows
// layer. That mix is deliberate: since BMD-854 a unit type with no features
// renders no section and no nav item, so this one fixture witnesses both
// branches of the visibility rule at once.
export const NO_HEDGEROWS_FILE = 'Baseline - no hedgerows.gpkg'

// 120 habitat parcels, 60 urban trees, 40 hedgerows and 8 rivers — the only
// baseline fixture that populates every unit type at once, so it is what the
// hedgerow and watercourse pages need.
export const ALL_UNIT_TYPES_FILE =
  'Baseline - all unit and intervention types.gpkg'

// A post-intervention file carrying hedgerows, uploaded over a baseline that has
// none. That pairing is the only route to BMD-897's post-intervention-ONLY
// variant: a unit type with nothing to compare against.
export const HEDGEROWS_PI_FILE =
  'Post-intervention - complete with hedgerows.gpkg'

// The post-intervention half of the all-unit-types pair: baseline AND
// post-intervention data for every habitat type, with a net LOSS on each. On a
// unit-type summary that is the targets section's shortfall branch — the
// deficit is a real subtraction rather than the whole requirement or zero.
export const ALL_UNIT_TYPES_PI_FILE =
  'Post-intervention - all unit and intervention types.gpkg'

// harness intervention/watercourse-created-* — hedgerows gain ~64% and
// watercourses ~21%, so both linear types clear the 10% target. One pair
// therefore covers the zero-deficit branch for either of them.
export const TARGET_MET_BASELINE_FILE = 'Baseline - linear net gain met.gpkg'
export const TARGET_MET_PI_FILE = 'Post-intervention - linear net gain met.gpkg'

// A baseline with 16 hedgerows and NO rivers, paired below with a
// post-intervention file that has watercourses — the watercourse equivalent of
// the hedgerow pairing above, and the only route to BMD-897's
// post-intervention-only variant for that unit type.
export const NO_WATERCOURSES_FILE = 'Baseline - no watercourses.gpkg'
export const WATERCOURSES_PI_FILE =
  'Post-intervention - complete with watercourses.gpkg'

// 12 habitat parcels, a red line boundary, and nothing else — no Hedgerows and
// no Rivers layer at all. The only shipped post-intervention fixture empty for
// BOTH linear types, which is what makes BMD-898's "no hedgerows/watercourses
// in baseline OR PI" reachable: `projectHasHabitatData` is an OR across the two
// documents, so suppressing a unit type on a both-documents project needs a PI
// file that is also empty for it. Paired the other way — the "complete with
// hedgerows/watercourses" files above — the same baselines drive the OR true
// and render BMD-897's post-intervention-only variant instead.
export const NO_LINEAR_PI_FILE = 'Post-intervention - complete.gpkg'

const UPLOAD_TIMEOUT = 120_000

async function buildBaselineOnlyProject(browser, file) {
  const context = await browser.newContext({
    storageState: STORAGE_STATE,
    baseURL: baseUrl
  })
  const page = await context.newPage()
  try {
    const { id, name } = await setupProject(
      new CreateProjectFlow(page),
      new ProjectDashboardPage(page),
      PROJECT_LABEL
    )
    await new UploadBaselineFileFlow(page).uploadFileAndWaitForSummary(id, file)
    return { id, name }
  } finally {
    await context.close()
  }
}

// Two uploads rather than one, so these are shared harder still: one build per
// fixture PAIR, per worker.
async function buildPostInterventionProject(browser, baselineFile, piFile) {
  const context = await browser.newContext({
    storageState: STORAGE_STATE,
    baseURL: baseUrl
  })
  const page = await context.newPage()
  try {
    const { id, name } = await setupProject(
      new CreateProjectFlow(page),
      new ProjectDashboardPage(page),
      PROJECT_LABEL
    )
    await new UploadBaselineFileFlow(page).uploadFileAndWaitForSummary(
      id,
      baselineFile
    )
    await new UploadPostInterventionFileFlow(page).uploadFile(id, piFile)
    await page.waitForURL(
      new RegExp(`/projects/${id}/post-intervention-habitat-list`),
      { timeout: UPLOAD_TIMEOUT }
    )
    return { id, name }
  } finally {
    await context.close()
  }
}

const getOrBuildProject = createProjectCache()

function projectKey(baselineFile, piFile) {
  return `${baselineFile}+${piFile ?? 'none'}`
}

/**
 * A project with a baseline and no post-intervention data, built from
 * NO_HEDGEROWS_FILE. Shared across every spec that imports this module.
 *
 * @param {import('@playwright/test').Browser} browser
 * @returns {Promise<{id: string, name: string}>}
 */
export function getBaselineOnlyProject(browser) {
  return getOrBuildProject(projectKey(NO_HEDGEROWS_FILE), () =>
    buildBaselineOnlyProject(browser, NO_HEDGEROWS_FILE)
  )
}

/** A baseline-only project populating every unit type. */
export function getAllUnitTypesProject(browser) {
  return getOrBuildProject(projectKey(ALL_UNIT_TYPES_FILE), () =>
    buildBaselineOnlyProject(browser, ALL_UNIT_TYPES_FILE)
  )
}

/**
 * A project whose hedgerows exist ONLY post-intervention — baseline from
 * NO_HEDGEROWS_FILE, post-intervention from HEDGEROWS_PI_FILE. The witness for
 * BMD-897's post-intervention-only variant.
 */
export function getHedgerowGainProject(browser) {
  return getOrBuildProject(
    projectKey(NO_HEDGEROWS_FILE, HEDGEROWS_PI_FILE),
    () =>
      buildPostInterventionProject(
        browser,
        NO_HEDGEROWS_FILE,
        HEDGEROWS_PI_FILE
      )
  )
}

/**
 * A project carrying baseline AND post-intervention data for every unit type,
 * every one of them a net loss. Shared by the project summary and the
 * unit-type drill-downs: on the summary it is the populated post-intervention
 * variant, on a drill-down it is the targets section's shortfall branch.
 */
export function getAllUnitTypesPostInterventionProject(browser) {
  return getOrBuildProject(
    projectKey(ALL_UNIT_TYPES_FILE, ALL_UNIT_TYPES_PI_FILE),
    () =>
      buildPostInterventionProject(
        browser,
        ALL_UNIT_TYPES_FILE,
        ALL_UNIT_TYPES_PI_FILE
      )
  )
}

/**
 * A project whose linear unit types both clear the 10% net-gain target — the
 * only pairing that drives a unit-type summary's deficit to zero from a
 * NON-zero baseline. (The post-intervention-only projects above reach 0.00 the
 * degenerate way, with nothing required in the first place.)
 */
export function getTargetMetProject(browser) {
  return getOrBuildProject(
    projectKey(TARGET_MET_BASELINE_FILE, TARGET_MET_PI_FILE),
    () =>
      buildPostInterventionProject(
        browser,
        TARGET_MET_BASELINE_FILE,
        TARGET_MET_PI_FILE
      )
  )
}

/**
 * A project whose watercourses exist ONLY post-intervention. Mirrors
 * getHedgerowGainProject for the other linear unit type — each controller
 * passes its own habitat-type string to hasPostInterventionOnlyHabitat, so a
 * witness for one does not cover the other.
 */
export function getWatercourseGainProject(browser) {
  return getOrBuildProject(
    projectKey(NO_WATERCOURSES_FILE, WATERCOURSES_PI_FILE),
    () =>
      buildPostInterventionProject(
        browser,
        NO_WATERCOURSES_FILE,
        WATERCOURSES_PI_FILE
      )
  )
}

/**
 * A baseline-only project with 16 hedgerows and NO rivers — the mirror of
 * `getBaselineOnlyProject` for the other linear unit type. BMD-898 AC3.
 */
export function getNoWatercoursesProject(browser) {
  return getOrBuildProject(projectKey(NO_WATERCOURSES_FILE), () =>
    buildBaselineOnlyProject(browser, NO_WATERCOURSES_FILE)
  )
}

/**
 * A project carrying both documents with hedgerows in NEITHER. BMD-898 AC2.
 * Watercourses survive on the baseline's rivers, so this project also witnesses
 * the OR being honoured on its baseline side.
 */
export function getNoHedgerowsPostInterventionProject(browser) {
  return getOrBuildProject(
    projectKey(NO_HEDGEROWS_FILE, NO_LINEAR_PI_FILE),
    () =>
      buildPostInterventionProject(
        browser,
        NO_HEDGEROWS_FILE,
        NO_LINEAR_PI_FILE
      )
  )
}

/**
 * A project carrying both documents with watercourses in NEITHER. BMD-898 AC4,
 * and the mirror of the above — hedgerows survive on the baseline's 16.
 */
export function getNoWatercoursesPostInterventionProject(browser) {
  return getOrBuildProject(
    projectKey(NO_WATERCOURSES_FILE, NO_LINEAR_PI_FILE),
    () =>
      buildPostInterventionProject(
        browser,
        NO_WATERCOURSES_FILE,
        NO_LINEAR_PI_FILE
      )
  )
}

export { buildBaselineOnlyProject, buildPostInterventionProject }
