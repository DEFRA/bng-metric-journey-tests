import { BasePage } from './base.page.js'

export class LayoutPage extends BasePage {
  constructor(page) {
    super(page)
    // govuk-frontend v6 renders the header as a <div> (no banner landmark);
    // target the GOV.UK homepage link — the header's stable accessible handle.
    this.govUkHeader = page.getByRole('link', { name: 'GOV.UK' })
    this.serviceNameLink = page.getByRole('link', {
      name: 'Biodiversity Net Gain'
    })
    this.projectsNavLink = page
      .getByRole('navigation', { name: 'Menu' })
      .getByRole('link', { name: 'Projects' })
    this.signOutLink = page
      .getByRole('navigation', { name: 'Menu' })
      .getByRole('link', { name: 'Sign out' })
    this.changeOrganisationLink = page
      .getByRole('navigation', { name: 'Menu' })
      .getByRole('link', { name: 'Change organisation' })
    this.betaTag = page.getByText('Beta', { exact: true })
    this.phaseBannerText = page.getByText(/This is a new service/)
    // govuk-frontend v6 renders the footer as a <div> (no contentinfo landmark);
    // target the footer's visually-hidden "Support links" heading.
    this.footer = page.getByRole('heading', { name: 'Support links' })
    this.oglLink = page.getByRole('link', {
      name: 'Open Government Licence v3.0'
    })
    this.crownCopyrightLink = page.getByRole('link', {
      name: /Crown copyright/
    })
  }
}
