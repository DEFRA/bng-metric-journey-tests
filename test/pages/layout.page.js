import { BasePage } from './base.page.js'

export class LayoutPage extends BasePage {
  constructor(page) {
    super(page)
    this.govUkHeader = page.getByRole('banner')
    this.serviceNameLink = page.getByRole('link', {
      name: 'Biodiversity Net Gain'
    })
    this.projectsNavLink = page
      .getByRole('navigation', { name: 'Menu' })
      .getByRole('link', { name: 'Projects' })
    this.betaTag = page.getByText('Beta', { exact: true })
    this.phaseBannerText = page.getByText(/This is a new service/)
    this.footer = page.getByRole('contentinfo')
    this.oglLink = page.getByRole('link', {
      name: 'Open Government Licence v3.0'
    })
    this.crownCopyrightLink = page.getByRole('link', {
      name: /Crown copyright/
    })
  }
}
