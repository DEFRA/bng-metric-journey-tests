// Units render to 2 dp, so a correctly priced row sits within half a hundredth
// of its product (plus float noise).
export const UNITS_ROUNDING = 0.005 + 1e-9

/**
 * The multiplier in a "{label} ({score})" grid cell.
 *
 * @param {string} cell
 * @returns {number}
 */
export function score(cell) {
  return Number(/\((-?[\d.]+)\)$/.exec(cell)[1])
}
