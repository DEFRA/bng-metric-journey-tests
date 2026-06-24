import { test, expect } from '@fixtures'
import { STORAGE_STATE, NO_ROLE_STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const UPLOAD_TIMEOUT = 120_000
const COMPLETE_POST_INTERVENTION_FILE = 'Post-intervention - complete.gpkg'
const HTTP_BAD_REQUEST = 400
const VALID_UUID_V4 = 'aaaaaaaa-bbbb-4ccc-bddd-eeeeeeeeeeee'
const STUB_PROJECT_ID = '00000000-0000-0000-0000-000000000000'
const PROJECT_LABEL = 'Post-intervention habitat list test'

async function uploadAndNavigateToHabitatList(
  createProjectFlow,
  projectDashboardPage,
  uploadPostInterventionFileFlow,
  page,
  label
) {
  const { id, name } = await setupProject(
    createProjectFlow,
    projectDashboardPage,
    label
  )
  await uploadPostInterventionFileFlow.uploadFile(
    id,
    COMPLETE_POST_INTERVENTION_FILE
  )
  await page.waitForURL(
    new RegExp(`/projects/${id}/post-intervention-habitat-list`),
    { timeout: UPLOAD_TIMEOUT }
  )
  return { id, name }
}

test.describe(
  'post-intervention-habitat-list',
  { tag: '@habitat-list' },
  () => {
    test.describe(
      'Post-intervention habitat list — page display',
      { tag: '@smoke' },
      () => {
        test.use({ storageState: STORAGE_STATE })
        test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

        test('page renders header, summary section and buttons after upload', async ({
          createProjectFlow,
          projectDashboardPage,
          uploadPostInterventionFileFlow,
          postInterventionHabitatListPage,
          page
        }) => {
          const { name } = await uploadAndNavigateToHabitatList(
            createProjectFlow,
            projectDashboardPage,
            uploadPostInterventionFileFlow,
            page,
            PROJECT_LABEL
          )

          // AC1: page header — back button, project name, H1 title
          await expect(postInterventionHabitatListPage.backLink).toBeVisible()
          await expect(postInterventionHabitatListPage.caption).toHaveText(name)
          await expect(postInterventionHabitatListPage.heading).toBeVisible()
          await expect(postInterventionHabitatListPage.heading).not.toBeEmpty()

          // AC2: summary section — header, column headings, row labels
          await expect(
            postInterventionHabitatListPage.summaryHeading
          ).toBeVisible()
          await expect(
            postInterventionHabitatListPage.summaryTable
          ).toBeVisible()
          for (const col of [
            'Unit type',
            'Size',
            'Baseline units',
            'Post-intervention units',
            'Net unit change',
            'Net % change',
            'Trading rules satisfied'
          ]) {
            await expect(
              postInterventionHabitatListPage.summaryTable.getByRole(
                'columnheader',
                { name: col }
              )
            ).toBeVisible()
          }
          await expect(
            postInterventionHabitatListPage.summaryTable
              .getByRole('row')
              .filter({ hasText: 'Area habitats' })
          ).toBeVisible()
          await expect(
            postInterventionHabitatListPage.summaryTable
              .getByRole('row')
              .filter({ hasText: 'Hedgerows' })
          ).toBeVisible()
          await expect(
            postInterventionHabitatListPage.summaryTable
              .getByRole('row')
              .filter({ hasText: 'Watercourses' })
          ).toBeVisible()

          // AC4: Continue button
          await expect(
            postInterventionHabitatListPage.continueButton
          ).toBeVisible()

          // AC5: secondary upload button
          await expect(
            postInterventionHabitatListPage.uploadDifferentFileButton
          ).toBeVisible()
        })
      }
    )

    test.describe(
      'Post-intervention habitat list — tab interaction',
      { tag: '@regression' },
      () => {
        test.use({ storageState: STORAGE_STATE })
        test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

        test('3 tabs are displayed and tab-switching updates the selected tab', async ({
          createProjectFlow,
          projectDashboardPage,
          uploadPostInterventionFileFlow,
          postInterventionHabitatListPage,
          page
        }) => {
          await uploadAndNavigateToHabitatList(
            createProjectFlow,
            projectDashboardPage,
            uploadPostInterventionFileFlow,
            page,
            PROJECT_LABEL
          )

          // AC3: 3 tabs — Areas, Hedgerows, Watercourses
          await expect(postInterventionHabitatListPage.areasTab).toBeVisible()
          await expect(
            postInterventionHabitatListPage.hedgerowsTab
          ).toBeVisible()
          await expect(
            postInterventionHabitatListPage.watercoursesTab
          ).toBeVisible()

          await postInterventionHabitatListPage.hedgerowsTab.click()
          await expect(
            postInterventionHabitatListPage.hedgerowsTab
          ).toHaveAttribute('aria-selected', 'true')
          await expect(
            postInterventionHabitatListPage.areasTab
          ).toHaveAttribute('aria-selected', 'false')

          await postInterventionHabitatListPage.watercoursesTab.click()
          await expect(
            postInterventionHabitatListPage.watercoursesTab
          ).toHaveAttribute('aria-selected', 'true')
          await expect(
            postInterventionHabitatListPage.hedgerowsTab
          ).toHaveAttribute('aria-selected', 'false')
        })
      }
    )

    test.describe(
      'Post-intervention habitat list — route parameter validation',
      { tag: '@regression' },
      () => {
        test.use({ storageState: STORAGE_STATE })
        test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

        test('non-UUID id path param returns 400', async ({ page }) => {
          const response = await page.goto(
            '/projects/not-a-uuid/post-intervention-habitat-list'
          )
          expect(response.status()).toBe(HTTP_BAD_REQUEST)
        })
      }
    )

    test.describe('Post-intervention habitat list — role enforcement', () => {
      test.use({ storageState: NO_ROLE_STORAGE_STATE })
      test.skip(skipInE2e(NO_ROLE_STORAGE_STATE), E2E_SKIP_REASON)

      test(
        'authenticated user without BNG Completer role is redirected to /auth/forbidden',
        { tag: '@smoke' },
        async ({ page }) => {
          await page.goto(
            `/projects/${VALID_UUID_V4}/post-intervention-habitat-list`
          )
          await expect(page).toHaveURL(/\/auth\/forbidden/)
        }
      )
    })

    test.describe('Post-intervention habitat list — unauthenticated access', () => {
      test(
        'GET /projects/{id}/post-intervention-habitat-list redirects to sign-in',
        { tag: '@smoke' },
        async ({ page }) => {
          await page.goto(
            `/projects/${STUB_PROJECT_ID}/post-intervention-habitat-list`
          )
          await expect(page).not.toHaveURL(/\/post-intervention-habitat-list/)
          await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
        }
      )
    })
  }
)
