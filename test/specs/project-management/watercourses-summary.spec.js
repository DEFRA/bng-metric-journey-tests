import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { getAllUnitTypesProject } from '@utils/summary-projects.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

const WATERCOURSES = 'Watercourses'
const HEDGEROWS = 'Hedgerows'
const AREA_HABITATS = 'Area habitats'
const BASELINE_NAV_CHILD = 'Baseline'

// The watercourses page is still the shared placeholder. These tests assert it
// FOR WHAT IT IS rather than skipping the page entirely, for the same reason
// project-summary.spec.js pins its deferred elements: when the real page ships
// these fail immediately and are rewritten, instead of the placeholder quietly
// surviving behind a skip nobody revisits.
//
// See test/flows/project-management/watercourses-summary.flow.md — its Step 3
// (results and targets) is [PLANNED], and the backend already supplies every
// field it needs, so that is frontend-only work whenever it is picked up.
test.describe('project-management', { tag: '@project-management' }, () => {
  test.describe.configure({ mode: 'serial' })

  test.describe(
    'Watercourses summary — placeholder',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getAllUnitTypesProject(browser)
      })

      test('renders the under-construction placeholder, not a unit-type page', async ({
        watercoursesSummaryPage
      }) => {
        await watercoursesSummaryPage.open(project.id)

        await expect(watercoursesSummaryPage.heading).toBeVisible()
        await expect(
          watercoursesSummaryPage.caption(project.name)
        ).toBeVisible()
        await expect(
          watercoursesSummaryPage.underConstructionCopy
        ).toBeVisible()

        // The structural tells. The placeholder extends layouts/page.njk
        // directly, so it inherits neither the heading row's upload button nor
        // the unitTypeBody block that carries Results and Targets. Asserting
        // all three keeps this honest: the copy alone could survive a
        // half-built real page.
        await expect(watercoursesSummaryPage.uploadFileButton).toHaveCount(0)
        await expect(watercoursesSummaryPage.resultsHeading).toHaveCount(0)
        await expect(watercoursesSummaryPage.targetsSection).toHaveCount(0)
      })

      // The placeholder still gets the real navigation, which is what makes it
      // reachable at all — the guard, the role check and the nav are the only
      // parts of this route that are genuinely finished.
      test('is reachable from the project summary and marks itself current', async ({
        projectSummaryPage,
        watercoursesSummaryPage,
        page
      }) => {
        await projectSummaryPage.open(project.id)
        await projectSummaryPage.navigation
          .getByRole('link', { name: WATERCOURSES })
          .click()

        await page.waitForURL(
          new RegExp(`/projects/${project.id}/watercourses-summary`)
        )
        await expect(watercoursesSummaryPage.heading).toBeVisible()
        await expect(
          watercoursesSummaryPage.navItem(WATERCOURSES)
        ).toHaveAttribute('aria-current', 'page')

        // Siblings stay linked, and the area section is collapsed as it is on
        // every unit type that is not an area page.
        await expect(
          watercoursesSummaryPage.navLink(AREA_HABITATS)
        ).toBeVisible()
        await expect(watercoursesSummaryPage.navLink(HEDGEROWS)).toBeVisible()
        await expect(
          watercoursesSummaryPage.navLink(BASELINE_NAV_CHILD)
        ).toHaveCount(0)
      })
    }
  )
})
