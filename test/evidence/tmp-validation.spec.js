import { test, expect } from '@fixtures'
import { STORAGE_STATE } from '@utils/env.js'

const EVIDENCE = 'test/evidence/2026-05-09'

test.describe('AC Validation — Project Dashboard: List Projects', () => {
  test.use({ storageState: STORAGE_STATE })

  test('AC3: page heading, Create New Project CTA, and table column headings are displayed @ac-validation', async ({
    createProjectFlow,
    page
  }) => {
    await createProjectFlow.createProject(`AC3 project ${Date.now()}`)

    await page.screenshot({
      path: `${EVIDENCE}/ac3-step1-dashboard-loaded.png`,
      fullPage: true
    })

    await expect(
      page.getByRole('heading', { name: 'Projects', exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Create New Project' })
    ).toBeVisible()
    await expect(
      page.getByRole('columnheader', { name: 'Project Name' })
    ).toBeVisible()
    await expect(
      page.getByRole('columnheader', { name: 'Last Modified' })
    ).toBeVisible()
    await expect(
      page.getByRole('columnheader', { name: 'Date Created' })
    ).toBeVisible()

    await page.screenshot({
      path: `${EVIDENCE}/ac3-step2-heading-cta-columns-verified.png`,
      fullPage: true
    })
  })

  test('AC4: projects are sorted by last modified descending by default @ac-validation', async ({
    createProjectFlow,
    page
  }) => {
    const nameA = `AC4-A ${Date.now()}`
    await createProjectFlow.createProject(nameA)

    const nameB = `AC4-B ${Date.now()}`
    await createProjectFlow.createProject(nameB)

    await page.screenshot({
      path: `${EVIDENCE}/ac4-step1-dashboard-with-two-projects.png`,
      fullPage: true
    })

    const projectLinks = page.getByTestId('projects-table').getByRole('link')
    const names = await projectLinks.allTextContents()
    const indexA = names.findIndex((n) => n.includes('AC4-A'))
    const indexB = names.findIndex((n) => n.includes('AC4-B'))
    expect(indexB).toBeLessThan(indexA)

    await page.screenshot({
      path: `${EVIDENCE}/ac4-step2-sort-order-verified.png`,
      fullPage: true
    })
  })

  test('AC5: project name column shows the name of each saved project @ac-validation', async ({
    createProjectFlow,
    projectDashboardPage,
    page
  }) => {
    const projectName = `AC5 project ${Date.now()}`
    await createProjectFlow.createProject(projectName)

    await page.screenshot({
      path: `${EVIDENCE}/ac5-step1-dashboard-loaded.png`,
      fullPage: true
    })

    await expect(projectDashboardPage.projectLink(projectName)).toBeVisible()

    await page.screenshot({
      path: `${EVIDENCE}/ac5-step2-project-name-visible.png`,
      fullPage: true
    })
  })

  test('AC6: last modified column shows timestamp in format "[Day] [Month name] [YYYY] at [H].[MM] [am/pm]" @ac-validation', async ({
    createProjectFlow,
    page
  }) => {
    const projectName = `AC6 project ${Date.now()}`
    await createProjectFlow.createProject(projectName)

    await page.screenshot({
      path: `${EVIDENCE}/ac6-step1-dashboard-loaded.png`,
      fullPage: true
    })

    const lastModifiedCell = page
      .getByTestId('projects-table')
      .getByRole('row')
      .filter({ hasText: projectName })
      .getByRole('cell')
      .nth(1)

    // Expected format: "[Day] [Month name] [YYYY] at [H].[MM] [am/pm]"
    // e.g. "7 April 2026 at 2.40 pm"
    await expect(lastModifiedCell).toContainText(
      /\d{1,2} \w+ \d{4} at \d{1,2}\.\d{2} (am|pm)/
    )

    await page.screenshot({
      path: `${EVIDENCE}/ac6-step2-last-modified-format.png`,
      fullPage: true
    })
  })

  test('AC7: created column shows date in format "[Day] [Month name] [YYYY]" @ac-validation', async ({
    createProjectFlow,
    page
  }) => {
    const projectName = `AC7 project ${Date.now()}`
    await createProjectFlow.createProject(projectName)

    await page.screenshot({
      path: `${EVIDENCE}/ac7-step1-dashboard-loaded.png`,
      fullPage: true
    })

    const createdCell = page
      .getByTestId('projects-table')
      .getByRole('row')
      .filter({ hasText: projectName })
      .getByRole('cell')
      .nth(2)

    // Expected format: "[Day] [Month name] [YYYY]"
    // e.g. "12 April 2025"
    await expect(createdCell).toContainText(/\d{1,2} \w+ \d{4}/)

    await page.screenshot({
      path: `${EVIDENCE}/ac7-step2-created-date-format.png`,
      fullPage: true
    })
  })
})
