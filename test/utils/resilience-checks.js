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
 * Assert the generic error page is showing. The status code is deliberately not
 * asserted — see test/flows/resilience/downstream-failures.flow.md.
 *
 * Pass `timeout` when the error arrives after polling rather than on the
 * navigation, as it does during the file check. Otherwise the bound is
 * `navigationTimeout` in playwright.resilience.config.js.
 */
export async function assertErrorPage(
  page,
  serviceErrorPage,
  { timeout } = {}
) {
  await expect(page).toHaveTitle(ServiceErrorPage.title, { timeout })
  await expect(serviceErrorPage.message).toBeVisible()
}

/**
 * Assert a page works again after a fault clears, without restarting anything.
 * Reloads between attempts, because a dependency can take a moment to reconnect.
 */
export async function assertRecovers(open, readyLocator) {
  await expect(async () => {
    await open()
    await expect(readyLocator).toBeVisible({ timeout: RECOVERY_ATTEMPT_MS })
  }).toPass({ timeout: MAX_RECOVERY_MS })
}

/**
 * Assert a signed-in user gets the error page on the project dashboard while a
 * dependency has a fault, then reads their project again once it clears.
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
  await assertErrorPage(page, serviceErrorPage)

  await toxiproxy.reset()

  await assertRecovers(
    () => projectDashboardPage.open(),
    projectDashboardPage.projectLink(name)
  )
}
