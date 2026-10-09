// Units render to 2 dp, so a correctly priced row sits within half a hundredth
// of the product of its displayed inputs.
const UNITS_DISPLAY_ROUNDING = 0.005
// The inputs are displayed rounded too (size to 7–10 significant figures, the
// time-to-target score to 10 digits), and the product scales that rounding.
// 0.5% of the product leaves headroom for far coarser inputs than today's,
// while staying well under the 10–15% a mispriced strategic significance adds.
const INPUT_ROUNDING_RATIO = 0.005

/**
 * How far a row's displayed units may sit from the product of its displayed
 * multipliers and still be correctly priced.
 *
 * @param {number} product
 * @returns {number}
 */
export function unitsTolerance(product) {
  return UNITS_DISPLAY_ROUNDING + INPUT_ROUNDING_RATIO * Math.abs(product)
}

/**
 * The multiplier in a "{label} ({score})" grid cell.
 *
 * @param {string} cell
 * @returns {number}
 */
export function score(cell) {
  return Number(/\((-?[\d.]+)\)$/.exec(cell)[1])
}
