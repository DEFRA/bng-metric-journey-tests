const NOT_FOUND = -1

/**
 * Read the value rendered directly beneath a tile heading within a region.
 *
 * Tiles carry no role of their own — a heading followed by a paragraph — so the
 * region's rendered text is split into lines and the line after the heading is
 * returned. That keeps the lookup off CSS selectors while still anchoring it to
 * the visible heading rather than a positional index.
 *
 * @param {import('@playwright/test').Locator} region
 * @param {string} tileHeading
 * @param {string} [within] describes the region, for the error message
 * @returns {Promise<string>}
 */
export async function readTileValue(region, tileHeading, within = '') {
  const text = await region.innerText()
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const headingIndex = lines.indexOf(tileHeading)

  if (headingIndex === NOT_FOUND || headingIndex === lines.length - 1) {
    const where = within ? ` in the "${within}" section` : ''
    throw new Error(
      `No value found under "${tileHeading}"${where}. Rendered lines: ${JSON.stringify(lines)}`
    )
  }

  return lines[headingIndex + 1]
}

/** The numeric part of a "N.NN units" tile value. */
export async function readTileUnits(region, tileHeading, within = '') {
  const value = await readTileValue(region, tileHeading, within)
  return Number(value.replace(' units', ''))
}
