import { test } from '@fixtures'
import { STORAGE_STATE, runMode } from '@utils/env.js'
import {
  assertHandlesOutage,
  TOXIPROXY_SKIP_REASON
} from '@utils/resilience-checks.js'

const REDIS = 'redis'

test.describe('resilience', { tag: '@resilience' }, () => {
  test.describe(
    'Redis outage — project dashboard',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(runMode === 'e2e', TOXIPROXY_SKIP_REASON)

      test('Redis refusing connections shows the error page, then recovers', async ({
        toxiproxy,
        createProjectFlow,
        projectDashboardPage,
        serviceErrorPage,
        page
      }) => {
        await assertHandlesOutage({
          injectFault: () => toxiproxy.takeDown(REDIS),
          toxiproxy,
          createProjectFlow,
          projectDashboardPage,
          serviceErrorPage,
          page
        })
      })

      // The frontend's Redis command timeout (REDIS_COMMAND_TIMEOUT_MS) fails
      // the session read, so the page answers well inside the navigation
      // timeout. Before BMD-1200 there was none, and the page never responded.
      test('Redis not answering shows the error page without hanging, then recovers', async ({
        toxiproxy,
        createProjectFlow,
        projectDashboardPage,
        serviceErrorPage,
        page
      }) => {
        await assertHandlesOutage({
          injectFault: () => toxiproxy.hang(REDIS),
          toxiproxy,
          createProjectFlow,
          projectDashboardPage,
          serviceErrorPage,
          page
        })
      })
    }
  )
})
