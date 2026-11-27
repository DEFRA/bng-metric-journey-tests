/**
 * A CSS selector for one cell of a row, by its index in a page's column map.
 * A negative index counts from the row's end, -1 being its last cell: the
 * area baseline grid adds a Tree size column when it lists a tree (BMD-1172),
 * so the columns after it are fixed only from the right.
 *
 * @param {number} index
 * @param {string} [tag] `td`, or `th` for a heading
 * @returns {string}
 */
export function cellSelector(index, tag = 'td') {
  return index >= 0
    ? `${tag}:nth-child(${index + 1})`
    : `${tag}:nth-last-child(${-index})`
}

/**
 * One feature row's cells, keyed by a page's column map, found by the Ref link
 * in its first cell.
 *
 * Throws unless exactly one row carries that Ref. Without the check a missing
 * row reads as every field `undefined`, and the test fails on a value
 * mismatch that hides the cause. Two rows would merge their cells instead.
 *
 * @param {import('@playwright/test').Locator} featureRows the table's body rows
 * @param {import('@playwright/test').Page} page the page, to root the link
 *   locator. A table-scoped one would be re-rooted under each row and match
 *   nothing.
 * @param {string} reference
 * @param {Record<string, number>} columns column name → cell index, a
 *   negative one counting from the row's end
 * @returns {Promise<Record<string, string>>}
 */
export async function rowValuesByRef(featureRows, page, reference, columns) {
  const row = featureRows.filter({
    has: page.getByRole('link', { name: reference, exact: true })
  })
  const count = await row.count()
  if (count !== 1) {
    throw new Error(`Expected one row with Ref ${reference}, found ${count}`)
  }
  const cells = await row.locator('td').allInnerTexts()
  return Object.fromEntries(
    Object.entries(columns).map(([column, index]) => [
      column,
      cells.at(index)?.trim()
    ])
  )
}
