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

      // FIXME(BMD-1200): known defect 1 on that ticket. A
      // signed-in page never responds while Redis is not answering, because the
      // frontend's redis-client.js sets no command timeout. It currently fails
      // at the navigation timeout. test.fail rather than test.fixme so it keeps
      // running: it shows this suite detects a hang, and it goes red ("expected
      // to fail") once the defect is fixed, which is the cue to make it a plain
      // test. test.fail accepts ANY failure, so when touching this test, run it
      // as a plain test and check it still fails on page.goto.
      test.fail(
        'Redis not answering shows the error page without hanging, then recovers',
        async ({
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
        }
      )
    }
  )
})
