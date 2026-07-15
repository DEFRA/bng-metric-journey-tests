import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@fixtures'
import { STORAGE_STATE } from '@utils/env.js'

/**
 * Happy-path screenshot capture for UCD (Mural UI flow).
 *
 * Not a regression test: excluded from the normal suite by the main config's
 * testIgnore and run only via `npm run screenshots`
 * (playwright.screenshots.config.js). See
 * test/flows/happy-path/capture-happy-path.flow.md for the screen list.
 */

const OUTPUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'output/happy-path'
)

const PROJECT_LABEL = 'Happy path screenshots'
const UPLOAD_TIMEOUT = 120_000
const BASELINE_FILE = 'Baseline - complete with area refs.gpkg'
const POST_INTERVENTION_FILE = 'Post-intervention - complete.gpkg'

// Journey-order index shared by both tests below (the signed-out home capture
// and the authenticated journey run sequentially on the single worker).
let step = 0

async function snap(page, name) {
  step += 1
  const prefix = String(step).padStart(2, '0')
  await page.screenshot({
    path: path.join(OUTPUT_DIR, `${prefix}-${name}.png`),
    fullPage: true
  })
}

test.describe('happy-path-screenshots', { tag: '@screenshots' }, () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true })
    await fs.mkdir(OUTPUT_DIR, { recursive: true })
  })

  test.describe('Signed out', () => {
    test('captures the home page', async ({ homePage, page }) => {
      await homePage.open()
      await expect(homePage.heading).toBeVisible()
      await snap(page, 'home')
    })
  })

  test.describe('Authenticated journey', () => {
    test.use({ storageState: STORAGE_STATE })

    test('captures every screen of the happy path in order', async ({
      projectDashboardPage,
      defineProjectNamePage,
      projectTaskListPage,
      uploadBaselineFilePage,
      uploadBaselineFileFlow,
      habitatListPage,
      baselineHabitatDetailsPage,
      uploadPostInterventionFilePage,
      uploadPostInterventionFileFlow,
      postInterventionHabitatListPage,
      page
    }) => {
      const projectName = `${PROJECT_LABEL} ${Date.now()}`

      // ── Define project name ─────────────────────────────────────────────
      await projectDashboardPage.open()
      // A user with no projects is redirected straight to /project-name;
      // otherwise reach it via the Create project button.
      if (!page.url().includes('/project-name')) {
        await projectDashboardPage.createProjectButton.click()
      }
      await defineProjectNamePage.enterProjectName(projectName)
      await snap(page, 'project-name')
      await defineProjectNamePage.submit()

      // ── Project dashboard listing the new project ───────────────────────
      await expect(projectDashboardPage.heading).toBeVisible()
      await expect(projectDashboardPage.projectLink(projectName)).toBeVisible()
      await snap(page, 'manage-projects')

      const href = await projectDashboardPage
        .projectLink(projectName)
        .getAttribute('href')
      const id = href.split('/').pop()

      // ── Project task list (initial statuses) ────────────────────────────
      await projectDashboardPage.projectLink(projectName).click()
      await expect(projectTaskListPage.heading).toBeVisible()
      await snap(page, 'add-project-details')

      // ── Upload baseline file ────────────────────────────────────────────
      await uploadBaselineFilePage.open(id)
      await uploadBaselineFilePage.fileInput.setInputFiles(
        uploadBaselineFileFlow.filePath(BASELINE_FILE)
      )
      await snap(page, 'upload-baseline-file')
      await uploadBaselineFilePage.continueButton.click()

      // ── Checking your file (transient processing page) ──────────────────
      await page.waitForURL(/\/upload-received/, { timeout: UPLOAD_TIMEOUT })
      // The page meta-refreshes away as soon as the scan completes — a capture
      // interrupted by that redirect leaves a numbering gap instead of failing.
      await snap(page, 'checking-your-file').catch(() => {})

      // ── Baseline habitat list ───────────────────────────────────────────
      await page.waitForURL(
        new RegExp(`/projects/${id}/baseline-habitat-list`),
        { timeout: UPLOAD_TIMEOUT }
      )
      await expect(habitatListPage.heading).toBeVisible()
      await expect(habitatListPage.firstAreaHabitatLink).toBeVisible()
      await snap(page, 'baseline-habitat-list')

      // ── Baseline habitat details ────────────────────────────────────────
      await habitatListPage.firstAreaHabitatLink.click()
      await expect(baselineHabitatDetailsPage.heading).toBeVisible()
      await expect(
        baselineHabitatDetailsPage.baselineDetailsHeading
      ).toBeVisible()
      await snap(page, 'baseline-habitat-details')
      await baselineHabitatDetailsPage.saveButton.click()
      await page.waitForURL(new RegExp(`/projects/${id}/baseline-habitat-list`))

      // ── Upload post-intervention file ───────────────────────────────────
      await uploadPostInterventionFilePage.open(id)
      await uploadPostInterventionFilePage.fileInput.setInputFiles(
        uploadPostInterventionFileFlow.filePath(POST_INTERVENTION_FILE)
      )
      await snap(page, 'upload-post-intervention-file')
      await uploadPostInterventionFilePage.continueButton.click()

      // ── Post-intervention habitat list ──────────────────────────────────
      await page.waitForURL(
        new RegExp(`/projects/${id}/post-intervention-habitat-list`),
        { timeout: UPLOAD_TIMEOUT }
      )
      await expect(postInterventionHabitatListPage.heading).toBeVisible()
      await expect(postInterventionHabitatListPage.summaryHeading).toBeVisible()
      await snap(page, 'post-intervention-habitat-list')

      // ── Project task list (Completed statuses) ──────────────────────────
      await projectTaskListPage.open(id)
      // Project Name + On-site baseline + On-site post intervention Completed;
      // Project Details remains Not yet started.
      await expect(projectTaskListPage.taskStatus('Completed')).toHaveCount(3)
      await snap(page, 'add-project-details-complete')
    })
  })
})
