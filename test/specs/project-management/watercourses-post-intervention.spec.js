import { test, expect } from '@fixtures'
import { STORAGE_STATE, skipInE2e } from '@utils/env.js'
import { uploadFileHref } from '@utils/upload-file-navigation.js'
import { getWatercourseInterventionTypesProject } from '@utils/summary-projects.js'
import {
  AREA_HABITATS,
  BASELINE_NAV_CHILD,
  HEDGEROWS,
  POST_INTERVENTION_NAV_CHILD,
  SUMMARY,
  TILE_BASELINE,
  VIEW_ON_SITE_POST_INTERVENTION,
  VIEW_ON_SITE_WATERCOURSES_BASELINE,
  WATERCOURSES
} from '@utils/unit-type-labels.js'

// The watercourses post-intervention page (BMD-862) —
// `/projects/{id}/watercourses-post-intervention`. See
// test/flows/project-management/watercourses-post-intervention.flow.md.
//
// `watercourses-post-intervention/controller.test.js` already covers this
// page's markup in 13 tests, all with `wreck` mocked and four hand-built
// watercourses. Everything here is scoped to what that cannot reach: real
// backend fields, hrefs that actually resolve, and the client-side tab
// component.
//
// The hedgerow twin's tests do not stand in for any of it. Both pages come from
// `createHabitatPostInterventionController`, which takes the habitat key, the
// size reader and the `baselineUnits` selector as per-page config — so every
// one of those could be re-pointed at hedgerows with
// hedgerows-post-intervention.spec.js staying green.
//
// The grids inside the tabs are BMD-999 and are deliberately NOT covered here:
// BMD-862 shipped the tab shell only.

const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'
// The shared-build upload budget, applied to the whole file below. It has to
// sit on `describe.configure` rather than on a test: the build runs in
// `beforeAll`, so a `test.setTimeout()` in a test body comes too late to
// extend it.
const SHARED_BUILD_TEST_TIMEOUT = 180_000

const PAGE_PATH = 'watercourses-post-intervention'

const TILE_NET_PERCENTAGE = 'Total on-site net percentage change'
const TILE_TRADING_RULES = 'Trading Rules'
const TILE_POST_INTERVENTION = 'On-site post-intervention'
const TILE_NET_UNIT_CHANGE = 'Total on-site net unit change'

// The five tiles AC5 enumerates, in rendered order. The post-intervention
// heading is the HYPHENATED spelling — `buildPostInterventionSummary` picks it
// for a standard intervention, and the unhyphenated one only for the
// post-intervention-only shape, which this page's fixture never reaches.
const TILES = [
  TILE_NET_PERCENTAGE,
  TILE_TRADING_RULES,
  TILE_BASELINE,
  TILE_POST_INTERVENTION,
  TILE_NET_UNIT_CHANGE
]

// The three tiles whose values come from the same backend fields on the
// watercourses summary, so the two pages must render identical strings.
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

// AC5's exception, written as a pattern rather than as
// VIEW_ON_SITE_WATERCOURSES_POST_INTERVENTION: the AC spells the wording it
// wants removed "View on-site watercourse post-intervention" while the app
// spells it "View on-site watercourses post intervention", so an exact match
// against either one alone would pass while the other spelling sat on the page.
const NO_PI_SELF_LINK = /View on-site watercourses? post[- ]intervention/i

async function expectTabSelected(watercoursesPage, label) {
  await expect(watercoursesPage.tab(label)).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(watercoursesPage.panelHeading(label)).toBeVisible()
}

async function expectTabNotSelected(watercoursesPage, label) {
  await expect(watercoursesPage.tab(label)).toHaveAttribute(
    'aria-selected',
    'false'
  )
  await expect(watercoursesPage.panelHeading(label)).toBeHidden()
}

// The href half is asserted on the DOM rather than the accessibility tree:
// role="tab" REPLACES the implicit link role, so getByRole('link') can never
// match a tab.
async function expectTabsUnselectedAndLinked(watercoursesPage, labels) {
  for (const label of labels) {
    await expectTabNotSelected(watercoursesPage, label)
    await expect(
      watercoursesPage.tab(label),
      `${label} tab href`
    ).toHaveAttribute('href', watercoursesPage.tabHref(label))
  }
}

test.describe('project-management', { tag: '@project-management' }, () => {
  // Uploads are the slowest step we own and concurrent ones clobber the shared
  // `pendingUploadId` yar key, so the file runs in one worker. The timeout is
  // the shared-build upload budget: a cold `beforeAll` here pays create + two
  // uploads, which overruns the config's 60s default.
  test.describe.configure({
    mode: 'serial',
    timeout: SHARED_BUILD_TEST_TIMEOUT
  })

  // ─── Page content (BMD-862 AC3, AC4, AC5) ───────────────────────────────────

  test.describe('Watercourses post-intervention — page content', () => {
    test.use({ storageState: STORAGE_STATE })
    test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

    let project
    test.beforeAll(async ({ browser }) => {
      project = await getWatercourseInterventionTypesProject(browser)
    })

    // AC4 and AC8's href half.
    test(
      'renders the header, project name and upload action from real backend data',
      { tag: ['@smoke', '@happy-path'] },
      async ({ watercoursesPostInterventionPage }) => {
        await watercoursesPostInterventionPage.open(project.id)

        await expect(watercoursesPostInterventionPage.heading).toBeVisible()
        await expect(
          watercoursesPostInterventionPage.caption(project.name)
        ).toBeVisible()
        await expect(
          watercoursesPostInterventionPage.resultsHeading
        ).toBeVisible()
        await expect(
          watercoursesPostInterventionPage.detailsHeading
        ).toBeVisible()

        // The upload button's returnUrl is built by THIS controller for this
        // page. The watercourses summary asserting its own copy proves nothing
        // here — the value is chosen per caller, so each page needs its own
        // witness.
        await expect(
          watercoursesPostInterventionPage.uploadFileButton
        ).toHaveAttribute(
          'href',
          uploadFileHref(project.id, `/projects/${project.id}/${PAGE_PATH}`)
        )
      }
    )

    // AC5.
    test('renders the five results tiles with no post-intervention self-link', async ({
      watercoursesPostInterventionPage
    }) => {
      await watercoursesPostInterventionPage.open(project.id)

      await expect(watercoursesPostInterventionPage.tileHeadings()).toHaveText(
        TILES
      )

      // Reads `postIntervention.units.watercoursesTotal` and
      // `baseline.units.watercoursesTotal` — different backend fields from the
      // hedgerow page's hedgerowsTotal and the area page's habitatsTotal +
      // treesTotal. The frontend unit tests mock wreck, so nothing else proves
      // these fields are really emitted.
      expect(
        await watercoursesPostInterventionPage.tileValue(TILE_BASELINE)
      ).toMatch(UNITS_2DP)
      expect(
        await watercoursesPostInterventionPage.tileValue(TILE_POST_INTERVENTION)
      ).toMatch(UNITS_2DP)

      // AC5's exception. The baseline tile keeps its link while the
      // post-intervention tile has NO action line at all: the controller
      // passes `interventionAction: null`, which `resolveInterventionAction`
      // treats differently from `undefined` (which would fall back to the
      // shared inert "View on-site post intervention" default). A mock that
      // passes neither renders identically, so only the real controller
      // distinguishes them.
      const section = watercoursesPostInterventionPage.unitSection()
      await expect(section.getByText(NO_PI_SELF_LINK)).toHaveCount(0)
      await expect(
        section.getByText(VIEW_ON_SITE_POST_INTERVENTION, { exact: true })
      ).toHaveCount(0)
      await expect(
        section.getByRole('link', { name: VIEW_ON_SITE_WATERCOURSES_BASELINE })
      ).toBeVisible()
    })

    // AC5: "the same set of tiles as shown on the Project Summary page and the
    // Watercourses Unit Summary page". Both pages read `watercoursesTotal`
    // through the same formatter, so the rendered strings must match exactly —
    // a mismatch means one of them has been re-pointed at a different backend
    // field. Compared nowhere else.
    test('the results tiles agree with the watercourses summary page', async ({
      watercoursesPostInterventionPage,
      watercoursesSummaryPage
    }) => {
      await watercoursesSummaryPage.open(project.id)
      const fromSummary = {}
      for (const tile of SHARED_TILES) {
        fromSummary[tile] = await watercoursesSummaryPage.tileValue(tile)
      }

      await watercoursesPostInterventionPage.open(project.id)
      for (const tile of SHARED_TILES) {
        expect(
          await watercoursesPostInterventionPage.tileValue(tile),
          tile
        ).toBe(fromSummary[tile])
      }
    })

    // AC3. The only shape in the service where the current nav item is a
    // Post-intervention child nested under WATERCOURSES.
    // `unit-type-navigation.test.js` proves the builder as a pure function and
    // `watercourses-post-intervention/controller.test.js:219` proves the markup
    // against a mocked payload; neither shows the conditional items surviving a
    // real import. Both conditions are live in this fixture: the baseline
    // carries WC1 (so the Baseline child renders) and two hedgerows (so the
    // Hedgerows item renders even though the post-intervention file has none).
    test('the left navigation marks this page current under Watercourses', async ({
      watercoursesPostInterventionPage
    }) => {
      await watercoursesPostInterventionPage.open(project.id)

      for (const item of [SUMMARY, AREA_HABITATS, HEDGEROWS, WATERCOURSES]) {
        await expect(
          watercoursesPostInterventionPage.navLink(item),
          `nav link "${item}"`
        ).toBeVisible()
      }

      await expect(
        watercoursesPostInterventionPage.navLink(BASELINE_NAV_CHILD)
      ).toHaveAttribute(
        'href',
        `/projects/${project.id}/watercourses-baseline-summary`
      )

      // "In bold, to indicate it is the current page" is a <strong
      // aria-current="page"> with no href — markCurrent deletes the href, so
      // there is nothing left to click.
      await expect(
        watercoursesPostInterventionPage.currentNavItem()
      ).toHaveText(POST_INTERVENTION_NAV_CHILD)
      await expect(
        watercoursesPostInterventionPage.navLink(POST_INTERVENTION_NAV_CHILD)
      ).toHaveCount(0)
    })
  })

  // ─── Intervention type tabs (BMD-862 AC6, AC7) ──────────────────────────────
  //
  // Sole witness in any suite for the WATERCOURSE tab behaviour, for three
  // separate reasons:
  //
  //  - Tab VISIBILITY runs each feature's raw `retentionCategory` through
  //    `interventionDisplay`, which strips a leading "N. " list prefix. The
  //    backend normalises the value to pick an engine calculation but never
  //    writes it back (see the header of
  //    post-intervention-habitat-details/retention.js), so the document keeps
  //    whatever the GeoPackage carried. `controller.test.js:248` hands the
  //    filter already-shaped values — one of them the literal '1. Enhanced' —
  //    so only a real upload proves a surveyed file lands in the right tab.
  //  - Tab SWITCHING is the GOV.UK Tabs component — client-side JavaScript.
  //    The frontend unit tests parse markup with cheerio and never run it.
  //  - `visibleInterventionTabs` is called per unit type with that unit type's
  //    own features, so the hedgerow tab tests in
  //    hedgerows-post-intervention.spec.js witness none of this.
  //
  // Do not delete without adding a replacement that uploads a watercourse file
  // carrying more than one retention category.

  test.describe(
    'Watercourses post-intervention — intervention type tabs',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getWatercourseInterventionTypesProject(browser)
      })

      // AC6.
      test(
        'shows one tab per intervention type present, with the first selected on load',
        { tag: '@happy-path' },
        async ({ watercoursesPostInterventionPage }) => {
          await watercoursesPostInterventionPage.open(project.id)

          // Array form asserts the rendered ORDER as well as the labels, which
          // is what AC6's "the first visible tab, from Retained, Enhanced,
          // Created" rule rests on. Order comes from INTERVENTION_TAB_ORDER,
          // not from the data — the fixture's WC1/WC2/WC3 are Retained,
          // Enhanced and Created respectively.
          await expect(watercoursesPostInterventionPage.tabs).toHaveText(
            ALL_TABS
          )

          await expectTabSelected(watercoursesPostInterventionPage, RETAINED)

          // AC6's "additional visible tabs are links".
          await expectTabsUnselectedAndLinked(
            watercoursesPostInterventionPage,
            [ENHANCED, CREATED]
          )
        }
      )

      // AC7.
      test(
        'clicking a tab selects it, moves focus and reveals its panel',
        { tag: '@happy-path' },
        async ({ watercoursesPostInterventionPage }) => {
          await watercoursesPostInterventionPage.open(project.id)

          await watercoursesPostInterventionPage.tab(ENHANCED).click()

          // Selection is asserted through aria-selected, not through the label
          // ceasing to be a link: the GOV.UK component keeps every tab an <a>.
          // The AC's "becomes text only (not a link)" bullet was withdrawn on
          // the hedgerow twin (BMD-860 ticket comment, 2026-09-09) for exactly
          // this reason; BMD-862 repeats the bullet but not the withdrawal.
          await expectTabSelected(watercoursesPostInterventionPage, ENHANCED)
          await expect(
            watercoursesPostInterventionPage.tab(ENHANCED)
          ).toBeFocused()

          await expectTabsUnselectedAndLinked(
            watercoursesPostInterventionPage,
            [RETAINED, CREATED]
          )

          // Selecting Created is the only way its subheading is ever asserted
          // VISIBLE: every other test in this file sees that heading hidden.
          await watercoursesPostInterventionPage.tab(CREATED).click()
          await expectTabSelected(watercoursesPostInterventionPage, CREATED)
          await expectTabNotSelected(watercoursesPostInterventionPage, ENHANCED)
        }
      )
    }
  )

  // ─── Navigation wiring (BMD-862 AC2a, AC2b, AC8, AC9) ───────────────────────

  test.describe(
    'Watercourses post-intervention — navigation wiring',
    { tag: '@regression' },
    () => {
      test.use({ storageState: STORAGE_STATE })
      test.skip(skipInE2e(STORAGE_STATE), E2E_SKIP_REASON)

      let project
      test.beforeAll(async ({ browser }) => {
        project = await getWatercourseInterventionTypesProject(browser)
      })

      // AC2a and AC2b. Two separate view-model paths that happen to share a
      // target: the nav child comes from `buildSectionChildren`, the tile link
      // from `watercoursesInterventionAction`.
      // `watercourses-summary/controller.test.js:138,300` proves both are
      // rendered against mocked data, and watercourses-summary.spec.js:251
      // proves the tile link is VISIBLE on real data — but until this test
      // neither had been followed, and neither had its href checked against
      // real data.
      test(
        'both watercourses summary triggers open this page',
        { tag: '@happy-path' },
        async ({
          page,
          watercoursesSummaryPage,
          watercoursesPostInterventionPage
        }) => {
          const target = `/projects/${project.id}/${PAGE_PATH}`

          await watercoursesSummaryPage.open(project.id)
          const interventionLink = watercoursesSummaryPage.interventionLink()
          await expect(interventionLink).toHaveAttribute('href', target)
          await interventionLink.click()
          await expect(page).toHaveURL(new RegExp(target))
          await expect(watercoursesPostInterventionPage.heading).toBeVisible()

          // Route two: the left nav's Post-intervention child.
          await watercoursesSummaryPage.open(project.id)
          await watercoursesSummaryPage
            .navLink(POST_INTERVENTION_NAV_CHILD)
            .click()
          await expect(page).toHaveURL(new RegExp(target))
          await expect(watercoursesPostInterventionPage.heading).toBeVisible()
        }
      )

      // AC8. The unit test asserts the upload href is in the markup; only a
      // real navigation shows that following it resolves and that Back/Cancel
      // come back HERE rather than defaulting to the task list.
      test(
        '"Upload file" opens the file-type selection page, whose Back returns here',
        { tag: '@happy-path' },
        async ({ page, watercoursesPostInterventionPage, uploadFilePage }) => {
          const target = `/projects/${project.id}/${PAGE_PATH}`
          await watercoursesPostInterventionPage.open(project.id)

          await watercoursesPostInterventionPage.uploadFileButton.click()

          await expect(uploadFilePage.heading).toBeVisible()
          await uploadFilePage.assertReturnLinks(target)

          await uploadFilePage.backLink.click()
          await expect(page).toHaveURL(new RegExp(target))
        }
      )

      // AC9. There is no back link on this page — the left nav is the only way
      // out, which is what makes following every one of its links worth the
      // click. `unit-type-navigation.test.js` proves the builder as a pure
      // function; what it cannot show is that the five hrefs resolve.
      test(
        'each left-navigation link opens its target page',
        { tag: '@happy-path' },
        async ({
          page,
          watercoursesPostInterventionPage,
          projectSummaryPage,
          areaSummaryPage,
          hedgerowsSummaryPage,
          watercoursesSummaryPage,
          watercoursesBaselinePage
        }) => {
          const destinations = [
            [SUMMARY, 'project-summary', projectSummaryPage.heading],
            [AREA_HABITATS, 'area-summary', areaSummaryPage.heading],
            [HEDGEROWS, 'hedgerows-summary', hedgerowsSummaryPage.heading],
            [
              WATERCOURSES,
              'watercourses-summary',
              watercoursesSummaryPage.heading
            ],
            [
              BASELINE_NAV_CHILD,
              'watercourses-baseline-summary',
              watercoursesBaselinePage.heading
            ]
          ]

          for (const [label, path, heading] of destinations) {
            await watercoursesPostInterventionPage.open(project.id)
            const target = `/projects/${project.id}/${path}`

            await expect(
              watercoursesPostInterventionPage.navLink(label)
            ).toHaveAttribute('href', target)
            await watercoursesPostInterventionPage.navLink(label).click()

            await expect(page).toHaveURL(new RegExp(target))
            await expect(heading).toBeVisible()
          }
        }
      )
    }
  )
})
