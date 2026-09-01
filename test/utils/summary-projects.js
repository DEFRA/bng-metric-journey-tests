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

/**
 * A project with a baseline and no post-intervention data, built from
 * NO_HEDGEROWS_FILE. Shared across every spec that imports this module.
 *
 * @param {import('@playwright/test').Browser} browser
 * @returns {Promise<{id: string, name: string}>}
 */
export function getBaselineOnlyProject(browser) {
  return getOrBuildProject(NO_HEDGEROWS_FILE, () =>
    buildBaselineOnlyProject(browser, NO_HEDGEROWS_FILE)
  )
}

/** A baseline-only project populating every unit type. */
export function getAllUnitTypesProject(browser) {
  return getOrBuildProject(ALL_UNIT_TYPES_FILE, () =>
    buildBaselineOnlyProject(browser, ALL_UNIT_TYPES_FILE)
  )
}

/**
 * A project whose hedgerows exist ONLY post-intervention — baseline from
 * NO_HEDGEROWS_FILE, post-intervention from HEDGEROWS_PI_FILE. The witness for
 * BMD-897's post-intervention-only variant.
 */
export function getHedgerowGainProject(browser) {
  return getOrBuildProject(HEDGEROWS_PI_FILE, () =>
    buildPostInterventionProject(browser, NO_HEDGEROWS_FILE, HEDGEROWS_PI_FILE)
  )
}

export { buildBaselineOnlyProject, buildPostInterventionProject }
