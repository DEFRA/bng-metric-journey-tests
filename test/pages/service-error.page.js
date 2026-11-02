import { BasePage } from './base.page.js'

// The frontend's generic error page (catchAll in helpers/errors.js), which has
// no route of its own: any path can render it.
export class ServiceErrorPage extends BasePage {
  static title = 'Something went wrong - Biodiversity Net Gain'

  constructor(page) {
    super(page)
    this.message = page.getByText('Something went wrong', { exact: true })
  }
}
