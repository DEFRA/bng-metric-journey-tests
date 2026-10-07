import { AreaPostInterventionPage } from '@pages/area-post-intervention.page.js'
import { HedgerowsPostInterventionPage } from '@pages/hedgerows-post-intervention.page.js'
import { WatercoursesPostInterventionPage } from '@pages/watercourses-post-intervention.page.js'

// BMD-1043 (frontend PR#352) removed the post-intervention habitat list. Each
// feature type's grid now lives on its own unit-type post-intervention page,
// split into Retained / Enhanced / Created tabs.
const PI_PAGES = {
  area: { path: 'area-post-intervention', Page: AreaPostInterventionPage },
  hedgerow: {
    path: 'hedgerows-post-intervention',
    Page: HedgerowsPostInterventionPage
  },
  watercourse: {
    path: 'watercourses-post-intervention',
    Page: WatercoursesPostInterventionPage
  }
}
const INTERVENTION_TABS = ['Retained', 'Enhanced', 'Created']

export function piPage(page, type) {
  return new PI_PAGES[type].Page(page)
}

// Anchored so the URL cannot match a longer path; the grid's tab anchor
// (e.g. `#retained`) is allowed.
export function piPageUrl(projectId, type) {
  return new RegExp(`/projects/${projectId}/${PI_PAGES[type].path}(?:[?#]|$)`)
}

/**
 * Open a feature type's post-intervention page and select the intervention tab
 * whose grid holds `ref`. GOV.UK Tabs hides inactive panels, and hidden links
 * expose no ARIA role, so each tab is selected before its grid is searched.
 *
 * Returns `{ unitPage, label }`, or null when no tab holds the ref.
 */
export async function findPiRef(page, projectId, type, ref) {
  const unitPage = piPage(page, type)
  await unitPage.open(projectId)
  for (const label of INTERVENTION_TABS) {
    const tab = unitPage.tab(label)
    if ((await tab.count()) === 0) {
      continue
    }
    await tab.click()
    if ((await unitPage.refLink(label, ref).count()) > 0) {
      return { unitPage, label }
    }
  }
  return null
}

/** As `findPiRef`, but a missing ref is an error. */
export async function openPiTabFor(page, projectId, type, ref) {
  const found = await findPiRef(page, projectId, type, ref)
  if (!found) {
    throw new Error(`No ${ref} on the ${type} post-intervention page`)
  }
  return found
}
