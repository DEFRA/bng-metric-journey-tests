import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { uploadFileHref } from '@utils/upload-file-navigation.js'
import {
  getAllUnitTypesPostInterventionProject,
  getHedgerowInterventionTypesProject
} from '@utils/summary-projects.js'
import {
  AREA_HABITATS,
  BASELINE_NAV_CHILD,
  HEDGEROWS,
  POST_INTERVENTION_NAV_CHILD,
  SUMMARY,
  VIEW_ON_SITE_HEDGEROWS_BASELINE,
  VIEW_ON_SITE_POST_INTERVENTION,
  WATERCOURSES
} from '@utils/unit-type-labels.js'

// The hedgerows post-intervention page (BMD-860) —
// `/projects/{id}/hedgerows-post-intervention`. See
// test/flows/project-management/hedgerows-post-intervention.flow.md.
//
// `hedgerows-post-intervention/controller.test.js` already covers this page's
// markup in 15 tests, all with `wreck` mocked and four hand-built hedgerows.
// Everything here is scoped to what that cannot reach: real backend fields,
// hrefs that actually resolve, and the client-side tab component.

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
// The shared-build upload budget, applied to the whole file below. It has to
// sit on `describe.configure` rather than on a test: the build runs in
// `beforeAll`, so a `test.setTimeout()` in a test body comes too late to
// extend it.
const SHARED_BUILD_TEST_TIMEOUT = 180_000

const PAGE_PATH = 'hedgerows-post-intervention'

const TILE_NET_PERCENTAGE = 'Total on-site net percentage change'
const TILE_TRADING_RULES = 'Trading Rules'
const TILE_BASELINE = 'On-site baseline'
const TILE_POST_INTERVENTION = 'On-site post-intervention'
const TILE_NET_UNIT_CHANGE = 'Total on-site net unit change'

// The five tiles AC5 enumerates, in rendered order. The post-intervention
// heading is the HYPHENATED spelling — `buildPostInterventionSummary` picks it
// for a standard intervention, and the unhyphenated one only for the
// post-intervention-only shape, which this page's fixtures never reach.
const TILES = [
  TILE_NET_PERCENTAGE,
  TILE_TRADING_RULES,
  TILE_BASELINE,
  TILE_POST_INTERVENTION,
  TILE_NET_UNIT_CHANGE
]

// The three tiles whose values come from the same backend fields on the
// hedgerows summary, so the two pages must render identical strings.
const SHARED_TILES = [
  TILE_BASELINE,
  TILE_POST_INTERVENTION,
  TILE_NET_UNIT_CHANGE
]

const RETAINED = 'Retained'
const ENHANCED = 'Enhanced'
const CREATED = 'Created'
const ALL_TABS = [RETAINED, ENHANCED, CREATED]

const UNITS_2DP = /^-?\d+\.\d{2} units$/

// Deliberately a pattern rather than VIEW_ON_SITE_HEDGEROWS_POST_INTERVENTION:
// AC5 writes the wording it wants removed as "post-intervention" while the app
// spells it "post intervention", so an exact match against either one alone
// would pass while the other spelling sat on the page.
const NO_PI_SELF_LINK = /View on-site hedgerows post[- ]intervention/i

async function expectTabSelected(hedgerowsPage, label) {
  await expect(hedgerowsPage.tab(label)).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(hedgerowsPage.panelHeading(label)).toBeVisible()
}

async function expectTabNotSelected(hedgerowsPage, label) {
  await expect(hedgerowsPage.tab(label)).toHaveAttribute(
    'aria-selected',
    'false'
  )
  await expect(hedgerowsPage.panelHeading(label)).toBeHidden()
}

test.describe('project-management', { tag: '@project-management' }, () => {
  // Uploads are the slowest step we own and concurrent ones clobber the shared
  // `pendingUploadId` yar key, so the file runs in one worker and each shared
  // project is built once. The timeout is the shared-build upload budget: this
  // file owns the only fixture pairing nothing else builds, so a cold
  // `beforeAll` here always pays create + two uploads, which overruns the
  // config's 60s default.
  test.describe.configure({
    mode: 'serial',
    timeout: SHARED_BUILD_TEST_TIMEOUT
  })

  // ─── Page content (BMD-860 AC3, AC4, AC5) ────────────────────────────────────

  test.describe('Hedgerows post-intervention — page content', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    let project
    test.beforeAll(async ({ browser }) => {
      project = await getHedgerowInterventionTypesProject(browser)
    })

    test(
      'renders the header, project name and upload action from real backend data',
      { tag: ['@smoke', '@happy-path'] },
      async ({ hedgerowsPostInterventionPage }) => {
        await hedgerowsPostInterventionPage.open(project.id)

        await expect(hedgerowsPostInterventionPage.heading).toBeVisible()
        await expect(
          hedgerowsPostInterventionPage.caption(project.name)
        ).toBeVisible()
        await expect(hedgerowsPostInterventionPage.resultsHeading).toBeVisible()
        await expect(hedgerowsPostInterventionPage.detailsHeading).toBeVisible()

        // The upload button's returnUrl is built by THIS controller for this
        // page. The hedgerows summary asserting its own copy proves nothing
        // here — the value is chosen per caller, so each page needs its own
        // witness.
        await expect(
          hedgerowsPostInterventionPage.uploadFileButton
        ).toHaveAttribute(
          'href',
          uploadFileHref(project.id, `/projects/${project.id}/${PAGE_PATH}`)
        )
      }
    )

    test('renders the five results tiles with no post-intervention self-link', async ({
      hedgerowsPostInterventionPage
    }) => {
      await hedgerowsPostInterventionPage.open(project.id)

      await expect(hedgerowsPostInterventionPage.tileHeadings()).toHaveText(
        TILES
      )

      // Reads `postIntervention.units.hedgerowsTotal` and
      // `baseline.units.hedgerowsTotal` — different backend fields from the
      // area page's habitatsTotal + treesTotal. The frontend unit tests mock
      // wreck, so nothing else proves these fields are really emitted.
      expect(
        await hedgerowsPostInterventionPage.tileValue(TILE_BASELINE)
      ).toMatch(UNITS_2DP)
      expect(
        await hedgerowsPostInterventionPage.tileValue(TILE_POST_INTERVENTION)
      ).toMatch(UNITS_2DP)

      // AC5's exception. The baseline tile keeps its link while the
      // post-intervention tile has NO action line at all: the controller
      // passes `interventionAction: null`, which `resolveInterventionAction`
      // treats differently from `undefined` (which would fall back to the
      // shared inert "View on-site post intervention" default). A mock that
      // passes neither renders identically, so only the real controller
      // distinguishes them.
      const section = hedgerowsPostInterventionPage.unitSection()
      await expect(section.getByText(NO_PI_SELF_LINK)).toHaveCount(0)
      await expect(
        section.getByText(VIEW_ON_SITE_POST_INTERVENTION, { exact: true })
      ).toHaveCount(0)
      await expect(
        section.getByRole('link', { name: VIEW_ON_SITE_HEDGEROWS_BASELINE })
      ).toBeVisible()
    })

    // AC5: "the same set of tiles as shown on the Project Summary page and the
    // Hedgerows Unit Summary page". Both pages read `hedgerowsTotal` through
    // the same formatter, so the rendered strings must match exactly — a
    // mismatch means one of them has been re-pointed at a different backend
    // field. Compared nowhere else.
    test('the results tiles agree with the hedgerows summary page', async ({
      hedgerowsPostInterventionPage,
      hedgerowsSummaryPage
    }) => {
      await hedgerowsSummaryPage.open(project.id)
      const fromSummary = {}
      for (const tile of SHARED_TILES) {
        fromSummary[tile] = await hedgerowsSummaryPage.tileValue(tile)
      }

      await hedgerowsPostInterventionPage.open(project.id)
      for (const tile of SHARED_TILES) {
        expect(await hedgerowsPostInterventionPage.tileValue(tile), tile).toBe(
          fromSummary[tile]
        )
      }
    })

    test('Post-intervention is current and the nav lists every unit type', async ({
      hedgerowsPostInterventionPage
    }) => {
      await hedgerowsPostInterventionPage.open(project.id)

      // AC3: the current item is a nested child under Hedgerows — the only
      // page in the service with this nav shape. Current means bold text
      // rather than a link: markCurrent deletes the href, so the item is a
      // <strong> with nothing to click.
      const current = hedgerowsPostInterventionPage.navItem(
        POST_INTERVENTION_NAV_CHILD
      )
      await expect(current).toHaveAttribute('aria-current', 'page')
      await expect(
        hedgerowsPostInterventionPage.navLink(POST_INTERVENTION_NAV_CHILD)
      ).toHaveCount(0)

      // The Baseline sibling renders because this fixture's BASELINE has
      // hedgerows; `buildSectionChildren` gates it on that, independently of
      // the post-intervention data driving the page.
      await expect(
        hedgerowsPostInterventionPage.navLink(BASELINE_NAV_CHILD)
      ).toHaveAttribute('href', `/projects/${project.id}/hedgerows-baseline`)

      // Hedgerows keeps its own link while its child is current — asserting
      // the href rather than counting, because the locator is nav-wide and
      // strict mode would fail if a second section were expanded too. That is
      // what still proves Area habitats collapsed here.
      await expect(
        hedgerowsPostInterventionPage.navLink(HEDGEROWS)
      ).toHaveAttribute('href', `/projects/${project.id}/hedgerows-summary`)
      await expect(hedgerowsPostInterventionPage.navLink(SUMMARY)).toBeVisible()
      await expect(
        hedgerowsPostInterventionPage.navLink(AREA_HABITATS)
      ).toBeVisible()
      // This fixture's baseline has rivers, so the conditional Watercourses
      // item renders. hedgerows-baseline.spec.js witnesses the other side of
      // the same condition, where an empty layer drops the item entirely.
      await expect(
        hedgerowsPostInterventionPage.navLink(WATERCOURSES)
      ).toBeVisible()
    })
  })

  // ─── Intervention type tabs (BMD-860 AC6, AC7) ───────────────────────────────
  //
  // Sole witness in any suite for the tab behaviour, for two separate reasons:
  //
  //  - Tab VISIBILITY runs each feature's raw `retentionCategory` through
  //    `interventionDisplay`, which strips a leading "N. " list prefix. The
  //    backend normalises the value to pick an engine calculation but never
  //    writes it back (see the header of
  //    post-intervention-habitat-details/retention.js), so the document keeps
  //    whatever the GeoPackage carried. `controller.test.js:303` hands the
  //    filter already-shaped values; only a real upload proves a surveyed file
  //    lands in the right tab.
  //  - Tab SWITCHING is the GOV.UK Tabs component — client-side JavaScript.
  //    The frontend unit tests parse markup with cheerio and never run it.
  //
  // Do not delete either test without adding a replacement that uploads a
  // hedgerow file carrying more than one retention category.

  test.describe(
    'Hedgerows post-intervention — intervention type tabs',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getHedgerowInterventionTypesProject(browser)
      })

      test(
        'shows one tab per intervention type present, with the first selected on load',
        { tag: '@happy-path' },
        async ({ hedgerowsPostInterventionPage }) => {
          await hedgerowsPostInterventionPage.open(project.id)

          // Array form asserts the rendered ORDER as well as the labels, which
          // is what AC6's "the first visible tab, from Retained, Enhanced,
          // Created" rule rests on. Order comes from INTERVENTION_TAB_ORDER,
          // not from the data.
          await expect(hedgerowsPostInterventionPage.tabs).toHaveText(ALL_TABS)

          await expectTabSelected(hedgerowsPostInterventionPage, RETAINED)

          for (const label of [ENHANCED, CREATED]) {
            await expectTabNotSelected(hedgerowsPostInterventionPage, label)
            // AC6's "additional visible tabs are links", asserted on the DOM
            // rather than the accessibility tree: role="tab" REPLACES the
            // implicit link role, so getByRole('link') can never match one.
            await expect(
              hedgerowsPostInterventionPage.tab(label)
            ).toHaveAttribute(
              'href',
              hedgerowsPostInterventionPage.tabHref(label)
            )
          }
        }
      )

      test(
        'clicking a tab selects it, moves focus and reveals its panel',
        { tag: '@happy-path' },
        async ({ hedgerowsPostInterventionPage }) => {
          await hedgerowsPostInterventionPage.open(project.id)

          await hedgerowsPostInterventionPage.tab(ENHANCED).click()

          // AC7. Selection is asserted through aria-selected, not through the
          // label ceasing to be a link: the GOV.UK component keeps every tab
          // an <a>, which withdrew that AC bullet (ticket comment 2026-09-09).
          await expectTabSelected(hedgerowsPostInterventionPage, ENHANCED)
          await expect(
            hedgerowsPostInterventionPage.tab(ENHANCED)
          ).toBeFocused()

          await expectTabNotSelected(hedgerowsPostInterventionPage, RETAINED)
        }
      )
    }
  )

  test.describe(
    'Hedgerows post-intervention — project with no created hedgerows',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      // Hedgerows are Retained, Enhanced and Lost — the backend drops Lost at
      // import (BMD-531/534), so the page renders exactly two tabs. The cache
      // in @utils/summary-projects.js is module state, so this pairing is free
      // whenever project-summary.spec.js has already built it in the same
      // worker — always in CI (workers: 1), never when this file runs alone.
      let project
      test.beforeAll(async ({ browser }) => {
        project = await getAllUnitTypesPostInterventionProject(browser)
      })

      // The other half of AC6's condition. `visibleInterventionTabs` filters
      // per label, so the positive case above does not prove the negative one:
      // render every tab unconditionally and that test still passes.
      test('omits the Created tab entirely', async ({
        hedgerowsPostInterventionPage
      }) => {
        await hedgerowsPostInterventionPage.open(project.id)

        await expect(hedgerowsPostInterventionPage.tabs).toHaveText([
          RETAINED,
          ENHANCED
        ])
        await expect(hedgerowsPostInterventionPage.tab(CREATED)).toHaveCount(0)
        await expect(
          hedgerowsPostInterventionPage.panelHeading(CREATED)
        ).toHaveCount(0)
        // Still the first visible tab that is selected, which is the rule AC6
        // states — not "Retained" by name.
        await expectTabSelected(hedgerowsPostInterventionPage, RETAINED)
      })
    }
  )

  // ─── Navigation wiring (BMD-860 AC2a, AC2b, AC8, AC9a, AC9b) ─────────────────

  test.describe(
    'Hedgerows post-intervention — navigation wiring',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getHedgerowInterventionTypesProject(browser)
      })

      // AC2a and AC2b. Two separate view-model paths that happen to share a
      // target: the nav child comes from `buildSectionChildren`, the tile link
      // from `hedgerowsInterventionAction`. `hedgerows-summary/controller.test.js:140`
      // proves both are rendered against mocked data; only this proves they
      // resolve — and that they render at all, which needs a project with real
      // post-intervention data (without it the tile offers the upload link
      // instead).
      test(
        'both hedgerows summary triggers open this page',
        { tag: '@happy-path' },
        async ({
          page,
          hedgerowsSummaryPage,
          hedgerowsPostInterventionPage
        }) => {
          const target = `/projects/${project.id}/${PAGE_PATH}`

          await hedgerowsSummaryPage.open(project.id)
          const interventionLink = hedgerowsSummaryPage.interventionLink()
          await expect(interventionLink).toHaveAttribute('href', target)
          await interventionLink.click()
          await expect(page).toHaveURL(new RegExp(target))
          await expect(hedgerowsPostInterventionPage.heading).toBeVisible()

          // Route two: the left nav's Post-intervention child.
          await hedgerowsSummaryPage.open(project.id)
          await hedgerowsSummaryPage
            .navLink(POST_INTERVENTION_NAV_CHILD)
            .click()
          await expect(page).toHaveURL(new RegExp(target))
          await expect(hedgerowsPostInterventionPage.heading).toBeVisible()
        }
      )

      // AC8. The unit test asserts the upload href is in the markup; only a
      // real navigation shows that following it resolves and that Back/Cancel
      // come back HERE rather than defaulting to the task list.
      test(
        '"Upload file" opens the file-type selection page, whose Back returns here',
        { tag: '@happy-path' },
        async ({ page, hedgerowsPostInterventionPage, uploadFilePage }) => {
          const target = `/projects/${project.id}/${PAGE_PATH}`
          await hedgerowsPostInterventionPage.open(project.id)

          await hedgerowsPostInterventionPage.uploadFileButton.click()

          await expect(uploadFilePage.heading).toBeVisible()
          await uploadFilePage.assertReturnLinks(target)

          await uploadFilePage.backLink.click()
          await expect(page).toHaveURL(new RegExp(target))
        }
      )

      // AC9a and AC9b. There is no back link on this page — the left nav is
      // the only way out, which is what makes following every one of its links
      // worth the click. `unit-type-navigation.test.js` proves the builder as
      // a pure function; what it cannot show is that the five hrefs resolve.
      test(
        'each left-navigation link opens its target page',
        { tag: '@happy-path' },
        async ({
          page,
          hedgerowsPostInterventionPage,
          projectSummaryPage,
          areaSummaryPage,
          hedgerowsSummaryPage,
          hedgerowsBaselinePage,
          watercoursesSummaryPage
        }) => {
          const destinations = [
            [SUMMARY, 'project-summary', projectSummaryPage.heading],
            [AREA_HABITATS, 'area-summary', areaSummaryPage.heading],
            [HEDGEROWS, 'hedgerows-summary', hedgerowsSummaryPage.heading],
            [
              BASELINE_NAV_CHILD,
              'hedgerows-baseline',
              hedgerowsBaselinePage.heading
            ],
            [
              WATERCOURSES,
              'watercourses-summary',
              watercoursesSummaryPage.heading
            ]
          ]

          for (const [label, path, heading] of destinations) {
            await hedgerowsPostInterventionPage.open(project.id)
            const target = `/projects/${project.id}/${path}`

            await expect(
              hedgerowsPostInterventionPage.navLink(label)
            ).toHaveAttribute('href', target)
            await hedgerowsPostInterventionPage.navLink(label).click()

            await expect(page).toHaveURL(new RegExp(target))
            await expect(heading).toBeVisible()
          }
        }
      )
    }
  )
})
