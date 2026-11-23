import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@fixtures'
import { projectIdFromHref } from '@utils/project-helpers.js'
import { STORAGE_STATE } from '@utils/env.js'
import { PROJECT_DETAILS } from '@pages/project-details.page.js'

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
const INTERVENTION_TABS = ['Retained', 'Enhanced', 'Created']

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

// The processing page meta-refreshes to the project summary as soon as the
// scan completes, so it may be gone before the capture. Waiting for either
// page never blocks on one that has passed, and a missed page still takes its
// index, leaving a numbering gap rather than shifting later screens.
async function snapProcessingPage(page, processingUrl, summaryUrl, name) {
  await page.waitForURL(
    (url) => processingUrl.test(url.pathname) || summaryUrl.test(url.pathname),
    { timeout: UPLOAD_TIMEOUT }
  )
  if (processingUrl.test(new URL(page.url()).pathname)) {
    await snap(page, name).catch(() => {})
  } else {
    step += 1
  }
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
      projectSummaryPage,
      uploadFilePage,
      uploadBaselineFilePage,
      uploadBaselineFileFlow,
      areaBaselinePage,
      baselineHabitatDetailsPage,
      uploadPostInterventionFilePage,
      uploadPostInterventionFileFlow,
      areaPostInterventionPage,
      postInterventionHabitatDetailsPage,
      projectDetailsPage,
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
      const id = projectIdFromHref(href)

      // ── Choose upload type ──────────────────────────────────────────────
      // BMD-1076: the dashboard row links to the summary, which redirects a
      // project with no baseline here.
      await projectDashboardPage.projectLink(projectName).click()
      await expect(uploadFilePage.heading).toBeVisible()
      await snap(page, 'upload-file')
      await uploadFilePage.selectBaseline()
      await uploadFilePage.submit()

      // ── Upload baseline file ────────────────────────────────────────────
      await expect(uploadBaselineFilePage.instructionText).toBeVisible()
      await uploadBaselineFilePage.fileInput.setInputFiles(
        uploadBaselineFileFlow.filePath(BASELINE_FILE)
      )
      await snap(page, 'upload-baseline-file')
      await uploadBaselineFilePage.continueButton.click()

      // ── Checking your file (transient processing page) ──────────────────
      const summaryUrl = new RegExp(`/projects/${id}/project-summary`)
      await snapProcessingPage(
        page,
        /\/upload-received$/,
        summaryUrl,
        'checking-your-file'
      )

      // ── Project summary with baseline results ───────────────────────────
      await page.waitForURL(summaryUrl, {
        timeout: UPLOAD_TIMEOUT
      })
      await expect(projectSummaryPage.heading).toBeVisible()
      await snap(page, 'project-summary-baseline')

      // ── Area habitats baseline ──────────────────────────────────────────
      await areaBaselinePage.open(id)
      const firstAreaHabitatLink = areaBaselinePage
        .table()
        .getByRole('link')
        .first()
      await expect(firstAreaHabitatLink).toBeVisible()
      await snap(page, 'area-baseline')

      // ── Baseline habitat details ────────────────────────────────────────
      await firstAreaHabitatLink.click()
      await expect(baselineHabitatDetailsPage.heading).toBeVisible()
      await expect(
        baselineHabitatDetailsPage.baselineDetailsHeading
      ).toBeVisible()
      await snap(page, 'baseline-habitat-details')
      await baselineHabitatDetailsPage.saveButton.click()
      await page.waitForURL(new RegExp(`/projects/${id}/area-baseline`))

      // ── Choose upload type, post intervention ───────────────────────────
      // The summary's Upload file button leads back to the selection page;
      // the user picks a type for each upload.
      await projectSummaryPage.open(id)
      await projectSummaryPage.uploadFileButton.click()
      await expect(uploadFilePage.heading).toBeVisible()
      await uploadFilePage.selectPostIntervention()
      await snap(page, 'upload-file-post-intervention')
      await uploadFilePage.submit()

      // ── Upload post-intervention file ───────────────────────────────────
      await expect(uploadPostInterventionFilePage.instructionText).toBeVisible()
      await uploadPostInterventionFilePage.fileInput.setInputFiles(
        uploadPostInterventionFileFlow.filePath(POST_INTERVENTION_FILE)
      )
      await snap(page, 'upload-post-intervention-file')
      await uploadPostInterventionFilePage.continueButton.click()

      // ── Checking your file, post intervention (transient) ───────────────
      await snapProcessingPage(
        page,
        /\/post-intervention-upload-received$/,
        summaryUrl,
        'checking-your-file-post-intervention'
      )

      // ── Project summary with post-intervention results ──────────────────
      await page.waitForURL(summaryUrl, {
        timeout: UPLOAD_TIMEOUT
      })
      await expect(projectSummaryPage.heading).toBeVisible()
      await snap(page, 'project-summary-complete')

      // ── Area habitats post intervention ─────────────────────────────────
      await areaPostInterventionPage.open(id)
      await expect(areaPostInterventionPage.heading).toBeVisible()
      await snap(page, 'area-post-intervention')

      // ── Post-intervention habitat details, one per intervention tab ─────
      // Each tab's first habitat opens its own page: the Retained reference
      // form, and the Enhanced and Created edit forms.
      for (const label of INTERVENTION_TABS) {
        await areaPostInterventionPage.tab(label).click()
        await areaPostInterventionPage
          .table(label)
          .getByRole('link')
          .first()
          .click()
        await expect(
          postInterventionHabitatDetailsPage.habitatReferenceInput
        ).toBeVisible()
        await snap(
          page,
          `post-intervention-habitat-details-${label.toLowerCase()}`
        )
        await areaPostInterventionPage.open(id)
      }

      // ── Project details, from the left navigation ───────────────────────
      await areaPostInterventionPage.navLink(PROJECT_DETAILS).click()
      await expect(projectDetailsPage.heading).toBeVisible()
      await snap(page, 'project-details')
    })
  })
})
