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

const LEGACY_RUN = 'legacy'
const SERVICE_TEMPLATE_RUN = 'service-template'

// Tags for a test or describe that belongs to one run only. A spec that runs in
// both and asserts different values chooses them with isServiceTemplateRun().
const LEGACY_ONLY = '@legacy-only'
const SERVICE_TEMPLATE_ONLY = '@service-template-only'

/**
 * Read the flag strictly: `true`, `false` or unset (off). These are the only
 * spellings the two apps read the same way. The backend also takes yes/no,
 * on/off and 1/0, in any case, but the frontend reads every value except
 * `false` as on, so a value such as `0` would leave the apps in different
 * states. Anything else stops the run rather than guessing which stack it is.
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
    return {
      name: SERVICE_TEMPLATE_RUN,
      testIgnore: baseTestIgnore,
      grepInvert: new RegExp(LEGACY_ONLY)
    }
  }
  return {
    name: LEGACY_RUN,
    testIgnore: baseTestIgnore,
    grepInvert: new RegExp(SERVICE_TEMPLATE_ONLY)
  }
}

/**
 * Stop a config whose specs upload only legacy files from running against a
 * flag-on stack, where the service would refuse every upload and each test
 * would fail for that reason rather than its own.
 *
 * @param {string} suite the suite's name, for the message
 */
export function assertLegacyTemplateRun(suite) {
  if (serviceTemplateEnabled) {
    throw new Error(
      `The ${suite} suite uploads legacy files, so it needs a stack with SERVICE_TEMPLATE_ENABLED off; it is "true"`
    )
  }
}

export { LEGACY_ONLY, LEGACY_RUN, SERVICE_TEMPLATE_ONLY, SERVICE_TEMPLATE_RUN }
