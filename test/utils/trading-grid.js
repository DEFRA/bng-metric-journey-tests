/**
 * Read a trading-summary grid as text: its column headings, then every body
 * and footer row as trimmed cell text. A totals row is made of `<td>` cells in
 * `<tfoot>`, so it comes back as the last entry in `rows`; the header row has
 * no `cell`s and is skipped.
 *
 * Shared by the area, hedgerows and watercourses trading summaries, which all
 * render their grids through the frontend's `trading-summary/macro.njk`.
 *
 * @param {import('@playwright/test').Locator} table
 * @returns {Promise<{ headers: string[], rows: string[][] }>}
 */
export async function readTradingGrid(table) {
  const headers = await table.getByRole('columnheader').allInnerTexts()
  const rows = []
  for (const row of await table.getByRole('row').all()) {
    const cells = await row.getByRole('cell').allInnerTexts()
    if (cells.length > 0) {
      rows.push(cells.map((cell) => cell.trim()))
    }
  }
  return { headers: headers.map((header) => header.trim()), rows }
}
