// BMD-1058 AC6: the habitat grids show at most 10 characters of a ref, then an
// ellipsis. The frontend (`buildRefCell` in common/helpers/habitat-grid.js)
// renders a cut ref as three spans: the first 10 characters, the rest visually
// hidden for assistive technology, and an aria-hidden "…".
import { expect } from '@fixtures'

export const MAX_REF_DISPLAY_LENGTH = 10
const TRUNCATION_MARK = '…'

/**
 * The accessible name of a ref's grid link. A cut ref's name is the whole ref
 * with a space at the cut ("Café–Ω H00 3"): Chromium joins the absolutely
 * positioned visually-hidden tail as a separate block. A ref that fits is
 * named as it is.
 *
 * Characters are counted as code points, as the frontend counts them.
 *
 * @param {string} ref
 */
export function gridRefName(ref) {
  const characters = Array.from(ref)
  if (characters.length <= MAX_REF_DISPLAY_LENGTH) {
    return ref
  }
  return `${characters.slice(0, MAX_REF_DISPLAY_LENGTH).join('')} ${characters
    .slice(MAX_REF_DISPLAY_LENGTH)
    .join('')}`
}

/** A grid ref link cut short: its first 10 characters, then "…". */
export async function expectRefCut(link, ref) {
  const shown = Array.from(ref).slice(0, MAX_REF_DISPLAY_LENGTH).join('')
  await expect(link).toBeVisible()
  await expect(link.getByText(shown, { exact: true })).toBeVisible()
  await expect(link.getByText(TRUNCATION_MARK, { exact: true })).toBeVisible()
}

/** A grid ref link short enough to be shown whole, with no "…". */
export async function expectRefWhole(link, ref) {
  await expect(link).toHaveText(ref)
  await expect(link.getByText(TRUNCATION_MARK, { exact: true })).toHaveCount(0)
}

// govuk-visually-hidden renders its text in a 1px box.
const VISUALLY_HIDDEN_SIZE_PX = 1

/**
 * A cut ref's tail, past the first 10 characters, kept for assistive
 * technology but rendered in a visually hidden box rather than on screen.
 */
export async function expectRefTailHidden(link, ref) {
  const tail = Array.from(ref).slice(MAX_REF_DISPLAY_LENGTH).join('')
  const box = await link.getByText(tail, { exact: true }).boundingBox()
  expect(box, `the hidden tail of ${ref}`).not.toBeNull()
  expect(box.width).toBeLessThanOrEqual(VISUALLY_HIDDEN_SIZE_PX)
  expect(box.height).toBeLessThanOrEqual(VISUALLY_HIDDEN_SIZE_PX)
}
