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
 * @param {Record<string, number>} columns column name → cell index
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
      cells[index]?.trim()
    ])
  )
}
