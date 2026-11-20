// Which template the suite tests, and so which Playwright project runs.
//
// The service takes one upload template at a time, chosen by its
// SERVICE_TEMPLATE_ENABLED flag: off takes the legacy template only, on takes
// the BNG Service template only. The suite reads the same variable, so one
// setting starts the stack (compose.yml passes it to both apps) and picks the
// run to match it:
//
//   SERVICE_TEMPLATE_ENABLED=false (or unset) → the `legacy` project
//   SERVICE_TEMPLATE_ENABLED=true             → the `service-template` project
//
// The run must match the stack. A mismatched run fails rather than passing:
// the service refuses every upload in the other template.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TEST_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)

const LEGACY_RUN = 'legacy'
const SERVICE_TEMPLATE_RUN = 'service-template'

// Tags for a test or describe that belongs to one run only. A spec that runs in
// both and asserts different values chooses them with isServiceTemplateRun().
const LEGACY_ONLY = '@legacy-only'
const SERVICE_TEMPLATE_ONLY = '@service-template-only'

// Spec files the service-template run leaves out, as a whole, because they
// upload legacy fixtures or assert legacy values and have no new-template
// version yet. Each entry comes off this list when its spec gains the
// new-template fixtures and assertions. The legacy run ignores this list.
const LEGACY_ONLY_SPECS = [
  'specs/habitat-details/baseline-habitat-details.spec.js',
  'specs/habitat-details/post-intervention-habitat-details.spec.js',
  'specs/project-management/area-baseline.spec.js',
  'specs/project-management/area-post-intervention.spec.js',
  'specs/project-management/area-summary.spec.js',
  'specs/project-management/area-trading-summary.spec.js',
  'specs/project-management/hedgerows-baseline.spec.js',
  'specs/project-management/hedgerows-post-intervention.spec.js',
  'specs/project-management/hedgerows-summary.spec.js',
  'specs/project-management/hedgerows-trading-summary.spec.js',
  'specs/project-management/project-details.spec.js',
  'specs/project-management/project-reports.spec.js',
  'specs/project-management/project-summary.spec.js',
  'specs/project-management/watercourses-baseline.spec.js',
  'specs/project-management/watercourses-post-intervention.spec.js',
  'specs/project-management/watercourses-summary.spec.js',
  'specs/project-management/watercourses-trading-summary.spec.js',
  'specs/upload-baseline/upload-baseline-file.spec.js',
  'specs/upload-baseline/upload-baseline.spec.js',
  'specs/upload-file/upload-file.spec.js',
  'specs/upload-post-intervention/upload-post-intervention-file.spec.js',
  'specs/upload-post-intervention/upload-post-intervention.spec.js'
]

/**
 * Read the flag as the backend does: `true`, `false` or unset (off). Anything
 * else is a mistake, and guessing would run the suite against the wrong stack.
 *
 * @param {string | undefined} value
 * @returns {boolean}
 */
function parseFlag(value) {
  if (value === undefined || value === '' || value === 'false') {
    return false
  }
  if (value === 'true') {
    return true
  }
  throw new Error(
    `SERVICE_TEMPLATE_ENABLED must be "true" or "false", not "${value}"`
  )
}

const serviceTemplateEnabled = parseFlag(process.env.SERVICE_TEMPLATE_ENABLED)

export const templateRun = serviceTemplateEnabled
  ? SERVICE_TEMPLATE_RUN
  : LEGACY_RUN

/**
 * Whether this run tests the BNG Service template (the flag is on).
 *
 * @returns {boolean}
 */
export function isServiceTemplateRun() {
  return serviceTemplateEnabled
}

/**
 * Fail on an entry that names no spec, such as one renamed or moved since it
 * was listed. The service-template run would otherwise quietly start running
 * a legacy-only spec under its new name.
 */
function assertLegacyOnlySpecsExist() {
  const missing = LEGACY_ONLY_SPECS.filter(
    (spec) => !fs.existsSync(path.join(TEST_DIR, spec))
  )
  if (missing.length > 0) {
    throw new Error(
      `LEGACY_ONLY_SPECS in test/utils/template-run.js names specs that do not exist: ${missing.join(', ')}`
    )
  }
}

/**
 * The Playwright project for this run. Only the project that matches the
 * stack is defined, so a plain `playwright test` never runs the other one.
 *
 * A project's testIgnore replaces the config's, so the config passes its own
 * in to be kept.
 *
 * @param {string[]} baseTestIgnore the config's testIgnore globs
 * @returns {import('@playwright/test').Project}
 */
export function templateRunProject(baseTestIgnore) {
  if (serviceTemplateEnabled) {
    assertLegacyOnlySpecsExist()
    return {
      name: SERVICE_TEMPLATE_RUN,
      testIgnore: [
        ...baseTestIgnore,
        ...LEGACY_ONLY_SPECS.map((spec) => `**/${spec}`)
      ],
      grepInvert: new RegExp(LEGACY_ONLY)
    }
  }
  return {
    name: LEGACY_RUN,
    testIgnore: baseTestIgnore,
    grepInvert: new RegExp(SERVICE_TEMPLATE_ONLY)
  }
}

export {
  LEGACY_ONLY,
  LEGACY_ONLY_SPECS,
  LEGACY_RUN,
  SERVICE_TEMPLATE_ONLY,
  SERVICE_TEMPLATE_RUN
}
