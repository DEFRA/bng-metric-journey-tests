// `expect` comes straight from Playwright rather than from `@fixtures`, the way
// the page objects take it. This module is imported BY the page objects, which
// `test/fixtures/index.js` imports in turn — going through the barrel would
// close that loop.
import { expect } from '@playwright/test'

import { TILE_NET_PERCENTAGE, TILE_TRADING_RULES } from './unit-type-labels.js'

/**
 * Locators for the two status tags inside an `appUnitTypeSummary` section.
 *
 * Since BMD-1008 (frontend PR#317) a unit-type section can hold **two** tags
 * reading "Met" or "Not met":
 *
 *  - the **net-percentage** tag (BMD-870/852) — did the site clear the 10%
 *    net-gain target?
 *  - the **trading-rules** tag (BMD-1008, area habitats only) — did it satisfy
 *    the trading rules?
 *
 * They are different verdicts and disagree routinely: a site can gain 291.90%
 * and still break the trading rules, or lose units and satisfy them. A
 * section-scoped locator matching the tag *text* therefore resolves to both and
 * fails Playwright's strict mode — which is exactly what happened to four tests
 * in `project-summary.spec.js` when BMD-1008 landed. Scope to the tile.
 *
 * **This is the one place in the suite that reaches for a CSS class**, and it is
 * deliberate: a tile is a `<div>` with no ARIA role and the tag is a `<strong>`,
 * which has none either, so neither is reachable by role, and Playwright offers
 * no parent traversal to climb from the tile's `<h3>` to the tile. Centralised
 * here so the exception is made once, with its reasons, rather than copied into
 * four page objects. If the tag ever gains a role or a `data-testid`, this file
 * is the only one to change.
 *
 * `readTileValue(section, TILE_TRADING_RULES)` from `@utils/tile-value.js` reads
 * the same tag's **text** with no CSS at all — the tag is the line rendered
 * directly under the tile heading. Prefer it for the status itself and use the
 * locators here when the assertion needs the element (visibility, colour).
 */
const TILE = '.app-unit-type-summary__tile'
const TAG = 'strong.govuk-tag'

export const STATUS_MET = 'Met'
export const STATUS_NOT_MET = 'Not met'
export const GREEN_TAG_CLASS = /govuk-tag--green/
export const RED_TAG_CLASS = /govuk-tag--red/

/**
 * A tile within a unit-type summary section, found by its heading text.
 *
 * @param {import('@playwright/test').Locator} section the section region
 * @param {string} heading the tile's `<h3>` text
 */
export function tile(section, heading) {
  return section.locator(TILE).filter({ hasText: heading })
}

/**
 * The trading-rules status tag — "Met" (green) or "Not met" (red).
 *
 * Renders only for area habitats, and only once the backend has a verdict to
 * give: a post-intervention document whose figures were never calculated yields
 * `null` and no tag at all, because unknown is not failed. `toHaveCount(0)`
 * therefore reads naturally for both the out-of-scope unit types and that state.
 */
export function tradingRulesTag(section) {
  return tile(section, TILE_TRADING_RULES).locator(TAG)
}

/** The net-percentage status tag — the 10% net-gain verdict, not this one. */
export function netPercentageTag(section) {
  return tile(section, TILE_NET_PERCENTAGE).locator(TAG)
}

/** A GOV.UK tag anywhere inside a cell — the habitat list's summary table. */
export function tagIn(cell) {
  return cell.locator(TAG)
}

/**
 * Assert a status tag reads `status` in the colour that status is painted.
 *
 * The colour is derived rather than passed: a call that named both could ask
 * for "Met" in red, and the pairing is the part of the ticket a test is least
 * likely to notice going wrong.
 *
 * @param {import('@playwright/test').Locator} tag
 * @param {typeof STATUS_MET | typeof STATUS_NOT_MET} status
 */
export async function expectStatusTag(tag, status) {
  await expect(tag).toHaveText(status)
  await expect(tag).toHaveClass(
    status === STATUS_MET ? GREEN_TAG_CLASS : RED_TAG_CLASS
  )
}
