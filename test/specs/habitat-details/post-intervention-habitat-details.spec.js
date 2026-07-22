import { test, expect } from '@fixtures'
import {
  STORAGE_STATE,
  NO_ROLE_STORAGE_STATE,
  NO_PROJECTS_STORAGE_STATE,
  skipInE2e,
  baseUrl
} from '@utils/env.js'
import { setupProject } from '@utils/project-helpers.js'
import { CreateProjectFlow } from '@flows/project-management/create-project.flow.js'
import { UploadBaselineFileFlow } from '@flows/upload-baseline/upload-baseline-file.flow.js'
import { UploadPostInterventionFileFlow } from '@flows/upload-post-intervention/upload-post-intervention-file.flow.js'
import { ProjectDashboardPage } from '@pages/project-dashboard.page.js'
import { PostInterventionHabitatListPage } from '@pages/post-intervention-habitat-list.page.js'

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
const HTTP_BAD_REQUEST = 400
const HTTP_NOT_FOUND = 404
const HTTP_NOT_IMPLEMENTED = 501
const STUB_UUID = '00000000-0000-0000-0000-000000000000'
const VALID_UUID_V4 = 'aaaaaaaa-bbbb-4ccc-bddd-eeeeeeeeeeee'
const UPLOAD_TIMEOUT = 120_000
// Test-timeout cap for this file: the first test to need a shared project
// pays its build (create + up to two uploads), which overruns the default
// 60s timeout.
const SHARED_BUILD_TEST_TIMEOUT = 180_000
const PROJECT_LABEL = 'PI habitat details test'

// Fixture reachability (Retention Category per feature, read from the .gpkg):
// - COMPLETE_PI_FILE areas: H1 + H2-2 Retained, H2-3 + H3 Enhanced, H2-1…
//   Lost — all render the read-only page now (retention no longer gates it).
// - BASELINE_FILE areas: H1, H2, H3 — so in a project holding both uploads
//   the PI parcel H1 has a ref-matching baseline feature (link shown) while
//   H2-2 does not (link hidden).
// - HEDGEROWS_FILE / WATERCOURSES_FILE: HR1-3 / WC1-3 all Retained.
// - HEDGEROW_BASELINE_FILE: BASELINE_FILE variant whose hedgerow Parcel Refs
//   are HR1/HR2, so PI hedgerow HR1 has a ref-matching baseline feature and
//   the "View baseline details" link renders on its view-only page.
// - WATERCOURSE_BASELINE_FILE: BASELINE_FILE variant whose river Parcel Ref
//   is WC1, so PI watercourse WC1 has a ref-matching baseline feature and
//   the "View baseline details" link renders on its view-only page.
// - MIXED_FILE: H1 Retained with blank proposed columns (proves the
//   baseline-side value sourcing) plus H2/H3 Enhanced with blank proposed
//   columns (Incomplete). Its hedgerows (H1/H2) and river (R1) are Lost, so
//   the backend excludes them on import — asserted on the habitat list.
// - TREES_FILE: T001-T004 individual trees (unsupported placeholder page).
const COMPLETE_PI_FILE = 'Post-intervention - complete.gpkg'
const BASELINE_FILE = 'Baseline - complete with area refs.gpkg'
const HEDGEROWS_FILE = 'Post-intervention - complete with hedgerows.gpkg'
const HEDGEROW_BASELINE_FILE = 'Baseline - complete with hedgerow refs.gpkg'
const WATERCOURSES_FILE = 'Post-intervention - complete with watercourses.gpkg'
const WATERCOURSE_BASELINE_FILE =
  'Baseline - complete with watercourse refs.gpkg'
const MIXED_FILE = 'Post-intervention - mixed complete and incomplete.gpkg'
const TREES_FILE = 'Post-intervention - urban trees all sizes.gpkg'
const RETAINED_HEDGEROW_REF = 'HR1'
const RETAINED_WATERCOURSE_REF = 'WC1'

// Post-intervention habitat-list table column order (BMD-845 added the
// "Intervention type" column at index 1): ref, intervention type, type, size,
// distinctiveness, condition, units, status.
const UNITS_COL = 6

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

async function rowUnitsText(row) {
  return (await row.getByRole('cell').nth(UNITS_COL).innerText()).trim()
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
// read-only page (H1 with a ref-matching baseline feature, H2-2 without), an
// Enhanced parcel, and a Lost parcel (H2-1) which the backend imports as
// Created — both prove retention no longer gates the read-only page.
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
        retainedNoBaselineUnits: await rowUnitsText(
          listPage.areaRowByRef('H2-2')
        ),
        enhanced: await featureIdByRef(page, 'area-habitats', 'H2-3'),
        lostAsCreated: await featureIdByRef(page, 'area-habitats', 'H2-1')
      }
    }
  )
}

// PI-only upload of the mixed fixture: an H1 area parcel Retained with blank
// proposed columns (baseline-side value sourcing) alongside Enhanced parcels
// with blank proposed columns. The hedgerows and river are Lost, so the
// backend excludes them on import — that exclusion is asserted on the habitat
// list, not here.
function getMixedProject(browser) {
  return getSharedProject(
    browser,
    'mixed',
    { piFile: MIXED_FILE },
    async (page) => {
      const listPage = new PostInterventionHabitatListPage(page)
      return {
        retainedBlankProposed: await featureIdByRef(
          page,
          'area-habitats',
          'H1'
        ),
        retainedBlankProposedUnits: await rowUnitsText(
          listPage.areaRowByRef('H1')
        )
      }
    }
  )
}

// Baseline + PI hedgerow uploads in one project: retained hedgerows for the
// view-only page, with HR1 ref-matched to a baseline hedgerow so the
// "View baseline details" link renders (BMD-723 AC1/AC3).
function getHedgerowsProject(browser) {
  return getSharedProject(
    browser,
    'hedgerows',
    { baselineFile: HEDGEROW_BASELINE_FILE, piFile: HEDGEROWS_FILE },
    async (page) => {
      const listPage = new PostInterventionHabitatListPage(page)
      await listPage.hedgerowsTab.click()
      return {
        retainedHedgerow: await featureIdByRef(
          page,
          'hedgerows',
          RETAINED_HEDGEROW_REF
        ),
        retainedHedgerowUnits: await rowUnitsText(
          listPage.hedgerowRowByRef(RETAINED_HEDGEROW_REF)
        )
      }
    }
  )
}

// Baseline + PI watercourse uploads in one project: retained watercourses
// for the view-only page, with WC1 ref-matched to a baseline watercourse so
// the "View baseline details" link renders (BMD-724 AC1/AC3).
function getWatercoursesProject(browser) {
  return getSharedProject(
    browser,
    'watercourses',
    { baselineFile: WATERCOURSE_BASELINE_FILE, piFile: WATERCOURSES_FILE },
    async (page) => {
      const listPage = new PostInterventionHabitatListPage(page)
      await listPage.watercoursesTab.click()
      return {
        retainedWatercourse: await featureIdByRef(
          page,
          'watercourses',
          RETAINED_WATERCOURSE_REF
        ),
        retainedWatercourseUnits: await rowUnitsText(
          listPage.watercourseRowByRef(RETAINED_WATERCOURSE_REF)
        )
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
        async ({
          browser,
          postInterventionHabitatDetailsPage,
          postInterventionHabitatListPage,
          page
        }) => {
          const shared = await getCompleteProject(browser)
          // Arrive the way the user does (BMD-608 AC1): click the parcel's
          // ref link on the habitat-list Areas tab rather than deep-linking.
          await postInterventionHabitatListPage.open(shared.id)
          await postInterventionHabitatListPage.areaHabitatsTable
            .getByRole('link', { name: 'H2-2', exact: true })
            .click()
          await expect(page).toHaveURL(/\/post-intervention-habitat-details/)

          // H2-2: Grassland / Modified grassland / Moderate (fixture values);
          // "Low (2)" and "Moderate (2)" are the engine's reference
          // distinctiveness and condition for that habitat type.
          await expect(page.getByText('H2-2', { exact: true })).toBeVisible()
          // Area renders as "<value>ha" (10 significant figures).
          await expect(postInterventionHabitatDetailsPage.areaValue).toHaveText(
            /^\s*\d+(\.\d+)?ha\s*$/
          )
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
        async ({
          browser,
          postInterventionHabitatDetailsPage,
          postInterventionHabitatListPage,
          page
        }) => {
          const shared = await getCompleteProject(browser)
          await postInterventionHabitatDetailsPage.open(
            shared.id,
            shared.retainedNoBaseline
          )
          await postInterventionHabitatDetailsPage.backLink.click()

          await expect(page).toHaveURL(
            listAnchorPattern(shared.id, 'area-habitats')
          )
          // "Preselected" is GOV.UK tabs client-side behaviour driven by the
          // anchor — assert the Areas tab really is selected, not just the URL.
          await expect(
            postInterventionHabitatListPage.areasTab
          ).toHaveAttribute('aria-selected', 'true')
          await expect(
            postInterventionHabitatListPage.areaHabitatsTable
          ).toBeVisible()
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

    // ─── Non-retained area habitats are read-only too (BMD-608) ──────────────
    // Every PI details page is read-only regardless of retention category
    // (BMD-608/723/724): a Created or Enhanced feature no longer falls through
    // to an editable form. Editable, intervention-specific details pages are
    // deferred to BMD-845.

    test.describe(
      'non-retained area habitats are read-only',
      { tag: '@regression' },
      () => {
        test.use({ storageState: STORAGE_STATE })
        test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

        test('an Enhanced area habitat renders read-only with no form controls', async ({
          browser,
          postInterventionHabitatDetailsPage
        }) => {
          const shared = await getCompleteProject(browser)
          await postInterventionHabitatDetailsPage.open(
            shared.id,
            shared.enhanced
          )

          // Retention no longer gates the page: a non-retained (Enhanced)
          // feature gets the same read-only page as a retained one.
          const detailsPage = postInterventionHabitatDetailsPage
          await expect(detailsPage.viewOnlyHeading).toBeVisible()
          await expect(detailsPage.broadHabitatSelect).toBeHidden()
          await expect(detailsPage.habitatTypeSelect).toBeHidden()
          await expect(detailsPage.conditionSelect).toBeHidden()
          await expect(detailsPage.saveButton).toBeHidden()
          await expect(detailsPage.cancelLink).toBeHidden()
        })

        // A Lost area habitat is one whose baseline habitat was removed and
        // replaced, so the backend maps it to Created (BMD-531/534) — it still
        // appears, rendering the read-only page with Intervention "Created".
        // (Lost hedgerows, watercourses and trees are instead excluded
        // entirely; that is covered in post-intervention-habitat-list.spec.js.)
        test('a Lost area habitat is imported as Created and renders read-only', async ({
          browser,
          postInterventionHabitatDetailsPage,
          page
        }) => {
          const shared = await getCompleteProject(browser)
          await postInterventionHabitatDetailsPage.open(
            shared.id,
            shared.lostAsCreated
          )

          await expect(
            postInterventionHabitatDetailsPage.viewOnlyHeading
          ).toBeVisible()
          await expect(page.getByText('Created', { exact: true })).toBeVisible()
          await expect(
            postInterventionHabitatDetailsPage.saveButton
          ).toBeHidden()
        })
      }
    )

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
  })

  // ─── Retained hedgerow — view-only display (BMD-723) ────────────────────────

  test.describe('Post-intervention habitat details — retained hedgerow display', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    test(
      'retained hedgerow renders the read-only page without a Broad habitat row',
      { tag: '@smoke' },
      async ({
        browser,
        postInterventionHabitatDetailsPage,
        postInterventionHabitatListPage,
        page
      }) => {
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
        // "Preselected" is GOV.UK tabs client-side behaviour driven by the
        // anchor — assert the Hedgerows tab really is selected, not just the
        // URL.
        await expect(
          postInterventionHabitatListPage.hedgerowsTab
        ).toHaveAttribute('aria-selected', 'true')
        await expect(
          postInterventionHabitatListPage.hedgerowsTable
        ).toBeVisible()
      }
    )

    test(
      'retained hedgerow shows its saved values with multiplier formatting',
      { tag: '@regression' },
      async ({
        browser,
        postInterventionHabitatDetailsPage,
        postInterventionHabitatListPage,
        page
      }) => {
        const shared = await getHedgerowsProject(browser)
        // Arrive the way the user does (BMD-723 AC1): select the Hedgerows
        // tab and click the hedgerow's ref link rather than deep-linking.
        await postInterventionHabitatListPage.open(shared.id)
        await postInterventionHabitatListPage.hedgerowsTab.click()
        await postInterventionHabitatListPage.hedgerowsTable
          .getByRole('link', { name: RETAINED_HEDGEROW_REF, exact: true })
          .click()
        await expect(page).toHaveURL(/\/post-intervention-habitat-details/)

        await expect(postInterventionHabitatDetailsPage.caption).toHaveText(
          shared.name
        )
        await expect(
          page.getByText(RETAINED_HEDGEROW_REF, { exact: true })
        ).toBeVisible()
        // HR1: Native hedgerow / Moderate / 90 m (fixture values); "Low (2)"
        // and "Moderate (2)" are the engine's reference distinctiveness and
        // condition for that habitat type. Length renders in km with
        // trailing zeros trimmed.
        await expect(page.getByText('Retained', { exact: true })).toBeVisible()
        await expect(postInterventionHabitatDetailsPage.lengthValue).toHaveText(
          /^\s*0\.09\s*$/
        )
        await expect(page.getByText('Low (2)', { exact: true })).toBeVisible()
        await expect(
          page.getByText('Moderate (2)', { exact: true })
        ).toBeVisible()
        await expect(
          postInterventionHabitatDetailsPage.strategicSignificanceValue
        ).toBeVisible()
        // "Units in this habitat" matches the Units cell of the same
        // hedgerow's habitat-list row.
        await expect(
          postInterventionHabitatDetailsPage.habitatUnitsValue
        ).toHaveText(shared.retainedHedgerowUnits)
      }
    )

    test(
      '"View baseline details" links to the ref-matched baseline hedgerow',
      { tag: '@regression' },
      async ({ browser, postInterventionHabitatDetailsPage, page }) => {
        const shared = await getHedgerowsProject(browser)
        await postInterventionHabitatDetailsPage.open(
          shared.id,
          shared.retainedHedgerow
        )

        await expect(
          postInterventionHabitatDetailsPage.viewBaselineLink
        ).toBeVisible()
        await postInterventionHabitatDetailsPage.viewBaselineLink.click()
        await expect(page).toHaveURL(/\/baseline-habitat-details/)

        // The baseline and PI uploads assign independent featureIds, so the
        // link must resolve the baseline feature by parcel ref — a different
        // featureId from the PI feature the user came from.
        const baselineFeatureId = new URL(page.url()).searchParams.get(
          'featureId'
        )
        expect(baselineFeatureId).not.toBe(shared.retainedHedgerow)
        await expect(postInterventionHabitatDetailsPage.heading).toHaveText(
          `Hedgerow ${RETAINED_HEDGEROW_REF}`
        )
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
      async ({
        browser,
        postInterventionHabitatDetailsPage,
        postInterventionHabitatListPage,
        page
      }) => {
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
        // Baseline WC1 shares the parcel ref, so the link renders.
        await expect(detailsPage.viewBaselineLink).toBeVisible()

        await detailsPage.backLink.click()
        await expect(page).toHaveURL(
          listAnchorPattern(shared.id, 'watercourses')
        )
        // "Preselected" is GOV.UK tabs client-side behaviour driven by the
        // anchor — assert the Watercourses tab really is selected, not just
        // the URL.
        await expect(
          postInterventionHabitatListPage.watercoursesTab
        ).toHaveAttribute('aria-selected', 'true')
        await expect(
          postInterventionHabitatListPage.watercoursesTable
        ).toBeVisible()
      }
    )

    test(
      'retained watercourse shows its saved values with multiplier formatting',
      { tag: '@regression' },
      async ({
        browser,
        postInterventionHabitatDetailsPage,
        postInterventionHabitatListPage,
        page
      }) => {
        const shared = await getWatercoursesProject(browser)
        // Arrive the way the user does (BMD-724 AC1): select the
        // Watercourses tab and click the watercourse's ref link rather than
        // deep-linking.
        await postInterventionHabitatListPage.open(shared.id)
        await postInterventionHabitatListPage.watercoursesTab.click()
        await postInterventionHabitatListPage.watercoursesTable
          .getByRole('link', { name: RETAINED_WATERCOURSE_REF, exact: true })
          .click()
        await expect(page).toHaveURL(/\/post-intervention-habitat-details/)

        await expect(postInterventionHabitatDetailsPage.caption).toHaveText(
          shared.name
        )
        await expect(
          page.getByText(RETAINED_WATERCOURSE_REF, { exact: true })
        ).toBeVisible()
        // WC1: Ditches / Moderate / 90 m (fixture values); "Medium (n)" and
        // "Moderate (n)" are the engine's reference distinctiveness and
        // condition for that river type. Length renders in km with trailing
        // zeros trimmed.
        await expect(page.getByText('Retained', { exact: true })).toBeVisible()
        await expect(postInterventionHabitatDetailsPage.lengthValue).toHaveText(
          /^\s*0\.09\s*$/
        )
        await expect(
          page.getByText(/^\s*Medium \(\d+(\.\d+)?\)\s*$/)
        ).toBeVisible()
        await expect(
          page.getByText(/^\s*Moderate \(\d+(\.\d+)?\)\s*$/)
        ).toBeVisible()
        await expect(
          postInterventionHabitatDetailsPage.strategicSignificanceValue
        ).toBeVisible()
        // "Units in this habitat" matches the Units cell of the same
        // watercourse's habitat-list row.
        await expect(
          postInterventionHabitatDetailsPage.habitatUnitsValue
        ).toHaveText(shared.retainedWatercourseUnits)
      }
    )

    test(
      '"View baseline details" links to the ref-matched baseline watercourse',
      { tag: '@regression' },
      async ({ browser, postInterventionHabitatDetailsPage, page }) => {
        const shared = await getWatercoursesProject(browser)
        await postInterventionHabitatDetailsPage.open(
          shared.id,
          shared.retainedWatercourse
        )

        await expect(
          postInterventionHabitatDetailsPage.viewBaselineLink
        ).toBeVisible()
        await postInterventionHabitatDetailsPage.viewBaselineLink.click()
        await expect(page).toHaveURL(/\/baseline-habitat-details/)

        // The baseline and PI uploads assign independent featureIds, so the
        // link must resolve the baseline feature by parcel ref — a different
        // featureId from the PI feature the user came from.
        const baselineFeatureId = new URL(page.url()).searchParams.get(
          'featureId'
        )
        expect(baselineFeatureId).not.toBe(shared.retainedWatercourse)
        await expect(postInterventionHabitatDetailsPage.heading).toHaveText(
          `Watercourse ${RETAINED_WATERCOURSE_REF}`
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

  // ─── Save is not implemented (read-only route) ──────────────────────────────
  // Every PI details page is read-only (BMD-608/723/724), so nothing renders a
  // form that posts here — but the route stays registered and must answer 501
  // rather than a default 404, so a stale page or client gets an explicit
  // "not implemented" response.

  test.describe(
    'Post-intervention habitat details — save not implemented',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      test('POST /post-intervention-habitat-details returns 501 Not Implemented', async ({
        page
      }) => {
        // No page on this route ever renders a form that posts here (it's
        // read-only), so there is no crumb-carrying HTML form to submit via a
        // real browser action. Any response sets the httpOnly `crumb` cookie
        // (@hapi/crumb, restful: false); read it from the context and echo it
        // back in the JSON payload the same way a real form submission would.
        await page.goto('/')
        const crumbCookie = (await page.context().cookies()).find(
          (cookie) => cookie.name === 'crumb'
        )
        const response = await page.request.post(
          '/post-intervention-habitat-details',
          { data: { crumb: crumbCookie.value } }
        )
        expect(response.status()).toBe(HTTP_NOT_IMPLEMENTED)
      })
    }
  )
})
