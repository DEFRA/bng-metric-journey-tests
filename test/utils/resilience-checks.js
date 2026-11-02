import { expect } from '@fixtures'
import { ServiceErrorPage } from '@pages/service-error.page.js'
import { setupProject } from './project-helpers.js'

const PROJECT_LABEL = 'Resilience'
const MAX_RECOVERY_MS = 15_000
// Must stay well under MAX_RECOVERY_MS: each attempt has to give up on an error
// page in time to reload, or the first attempt spends the whole budget waiting
// on a page that will never change.
const RECOVERY_ATTEMPT_MS = 2_000

/**
 * Assert a signed-in user gets the error page while a dependency has a fault,
 * then reads their project again once it clears, without restarting anything.
 *
 * The bound on how long the error page may take is `navigationTimeout` in
 * playwright.resilience.config.js, so a page that hangs fails at that point
 * rather than at the test timeout. The status code is deliberately not
 * asserted — see test/flows/resilience/downstream-failures.flow.md.
 */
export async function assertHandlesOutage({
  injectFault,
  toxiproxy,
  createProjectFlow,
  projectDashboardPage,
  serviceErrorPage,
  page
}) {
  const { name } = await setupProject(
    createProjectFlow,
    projectDashboardPage,
    PROJECT_LABEL
  )

  await injectFault()

  await projectDashboardPage.open()
  await expect(page).toHaveTitle(ServiceErrorPage.title)
  await expect(serviceErrorPage.message).toBeVisible()

  await toxiproxy.reset()

  await expect(async () => {
    await projectDashboardPage.open()
    await expect(projectDashboardPage.projectLink(name)).toBeVisible({
      timeout: RECOVERY_ATTEMPT_MS
    })
  }).toPass({ timeout: MAX_RECOVERY_MS })
}
