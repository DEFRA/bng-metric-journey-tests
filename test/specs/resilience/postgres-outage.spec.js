import { test } from '@fixtures'
import { STORAGE_STATE, runMode } from '@utils/env.js'
import { assertHandlesOutage } from '@utils/resilience-checks.js'

const POSTGRES = 'postgres'

test.describe('resilience', { tag: '@resilience' }, () => {
  test.describe(
    'Postgres outage — project dashboard',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(
        runMode === 'e2e',
        'Requires Toxiproxy in the Docker Compose stack — not available on CDP'
      )

      test('Postgres refusing connections shows the error page, then recovers', async ({
        toxiproxy,
        createProjectFlow,
        projectDashboardPage,
        serviceErrorPage,
        page
      }) => {
        await assertHandlesOutage({
          injectFault: () => toxiproxy.takeDown(POSTGRES),
          toxiproxy,
          createProjectFlow,
          projectDashboardPage,
          serviceErrorPage,
          page
        })
      })

      test('Postgres not answering shows the error page without hanging, then recovers', async ({
        toxiproxy,
        createProjectFlow,
        projectDashboardPage,
        serviceErrorPage,
        page
      }) => {
        await assertHandlesOutage({
          injectFault: () => toxiproxy.hang(POSTGRES),
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
