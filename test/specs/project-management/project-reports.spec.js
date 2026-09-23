import { readFile } from 'node:fs/promises'

import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import {
  describeRoleEnforcement,
  describeUnauthenticatedAccess
} from '@utils/access-checks.js'
import { setupProject } from '@utils/project-helpers.js'
import { getBaselineOnlyProject } from '@utils/summary-projects.js'
import { REPORTS } from '@utils/unit-type-labels.js'
import {
  expectedReportFilename,
  reportPdfPath
} from '@utils/report-navigation.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const PROJECT_LABEL = 'Project reports test'

const PDF_MAGIC = '%PDF-'
const PDF_MAGIC_LENGTH = PDF_MAGIC.length

// Both report routes validate `{id}` as a **uuidv4**, and Hapi runs route
// validation before the `pre` role gate — so the access-check helpers' all-zeros
// default (a valid UUID, but not v4-shaped) would 400 before the gate fires and
// the test would pass for the wrong reason. This id is v4-shaped and belongs to
// nobody.
const V4_PROJECT_ID = '00000000-0000-4000-8000-000000000000'

// The reports page is READ-ONLY: it renders a project that was uploaded once.
// `getBaselineOnlyProject` is shared with project-summary.spec.js and the
// unit-type drill-downs through @utils/summary-projects.js, so in CI (one
// worker) this whole file costs zero additional uploads.
//
// Serial for the same reason those specs are: the shared build must happen once,
// and concurrent uploads clobber the single pendingUploadId yar key.
test.describe('project-management', { tag: '@project-management' }, () => {
  test.describe.configure({ mode: 'serial' })

  // ─── Page content ───────────────────────────────────────────────────────────

  test.describe('Project reports — page content', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    let project
    test.beforeAll(async ({ browser }) => {
      project = await getBaselineOnlyProject(browser)
    })

    // The frontend unit suite covers this page (project-reports/controller.test.js)
    // but mocks `wreck`, so it proves the RENDERING of a hand-written project and
    // not that a real one reaches the page. This is the journey witness for the
    // caption and the download href being built from a real project id.
    test(
      'renders the report description and download button from a real project',
      { tag: '@smoke' },
      async ({ projectReportsPage }) => {
        await projectReportsPage.open(project.id)

        await expect(projectReportsPage.heading).toBeVisible()
        await expect(projectReportsPage.caption(project.name)).toBeVisible()
        await expect(projectReportsPage.siteReportHeading).toBeVisible()

        // The control is a govukButton rendered as an ANCHOR — it has a link
        // role, not a button role. See ProjectReportsPage's class note.
        await expect(projectReportsPage.downloadLink).toBeVisible()
        await expect(projectReportsPage.downloadLink).toHaveAttribute(
          'href',
          reportPdfPath(project.id)
        )
        await expect(projectReportsPage.downloadLink).toHaveAttribute(
          'download',
          ''
        )
      }
    )

    // The navigation landmark on THIS page is named "Reports", not "Project
    // summary" — project-reports/index.njk is the only template in the service
    // passing a different label to appProjectNavigation. Asserted here so the
    // day it is made consistent, this test says so rather than the page object
    // silently matching nothing.
    test('the navigation landmark is named after the page, not the summary', async ({
      projectReportsPage,
      page
    }) => {
      await projectReportsPage.open(project.id)

      await expect(projectReportsPage.navigation).toBeVisible()
      await expect(
        page.getByRole('navigation', { name: 'Project summary' })
      ).toHaveCount(0)
    })
  })

  // ─── Entry point ────────────────────────────────────────────────────────────

  test.describe('Project reports — entry point', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    let project
    test.beforeAll(async ({ browser }) => {
      project = await getBaselineOnlyProject(browser)
    })

    // The nav item is the ONLY entry point to the site report — BMD-984 added
    // no download button to the project summary itself. `unit-type-navigation.test.js`
    // proves the builder as a pure function; nothing proved the href resolves.
    test(
      'the Reports nav item on the project summary opens the reports page',
      { tag: ['@regression', '@happy-path'] },
      async ({ projectSummaryPage, projectReportsPage, page }) => {
        await projectSummaryPage.open(project.id)

        await projectSummaryPage.navLink(REPORTS).click()

        await expect(page).toHaveURL(
          new RegExp(`/projects/${project.id}/reports`)
        )
        await expect(projectReportsPage.heading).toBeVisible()
      }
    )
  })

  // ─── Download ───────────────────────────────────────────────────────────────

  test.describe('Project reports — site report download', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    let project
    test.beforeAll(async ({ browser }) => {
      project = await getBaselineOnlyProject(browser)
    })

    // Sole witness for the frontend's filename override reaching a real browser.
    // `project-report/controller.js` deliberately DISCARDS the backend's
    // site-derived content-disposition and substitutes an id-based name, rather
    // than forwarding a header built from a user-supplied project name through a
    // second service. The backend integration test
    // (../bng-metric-backend/integration-tests/report.test.js:118) asserts the
    // OPPOSITE name, because it never goes through the frontend — so nothing
    // else can catch this override regressing. Do not delete without adding a
    // frontend-side filename assertion somewhere that runs against a real
    // backend response.
    test(
      'downloads a real PDF named after the project id, not the site',
      { tag: ['@smoke', '@happy-path'] },
      async ({ projectReportsPage }) => {
        await projectReportsPage.open(project.id)

        const download = await projectReportsPage.downloadSiteReport()

        expect(download.suggestedFilename()).toBe(
          expectedReportFilename(project.id)
        )

        // Checked before reading: a failed download resolves `path()` to null,
        // and readFile(null) throws about argument types rather than saying the
        // download never arrived.
        expect(await download.failure()).toBeNull()

        // Real bytes, not an error page served with a PDF content type.
        const bytes = await readFile(await download.path())
        expect(bytes.subarray(0, PDF_MAGIC_LENGTH).toString()).toBe(PDF_MAGIC)
      }
    )
  })

  // ─── Guard redirect ─────────────────────────────────────────────────────────

  test.describe('Project reports — guard redirect', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    // A project with no baseline has nothing to report on. The guard is the same
    // rule as the project summary's but a SEPARATE copy of it in a separate
    // controller, so the summary's witness does not cover this one.
    test('a project with no baseline is redirected to the task list', async ({
      createProjectFlow,
      projectDashboardPage,
      projectReportsPage,
      page
    }) => {
      const { id } = await setupProject(
        createProjectFlow,
        projectDashboardPage,
        PROJECT_LABEL
      )

      await projectReportsPage.open(id)

      await expect(page).toHaveURL(new RegExp(`/add-project-details/${id}`))
    })
  })

  // ─── Cross-user visibility ──────────────────────────────────────────────────
  //
  // Covered in test/specs/project-management/project-summary.spec.js, in the
  // "Project summary — cross-user visibility" describe, rather than here: that
  // test already builds the second browser context and the other user's session
  // this assertion needs, so the report route rides along for two lines instead
  // of paying for a context of its own.

  // ─── Session lifecycle ──────────────────────────────────────────────────────

  test.describe('Project reports — session lifecycle', () => {
    // BLOCKED: `fetchSiteReport` is the only service in the frontend that
    // rethrows on `sessionExpired`, so a dead session on the PDF route reaches
    // the global error handler and redirects to /auth/session-expired instead of
    // surfacing as a generic 502. Driving a genuinely dead, unrefreshable session
    // resets the server-side yar session and poisons the shared STORAGE_STATE for
    // the rest of the run — the same constraint that blocks the interactive
    // trigger in test/flows/authentication/session-expired.flow.md.
    //
    // Unblocking takes TWO steps, not one. First, isolate the session: either
    // give this describe its own storage state rather than the shared one, or
    // add a backend fault-injection hook that can expire a single session on
    // demand. Second, add the expiry itself — the body below only navigates, so
    // removing the skip on its own would run it against a live session and fail
    // on a 200. Whichever mechanism lands, invoke it before the goto.
    test.skip('an expired session on the PDF route is sent to sign in again', async ({
      page
    }) => {
      const response = await page.goto(reportPdfPath(V4_PROJECT_ID))

      expect(response.url()).toContain('/auth/session-expired')
    })
  })

  // ─── Access control ─────────────────────────────────────────────────────────

  // Both routes, because they are separate controllers with separate `pre`
  // arrays — a role gate on one is not a role gate on the other.
  describeRoleEnforcement('Project reports', 'reports', {
    projectId: V4_PROJECT_ID
  })
  describeRoleEnforcement('Project report PDF', 'report.pdf', {
    projectId: V4_PROJECT_ID
  })
  describeUnauthenticatedAccess('Project reports', 'reports', { smoke: false })
})
