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

// govuk-visually-hidden renders its text in a 1px box, with overflow hidden
// and the box clipped away (clip: rect(0 0 0 0) and clip-path: inset(50%)), so
// none of the text paints, however far it runs past the box.
const VISUALLY_HIDDEN_SIZE_PX = 1
const NO_CLIP = new Set(['auto', 'none', ''])

/**
 * A cut ref's tail, past the first 10 characters, kept for assistive
 * technology but rendered in a visually hidden box rather than on screen: a
 * box of 1px or less that hides its overflow and is clipped. A box alone would
 * not do, as text overflowing it still shows.
 */
export async function expectRefTailHidden(link, ref) {
  const label = `the hidden tail of ${ref}`
  const tailText = Array.from(ref).slice(MAX_REF_DISPLAY_LENGTH).join('')
  const tail = link.getByText(tailText, { exact: true })
  const box = await tail.boundingBox()
  expect(box, label).not.toBeNull()
  expect(box.width, label).toBeLessThanOrEqual(VISUALLY_HIDDEN_SIZE_PX)
  expect(box.height, label).toBeLessThanOrEqual(VISUALLY_HIDDEN_SIZE_PX)
  const { overflow, clip, clipPath } = await tail.evaluate((element) => {
    const style = element.ownerDocument.defaultView.getComputedStyle(element)
    return {
      overflow: style.overflow,
      clip: style.clip,
      clipPath: style.clipPath
    }
  })
  expect(overflow, label).toBe('hidden')
  expect(
    !NO_CLIP.has(clip) || !NO_CLIP.has(clipPath),
    `${label} is clipped (clip: ${clip}, clip-path: ${clipPath})`
  ).toBe(true)
}
