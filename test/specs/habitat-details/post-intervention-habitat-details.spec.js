import { test, expect } from '@fixtures'
import {
  STORAGE_STATE,
  NO_ROLE_STORAGE_STATE,
  NO_PROJECTS_STORAGE_STATE,
  skipInE2e,
  runMode,
  baseUrl
} from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'
import { CreateProjectFlow } from '@flows/project-management/create-project.flow.js'
import { UploadBaselineFileFlow } from '@flows/upload-baseline/upload-baseline-file.flow.js'
import { UploadPostInterventionFileFlow } from '@flows/upload-post-intervention/upload-post-intervention-file.flow.js'
import { ProjectDashboardPage } from '@pages/project-dashboard.page.js'
import { PostInterventionHabitatListPage } from '@pages/post-intervention-habitat-list.page.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
// The save describe runs its own real-CDP upload and mutates it; under e2e
// load the real uploader can exceed the frontend's 120s polling budget
// (MAX_WAIT_SECONDS). Full coverage runs in github (stub uploader).
const E2E_UPLOAD_SKIP_REASON =
  'Real CDP upload exceeds the frontend 120s budget under e2e load — covered in github (stub uploader)'
const HTTP_OK = 200
const HTTP_BAD_REQUEST = 400
const HTTP_NOT_FOUND = 404
const STUB_UUID = '00000000-0000-0000-0000-000000000000'
const VALID_UUID_V4 = 'aaaaaaaa-bbbb-4ccc-bddd-eeeeeeeeeeee'
const UPLOAD_TIMEOUT = 120_000
// Test-timeout cap for this file: the first test to need a shared project
// pays its build (create + up to two uploads), which overruns the default
// 60s timeout.
const SHARED_BUILD_TEST_TIMEOUT = 180_000
const PROJECT_LABEL = 'PI habitat details test'

// Fixture reachability (Retention Category per feature, read from the .gpkg):
// - COMPLETE_PI_FILE areas: H1 + H2-2 Retained (view-only), H2-3 + H3
//   Enhanced and H2-1… Lost (editable fall-through).
// - BASELINE_FILE areas: H1, H2, H3 — so in a project holding both uploads
//   the PI parcel H1 has a ref-matching baseline feature (link shown) while
//   H2-2 does not (link hidden).
// - HEDGEROWS_FILE / WATERCOURSES_FILE: HR1-3 / WC1-3 all Retained.
// - MIXED_FILE: H1 Retained with blank proposed columns (proves the
//   baseline-side value sourcing), hedgerows with no retention category
//   (default-Retained), river R1 with retention "Null" (editable
//   watercourse fall-through).
// - TREES_FILE: T001-T004 individual trees (unsupported placeholder page).
const COMPLETE_PI_FILE = 'Post-intervention - complete.gpkg'
const BASELINE_FILE = 'Baseline - complete with area refs.gpkg'
const HEDGEROWS_FILE = 'Post-intervention - complete with hedgerows.gpkg'
const WATERCOURSES_FILE = 'Post-intervention - complete with watercourses.gpkg'
const MIXED_FILE = 'Post-intervention - mixed complete and incomplete.gpkg'
const TREES_FILE = 'Post-intervention - urban trees all sizes.gpkg'

// Habitat-list table column order: ref, type, size, distinctiveness,
// condition, units, status.
const CONDITION_COL = 4
const UNITS_COL = 5
const STATUS_COL = 6
const HABITAT_UNITS_PATTERN = /^\d+\.\d{2}$/

function detailsUrl({ projectId, featureId } = {}) {
  const params = new URLSearchParams()
  if (projectId !== undefined) {
    params.set('projectId', projectId)
  }
  if (featureId !== undefined) {
    params.set('featureId', featureId)
  }
  return `/post-intervention-habitat-details?${params.toString()}`
}

function listAnchorPattern(projectId, anchor) {
  return new RegExp(
    `/projects/${projectId}/post-intervention-habitat-list#${anchor}`
  )
}

// Ref link → featureId, harvested from a habitat-list tab panel. The panel's
// tab must be active first — GOV.UK Tabs hides inactive panels, and hidden
// links expose no ARIA role for getByRole to match.
async function featureIdByRef(page, panelId, ref) {
  const href = await page
    .locator(`#${panelId}`)
    .getByRole('link', { name: ref, exact: true })
    .getAttribute('href')
  return new URL(href, baseUrl).searchParams.get('featureId')
}

async function rowUnitsText(listPage, ref) {
  return (
    await listPage
      .areaRowByRef(ref)
      .getByRole('cell')
      .nth(UNITS_COL)
      .innerText()
  ).trim()
}

// Create a project in its own context, upload the given fixture(s), and
// harvest whatever the read-only tests need while the page is alive. Each
// fixture combination is uploaded once per worker and shared by its
// read-only tests (memoised below) — per-test uploads are what overloads the
// shared CDP uploader in e2e.
async function buildProject(browser, { baselineFile, piFile }, harvest) {
  const context = await browser.newContext({ storageState: STORAGE_STATE })
  const page = await context.newPage()
  try {
    const { id, name } = await setupProject(
      new CreateProjectFlow(page),
      new ProjectDashboardPage(page),
      PROJECT_LABEL
    )
    if (baselineFile) {
      await new UploadBaselineFileFlow(page).uploadFile(id, baselineFile)
      await page.waitForURL(
        new RegExp(`/projects/${id}/baseline-habitat-list`),
        { timeout: UPLOAD_TIMEOUT }
      )
    }
    await new UploadPostInterventionFileFlow(page).uploadFile(id, piFile)
    await page.waitForURL(
      new RegExp(`/projects/${id}/post-intervention-habitat-list`),
      { timeout: UPLOAD_TIMEOUT }
    )
    const harvested = await harvest(page)
    return { id, name, ...harvested }
  } finally {
    await context.close()
  }
}

// Memoised per worker; a failed build is not cached, so a transient upload
// failure can retry on the next caller. The file runs in one worker (see the
// mode 'default' configure below), so each project is built exactly once.
const sharedProjects = new Map()

function getSharedProject(browser, key, files, harvest) {
  if (!sharedProjects.has(key)) {
    const promise = buildProject(browser, files, harvest).catch((err) => {
      sharedProjects.delete(key)
      throw err
    })
    sharedProjects.set(key, promise)
  }
  return sharedProjects.get(key)
}

// Baseline + PI complete uploads in one project: retained parcels for the
// view-only page (H1 with a ref-matching baseline feature, H2-2 without),
// and Enhanced/Lost parcels for the editable fall-through.
function getCompleteProject(browser) {
  return getSharedProject(
    browser,
    'complete',
    { baselineFile: BASELINE_FILE, piFile: COMPLETE_PI_FILE },
    async (page) => {
      const listPage = new PostInterventionHabitatListPage(page)
      return {
        retainedWithBaseline: await featureIdByRef(page, 'area-habitats', 'H1'),
        retainedNoBaseline: await featureIdByRef(page, 'area-habitats', 'H2-2'),
        retainedNoBaselineUnits: await rowUnitsText(listPage, 'H2-2'),
        enhanced: await featureIdByRef(page, 'area-habitats', 'H2-3'),
        lost: await featureIdByRef(page, 'area-habitats', 'H2-1')
      }
    }
  )
}

// PI-only upload of the mixed fixture: a retained parcel whose proposed
// columns are blank, a hedgerow with no retention category, and a
// watercourse with retention "Null".
function getMixedProject(browser) {
  return getSharedProject(
    browser,
    'mixed',
    { piFile: MIXED_FILE },
    async (page) => {
      const listPage = new PostInterventionHabitatListPage(page)
      const retainedBlankProposed = await featureIdByRef(
        page,
        'area-habitats',
        'H1'
      )
      const retainedBlankProposedUnits = await rowUnitsText(listPage, 'H1')
      await listPage.hedgerowsTab.click()
      const hedgerowNoRetention = await featureIdByRef(page, 'hedgerows', 'H1')
      await listPage.watercoursesTab.click()
      const editableWatercourse = await featureIdByRef(
        page,
        'watercourses',
        'R1'
      )
      return {
        retainedBlankProposed,
        retainedBlankProposedUnits,
        hedgerowNoRetention,
        editableWatercourse
      }
    }
  )
}

function getHedgerowsProject(browser) {
  return getSharedProject(
    browser,
    'hedgerows',
    { piFile: HEDGEROWS_FILE },
    async (page) => {
      const listPage = new PostInterventionHabitatListPage(page)
      await listPage.hedgerowsTab.click()
      return {
        retainedHedgerow: await featureIdByRef(page, 'hedgerows', 'HR1')
      }
    }
  )
}

function getWatercoursesProject(browser) {
  return getSharedProject(
    browser,
    'watercourses',
    { piFile: WATERCOURSES_FILE },
    async (page) => {
      const listPage = new PostInterventionHabitatListPage(page)
      await listPage.watercoursesTab.click()
      return {
        retainedWatercourse: await featureIdByRef(page, 'watercourses', 'WC1')
      }
    }
  )
}

function getTreesProject(browser) {
  return getSharedProject(
    browser,
    'trees',
    { piFile: TREES_FILE },
    async (page) => ({
      tree: await featureIdByRef(page, 'area-habitats', 'T001')
    })
  )
}

test.describe('habitat-details', { tag: '@habitat-details' }, () => {
  // The whole file runs sequentially in one worker (mode 'default' overrides
  // fullyParallel without serial-mode failure cascades). Post-intervention
  // uploads must never run concurrently under the shared STORAGE_STATE
  // session: the pending-upload id is a single yar session key
  // (postInterventionPendingUploadId), so a second concurrent upload
  // overwrites it and the first project imports the second upload's file
  // (frontend habitat-upload-received-controller reads the uploadId from the
  // session, not the URL). Sequential scheduling also builds each shared
  // project below exactly once. The timeout is the upload budget: a shared
  // build (create + up to two uploads) overruns the default 60s.
  test.describe.configure({
    mode: 'default',
    timeout: SHARED_BUILD_TEST_TIMEOUT
  })

  // ─── Query parameter validation ─────────────────────────────────────────────

  test.describe(
    'Post-intervention habitat details — query parameter validation',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('missing featureId query param returns 400', async ({ page }) => {
        const response = await page.goto(detailsUrl({ projectId: STUB_UUID }))
        expect(response.status()).toBe(HTTP_BAD_REQUEST)
      })

      test('missing projectId query param returns 400', async ({ page }) => {
        const response = await page.goto(detailsUrl({ featureId: STUB_UUID }))
        expect(response.status()).toBe(HTTP_BAD_REQUEST)
      })

      test('non-UUID featureId query param returns 400', async ({ page }) => {
        const response = await page.goto(
          detailsUrl({ projectId: STUB_UUID, featureId: 'not-a-uuid' })
        )
        expect(response.status()).toBe(HTTP_BAD_REQUEST)
      })

      test('non-UUID projectId query param returns 400', async ({ page }) => {
        const response = await page.goto(
          detailsUrl({ projectId: 'not-a-uuid', featureId: STUB_UUID })
        )
        expect(response.status()).toBe(HTTP_BAD_REQUEST)
      })
    }
  )

  // ─── Feature not found ──────────────────────────────────────────────────────

  test.describe(
    'Post-intervention habitat details — feature not found',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('valid UUIDs for a non-existent feature returns 404', async ({
        page
      }) => {
        const response = await page.goto(
          detailsUrl({ projectId: VALID_UUID_V4, featureId: VALID_UUID_V4 })
        )
        expect(response.status()).toBe(HTTP_NOT_FOUND)
      })
    }
  )

  // ─── Role enforcement ───────────────────────────────────────────────────────

  test.describe('Post-intervention habitat details — role enforcement', () => {
    test.use({ storageState: NO_ROLE_STORAGE_STATE })
    test.skip(skipInE2e(NO_ROLE_STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'authenticated user without BNG Completer role is redirected to /auth/forbidden',
      { tag: '@smoke' },
      async ({ page }) => {
        await page.goto(
          detailsUrl({ projectId: STUB_UUID, featureId: STUB_UUID })
        )
        await expect(page).toHaveURL(/\/auth\/forbidden/)
      }
    )
  })

  // ─── Unauthenticated access ─────────────────────────────────────────────────

  test.describe('Post-intervention habitat details — unauthenticated access', () => {
    test(
      'GET /post-intervention-habitat-details redirects to sign-in',
      { tag: '@smoke' },
      async ({ page }) => {
        await page.goto(
          detailsUrl({ projectId: STUB_UUID, featureId: STUB_UUID })
        )
        await expect(page).not.toHaveURL(/\/post-intervention-habitat-details/)
        await expect(page).toHaveURL(/\/auth\/forbidden|\/auth\/login/)
      }
    )
  })

  // ─── Complete-project scenarios ─────────────────────────────────────────────
  // Every test in this block reads the same shared two-upload project
  // (baseline + PI complete); none of them mutate it.

  test.describe('Post-intervention habitat details — complete-project scenarios', () => {
    // ─── Retained area habitat — view-only display (BMD-608) ─────────────────

    test.describe('retained area habitat display', () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test(
        'retained area habitat renders the read-only page with every summary row and no form controls',
        { tag: '@smoke' },
        async ({ browser, postInterventionHabitatDetailsPage }) => {
          const shared = await getCompleteProject(browser)
          await postInterventionHabitatDetailsPage.open(
            shared.id,
            shared.retainedNoBaseline
          )

          const detailsPage = postInterventionHabitatDetailsPage
          await expect(detailsPage.viewOnlyHeading).toBeVisible()
          await expect(detailsPage.caption).toHaveText(shared.name)
          await expect(detailsPage.referenceKey).toBeVisible()
          await expect(detailsPage.interventionKey).toBeVisible()
          await expect(detailsPage.areaKey).toBeVisible()
          await expect(detailsPage.broadHabitatKey).toBeVisible()
          await expect(detailsPage.habitatTypeKey).toBeVisible()
          await expect(detailsPage.distinctivenessKey).toBeVisible()
          await expect(detailsPage.conditionKey).toBeVisible()
          await expect(detailsPage.strategicSignificanceKey).toBeVisible()
          await expect(detailsPage.habitatUnitsKey).toBeVisible()

          // Read-only: no dropdowns, no Save, and no trading-rules row
          // (dropped relative to the baseline details page).
          await expect(detailsPage.broadHabitatSelect).toBeHidden()
          await expect(detailsPage.habitatTypeSelect).toBeHidden()
          await expect(detailsPage.conditionSelect).toBeHidden()
          await expect(detailsPage.saveButton).toBeHidden()
          await expect(detailsPage.cancelLink).toBeHidden()
          await expect(detailsPage.tradingRulesKey).toBeHidden()
        }
      )

      test(
        'retained area habitat shows its saved values with multiplier formatting',
        { tag: '@regression' },
        async ({ browser, postInterventionHabitatDetailsPage, page }) => {
          const shared = await getCompleteProject(browser)
          await postInterventionHabitatDetailsPage.open(
            shared.id,
            shared.retainedNoBaseline
          )

          // H2-2: Grassland / Modified grassland / Moderate (fixture values);
          // "Low (2)" and "Moderate (2)" are the engine's reference
          // distinctiveness and condition for that habitat type.
          await expect(page.getByText('H2-2', { exact: true })).toBeVisible()
          await expect(
            page.getByText('Retained', { exact: true })
          ).toBeVisible()
          await expect(
            page.getByText('Grassland', { exact: true })
          ).toBeVisible()
          await expect(
            page.getByText('Modified grassland', { exact: true })
          ).toBeVisible()
          await expect(page.getByText('Low (2)', { exact: true })).toBeVisible()
          await expect(
            page.getByText('Moderate (2)', { exact: true })
          ).toBeVisible()
          await expect(
            postInterventionHabitatDetailsPage.strategicSignificanceValue
          ).toBeVisible()
          // "Units in this habitat" matches the Units cell of the same
          // parcel's habitat-list row.
          await expect(
            postInterventionHabitatDetailsPage.habitatUnitsValue
          ).toHaveText(shared.retainedNoBaselineUnits)
        }
      )

      test(
        'back link returns to the post-intervention habitat list Areas tab',
        { tag: '@regression' },
        async ({ browser, postInterventionHabitatDetailsPage, page }) => {
          const shared = await getCompleteProject(browser)
          await postInterventionHabitatDetailsPage.open(
            shared.id,
            shared.retainedNoBaseline
          )
          await postInterventionHabitatDetailsPage.backLink.click()

          await expect(page).toHaveURL(
            listAnchorPattern(shared.id, 'area-habitats')
          )
        }
      )

      test(
        '"View baseline details" links to the ref-matched baseline feature',
        { tag: '@regression' },
        async ({ browser, postInterventionHabitatDetailsPage, page }) => {
          const shared = await getCompleteProject(browser)
          await postInterventionHabitatDetailsPage.open(
            shared.id,
            shared.retainedWithBaseline
          )

          await expect(
            postInterventionHabitatDetailsPage.viewBaselineLink
          ).toBeVisible()
          await postInterventionHabitatDetailsPage.viewBaselineLink.click()
          await expect(page).toHaveURL(/\/baseline-habitat-details/)

          // The baseline and PI uploads assign independent featureIds, so the
          // link must resolve the baseline feature by parcel ref — a
          // different featureId from the PI feature the user came from.
          const baselineFeatureId = new URL(page.url()).searchParams.get(
            'featureId'
          )
          expect(baselineFeatureId).not.toBe(shared.retainedWithBaseline)
          await expect(postInterventionHabitatDetailsPage.heading).toHaveText(
            'Habitat H1'
          )
        }
      )

      test(
        '"View baseline details" is hidden when no baseline feature shares the ref',
        { tag: '@regression' },
        async ({ browser, postInterventionHabitatDetailsPage }) => {
          const shared = await getCompleteProject(browser)
          // H2-2 exists only in the PI upload (baseline has H1/H2/H3).
          await postInterventionHabitatDetailsPage.open(
            shared.id,
            shared.retainedNoBaseline
          )

          await expect(
            postInterventionHabitatDetailsPage.viewOnlyHeading
          ).toBeVisible()
          await expect(
            postInterventionHabitatDetailsPage.viewBaselineLink
          ).toBeHidden()
        }
      )
    })

    // ─── Editable fall-through (non-retained area habitats) ──────────────────
    // Created, Enhanced and Lost features keep the editable dropdown form
    // (the shared baseline template). Field and client-side dropdown
    // behaviour is exhaustively covered by baseline-habitat-details.spec.js
    // against the same shared factory — only what differs on the PI route is
    // asserted here.

    test.describe('editable fall-through', { tag: '@regression' }, () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('an Enhanced area habitat renders the editable form with PI chrome', async ({
        browser,
        postInterventionHabitatDetailsPage,
        page
      }) => {
        const shared = await getCompleteProject(browser)
        await postInterventionHabitatDetailsPage.open(
          shared.id,
          shared.enhanced
        )

        const detailsPage = postInterventionHabitatDetailsPage
        await expect(detailsPage.heading).toHaveText('Habitat H2-3')
        await expect(detailsPage.postInterventionDetailsHeading).toBeVisible()
        await expect(detailsPage.viewOnlyHeading).toBeHidden()
        await expect(detailsPage.broadHabitatSelect).toBeVisible()
        await expect(detailsPage.habitatTypeSelect).toBeVisible()
        await expect(detailsPage.conditionSelect).toBeVisible()
        await expect(detailsPage.saveButton).toBeVisible()

        // Cancel returns to the PI habitat list (not the baseline list),
        // anchored to the habitat row.
        await detailsPage.cancelLink.click()
        await expect(page).toHaveURL(
          listAnchorPattern(shared.id, `habitat-${shared.enhanced}`)
        )
      })

      test('a Lost area habitat renders the editable form', async ({
        browser,
        postInterventionHabitatDetailsPage
      }) => {
        const shared = await getCompleteProject(browser)
        await postInterventionHabitatDetailsPage.open(shared.id, shared.lost)

        await expect(
          postInterventionHabitatDetailsPage.saveButton
        ).toBeVisible()
        await expect(
          postInterventionHabitatDetailsPage.viewOnlyHeading
        ).toBeHidden()
      })

      // No fixture carries a non-retained hedgerow: local + harness PI
      // fixtures hold only Retained or no-category hedgerows, both of which
      // render the view-only page. Unblock by synthesising a variant of
      // HEDGEROWS_FILE with Retention Category 'Enhanced' (same mutation
      // approach that produced the synthesised hedgerow fixture itself),
      // upload it here, then un-skip.
      test.skip('a non-retained hedgerow renders the editable hedgerow form', async ({
        browser,
        postInterventionHabitatDetailsPage
      }) => {
        const shared = await getHedgerowsProject(browser)
        await postInterventionHabitatDetailsPage.open(
          shared.id,
          shared.enhancedHedgerow
        )
        await expect(
          postInterventionHabitatDetailsPage.habitatTypeSelect
        ).toBeVisible()
        await expect(
          postInterventionHabitatDetailsPage.saveButton
        ).toBeVisible()
      })
    })

    // ─── Cross-user access ────────────────────────────────────────────────────
    // The backend scopes projects by owner (visibleToUser), so a direct
    // object URL from a different authenticated user must 404 without
    // leaking any of the creator's data (IDOR).

    test.describe('cross-user access', { tag: '@regression' }, () => {
      test.skip(skipInE2e(NO_PROJECTS_STORAGE_STATE), E2E_SKIP_REASON)

      test('a feature in one user’s project cannot be opened directly by a different user', async ({
        browser
      }) => {
        const shared = await getCompleteProject(browser)
        const otherContext = await browser.newContext({
          storageState: NO_PROJECTS_STORAGE_STATE,
          baseURL: baseUrl
        })
        try {
          const otherPage = await otherContext.newPage()
          const response = await otherPage.goto(
            detailsUrl({
              projectId: shared.id,
              featureId: shared.retainedNoBaseline
            })
          )
          expect(response.status()).toBe(HTTP_NOT_FOUND)
          // None of the creator's feature data is rendered.
          await expect(otherPage.getByText('Modified grassland')).toBeHidden()
          await expect(otherPage.getByText(shared.name)).toBeHidden()
        } finally {
          await otherContext.close()
        }
      })
    })
  })

  // ─── Mixed-project scenarios ────────────────────────────────────────────────
  // Every test in this block reads the same shared mixed-fixture project;
  // none of them mutate it.

  test.describe('Post-intervention habitat details — mixed-project scenarios', () => {
    // ─── Retained area habitat — baseline-side value sourcing ────────────────
    // For a retained feature the engine derives everything from the baseline
    // side, so the view-only page reads descriptive values from the
    // feature's baseline sub-object. The mixed fixture's H1 has entirely
    // blank proposed columns — if the page read proposed-side values these
    // rows would be empty.

    test.describe('retained value sourcing', { tag: '@regression' }, () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('retained parcel with blank proposed columns shows baseline-side values', async ({
        browser,
        postInterventionHabitatDetailsPage,
        page
      }) => {
        const shared = await getMixedProject(browser)
        await postInterventionHabitatDetailsPage.open(
          shared.id,
          shared.retainedBlankProposed
        )

        await expect(
          postInterventionHabitatDetailsPage.viewOnlyHeading
        ).toBeVisible()
        await expect(page.getByText('Retained', { exact: true })).toBeVisible()
        // Baseline-side values (the proposed columns are blank in the
        // fixture).
        await expect(page.getByText('Urban', { exact: true })).toBeVisible()
        await expect(
          page.getByText('Developed land; sealed surface', { exact: true })
        ).toBeVisible()
        // Condition "6. N/A - Other" renders with its list prefix stripped
        // (unanchored: getByText regexes match raw, un-normalised text).
        await expect(page.getByText(/N\/A - Other/)).toBeVisible()
        await expect(
          postInterventionHabitatDetailsPage.habitatUnitsValue
        ).toHaveText(shared.retainedBlankProposedUnits)
        // No baseline upload in this project, so no ref-matched feature and
        // no "View baseline details" link.
        await expect(
          postInterventionHabitatDetailsPage.viewBaselineLink
        ).toBeHidden()
      })
    })

    // ─── Default retention category ───────────────────────────────────────────
    // A feature with no retention category at all is treated as retained: it
    // gets the view-only page and its Intervention row shows the "Retained"
    // default.

    test.describe('default retention category', { tag: '@regression' }, () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('hedgerow with no retention category renders read-only with Intervention "Retained"', async ({
        browser,
        postInterventionHabitatDetailsPage,
        page
      }) => {
        const shared = await getMixedProject(browser)
        await postInterventionHabitatDetailsPage.open(
          shared.id,
          shared.hedgerowNoRetention
        )

        await expect(
          postInterventionHabitatDetailsPage.viewOnlyHeading
        ).toBeVisible()
        await expect(page.getByText('Retained', { exact: true })).toBeVisible()
        await expect(postInterventionHabitatDetailsPage.saveButton).toBeHidden()
      })
    })

    // ─── Editable fall-through (non-retained watercourse) ────────────────────

    test.describe(
      'editable watercourse fall-through',
      { tag: '@regression' },
      () => {
        test.use({ storageState: STORAGE_STATE })
        test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

        test('a watercourse with retention "Null" renders the editable watercourse form', async ({
          browser,
          postInterventionHabitatDetailsPage,
          page
        }) => {
          const shared = await getMixedProject(browser)
          const response = await page.goto(
            detailsUrl({
              projectId: shared.id,
              featureId: shared.editableWatercourse
            })
          )

          expect(response.status()).toBe(HTTP_OK)
          await expect(
            postInterventionHabitatDetailsPage.watercourseEncroachmentSelect
          ).toBeVisible()
          await expect(
            postInterventionHabitatDetailsPage.saveButton
          ).toBeVisible()
        })

        // The PI save endpoint (PUT /projects/{id}/post-intervention/habitats/
        // {featureId}) only updates area habitats, so saving the editable form
        // for a non-retained watercourse currently 404s in the backend and
        // surfaces as 502 Bad Gateway. That looks like a defect rather than a
        // contract — confirm the intended behaviour with the team before
        // asserting it, then either un-skip this as-is (behaviour confirmed
        // intended) or rewrite it as a redirect assertion (backend gains
        // linear-feature support).
        test.skip('saving an editable watercourse surfaces the area-only backend 404 as 502', async ({
          browser,
          postInterventionHabitatDetailsPage,
          page
        }) => {
          const shared = await getMixedProject(browser)
          await postInterventionHabitatDetailsPage.open(
            shared.id,
            shared.editableWatercourse
          )
          const responsePromise = page.waitForResponse(
            (response) =>
              response.url().includes('/post-intervention-habitat-details') &&
              response.request().method() === 'POST'
          )
          await postInterventionHabitatDetailsPage.saveButton.click()
          const response = await responsePromise
          expect(response.status()).toBe(502)
        })
      }
    )
  })

  // ─── Retained hedgerow — view-only display (BMD-723) ────────────────────────

  test.describe('Post-intervention habitat details — retained hedgerow display', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'retained hedgerow renders the read-only page without a Broad habitat row',
      { tag: '@smoke' },
      async ({ browser, postInterventionHabitatDetailsPage, page }) => {
        const shared = await getHedgerowsProject(browser)
        await postInterventionHabitatDetailsPage.open(
          shared.id,
          shared.retainedHedgerow
        )

        const detailsPage = postInterventionHabitatDetailsPage
        await expect(detailsPage.viewOnlyHeading).toBeVisible()
        await expect(detailsPage.interventionKey).toBeVisible()
        await expect(detailsPage.lengthKey).toBeVisible()
        await expect(detailsPage.habitatTypeKey).toBeVisible()
        // Hedgerows have no broad-habitat dimension and no area size row.
        await expect(detailsPage.broadHabitatKey).toBeHidden()
        await expect(detailsPage.areaKey).toBeHidden()
        await expect(
          page.getByText('Native hedgerow', { exact: true })
        ).toBeVisible()
        await expect(detailsPage.saveButton).toBeHidden()
        await expect(detailsPage.habitatTypeSelect).toBeHidden()

        await detailsPage.backLink.click()
        await expect(page).toHaveURL(listAnchorPattern(shared.id, 'hedgerows'))
      }
    )
  })

  // ─── Retained watercourse — view-only display (BMD-724) ─────────────────────

  test.describe('Post-intervention habitat details — retained watercourse display', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'retained watercourse renders the read-only page with both encroachment rows',
      { tag: '@smoke' },
      async ({ browser, postInterventionHabitatDetailsPage, page }) => {
        const shared = await getWatercoursesProject(browser)
        await postInterventionHabitatDetailsPage.open(
          shared.id,
          shared.retainedWatercourse
        )

        const detailsPage = postInterventionHabitatDetailsPage
        await expect(detailsPage.viewOnlyHeading).toBeVisible()
        await expect(detailsPage.interventionKey).toBeVisible()
        await expect(detailsPage.lengthKey).toBeVisible()
        await expect(detailsPage.watercourseEncroachmentKey).toBeVisible()
        await expect(detailsPage.riparianEncroachmentKey).toBeVisible()
        await expect(page.getByText('Ditches', { exact: true })).toBeVisible()
        // Encroachment values come from the baseline side and render as
        // "Value (multiplier)"; the multiplier is engine data, so assert the
        // value prefix. WC1: "No Encroachment" / "No Encroachment/No
        // Encroachment" (fixture values). getByText regexes match raw,
        // un-normalised text, so allow surrounding whitespace; the anchors
        // keep the two rows distinct (the riparian value contains the
        // watercourse value as a substring).
        await expect(
          page.getByText(/^\s*No Encroachment( \(.+\))?\s*$/)
        ).toBeVisible()
        await expect(
          page.getByText(/^\s*No Encroachment\/No Encroachment( \(.+\))?\s*$/)
        ).toBeVisible()
        // Read-only: no dropdowns (including the watercourse-only
        // encroachment selects) and no Save.
        await expect(detailsPage.watercourseEncroachmentSelect).toBeHidden()
        await expect(detailsPage.riparianEncroachmentSelect).toBeHidden()
        await expect(detailsPage.saveButton).toBeHidden()

        await detailsPage.backLink.click()
        await expect(page).toHaveURL(
          listAnchorPattern(shared.id, 'watercourses')
        )
      }
    )
  })

  // ─── Unsupported feature placeholder (individual trees) ─────────────────────

  test.describe(
    'Post-intervention habitat details — unsupported tree feature',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('an individual tree renders the unsupported-feature placeholder', async ({
        browser,
        postInterventionHabitatDetailsPage,
        page
      }) => {
        const shared = await getTreesProject(browser)
        await postInterventionHabitatDetailsPage.open(shared.id, shared.tree)

        await expect(
          postInterventionHabitatDetailsPage.viewOnlyHeading
        ).toBeVisible()
        await expect(
          postInterventionHabitatDetailsPage.unsupportedFeatureMessage
        ).toBeVisible()
        await expect(postInterventionHabitatDetailsPage.saveButton).toBeHidden()

        await postInterventionHabitatDetailsPage.backLink.click()
        await expect(page).toHaveURL(
          listAnchorPattern(shared.id, 'area-habitats')
        )
      })
    }
  )

  // ─── Save (editable area habitat) ───────────────────────────────────────────

  test.describe('Post-intervention habitat details — save editable area habitat', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)
    test.skip(runMode === 'e2e', E2E_UPLOAD_SKIP_REASON)

    test(
      'saving a changed condition persists it and returns to the list anchored to the habitat',
      { tag: '@smoke' },
      async ({
        createProjectFlow,
        projectDashboardPage,
        uploadPostInterventionFileFlow,
        postInterventionHabitatDetailsPage,
        postInterventionHabitatListPage,
        page
      }) => {
        // Own upload — this test mutates the project, so it must not share
        // the read-only projects.
        const { id } = await setupProject(
          createProjectFlow,
          projectDashboardPage,
          PROJECT_LABEL
        )
        await uploadPostInterventionFileFlow.uploadFile(id, COMPLETE_PI_FILE)
        await page.waitForURL(
          new RegExp(`/projects/${id}/post-intervention-habitat-list`),
          { timeout: UPLOAD_TIMEOUT }
        )
        const enhanced = await featureIdByRef(page, 'area-habitats', 'H2-3')

        await postInterventionHabitatDetailsPage.open(id, enhanced)
        const newCondition =
          await postInterventionHabitatDetailsPage.selectDifferentCondition()
        await postInterventionHabitatDetailsPage.saveButton.click()

        await expect(page).toHaveURL(
          listAnchorPattern(id, `habitat-${enhanced}`)
        )
        const row = postInterventionHabitatListPage.areaRowByRef('H2-3')
        await expect(row.getByRole('cell').nth(CONDITION_COL)).toHaveText(
          newCondition
        )
        await expect(row.getByRole('cell').nth(STATUS_COL)).toHaveText(
          'Complete'
        )
        await expect(row.getByRole('cell').nth(UNITS_COL)).toHaveText(
          HABITAT_UNITS_PATTERN
        )
      }
    )
  })
})
