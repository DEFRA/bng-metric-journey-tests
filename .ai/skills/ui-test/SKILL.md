# Skill: UI Test Generation — BNG Metric

Use this skill when asked to write a new Playwright test for the BNG Metric Tool.

---

## Service Context

**Frontend:** Hapi.js + Nunjucks, GOV.UK Frontend, port 3000.
**Templates location:** `../bng-metric-frontend/src/server/<route>/index.njk`
**Routes file:** `../bng-metric-frontend/src/server/router.js`
**Service name:** `Biodiversity Net Gain` (appears in page titles as `<Page Title> - Biodiversity Net Gain`)

---

## GOV.UK Selector Patterns

| UI element                | Preferred selector                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------- |
| Primary button            | `getByRole('button', { name: 'Submit' })` or `getByTestId('...')` if testid present |
| Start button              | `getByRole('link', { name: 'Sign in' })` (GOV.UK start buttons render as `<a>`)     |
| Text input                | `getByLabel('Field label text')`                                                    |
| Textarea                  | `getByLabel('Field label text')`                                                    |
| Radio group               | `getByRole('radio', { name: 'Option label' })`                                      |
| Checkbox                  | `getByRole('checkbox', { name: 'Option label' })`                                   |
| Select / dropdown         | `getByLabel('Label text')`                                                          |
| Error summary             | `getByRole('alert')` or `getByText('There is a problem')`                           |
| Error on field            | `getByText('Enter a valid ...')`                                                    |
| Page heading              | `getByRole('heading', { name: 'Heading text' })`                                    |
| Phase banner              | `getByText('Beta')`                                                                 |
| Data testids in templates | `getByTestId('<value of data-testid>')`                                             |

---

## Known data-testid Values (Home Page)

| Testid           | Element                                          |
| ---------------- | ------------------------------------------------ |
| `app-page-body`  | Main content wrapper div                         |
| `sign-in-button` | Sign-in start button (unauthenticated)           |
| `signed-in-as`   | "Signed in as <email>" paragraph (authenticated) |

---

## How to Add a Page Object

1. Create `test/pages/<name>.page.js`.
2. `import { BasePage } from './base.page.js'`
3. Define locators in the constructor using `getByRole`, `getByLabel`, `getByTestId`.
4. Add an `open()` method calling `super.open('/path')`.
5. Add named `assert*` methods for assertions that will be reused across specs.

Example:

```javascript
import { BasePage } from './base.page.js'

export class ExamplePage extends BasePage {
  constructor(page) {
    super(page)
    this.heading = page.getByRole('heading', { name: 'Example' })
    this.continueButton = page.getByRole('button', { name: 'Continue' })
  }

  async open() {
    await super.open('/example')
  }

  async assertHeadingVisible() {
    const { expect } = await import('@playwright/test')
    await expect(this.heading).toBeVisible()
  }
}
```

---

## How to Add a Flow

1. Create `test/flows/<journey>.flow.js`.
2. Import relevant page objects.
3. Export a class with async methods that perform multi-step user journeys.
4. Pass `page` in the constructor; instantiate page objects there.

---

## How to Add a Fixture

In `test/fixtures/index.js`, add a new property to the `test.extend({})` call:

```javascript
examplePage: async ({ page }, use) => {
  await use(new ExamplePage(page))
}
```

---

## How to Write a Spec

```javascript
import { test, expect } from '@fixtures'

test.describe('Feature name', () => {
  test('user can do X @smoke', async ({ examplePage, page }) => {
    await examplePage.open()
    await expect(page).toHaveTitle('Page Title - Biodiversity Net Gain')
    await expect(examplePage.heading).toBeVisible()
  })
})
```

Tag smoke tests with `@smoke` in the test title. This allows `PROFILE=@smoke` filtering.

---

## Routes Available for Testing

| Route                       | Description                | Auth required |
| --------------------------- | -------------------------- | ------------- |
| `GET /`                     | Home page                  | No            |
| `GET /health`               | Health check               | No            |
| `GET /auth/login`           | OIDC login initiation      | No            |
| `GET /project-dashboard`    | Projects list              | Yes           |
| `GET /projects/:id`         | Project detail             | Yes           |
| `GET /upload-baseline-file` | Upload baseline GeoPackage | Yes           |

---

## Coverage-Gap Analysis Template

Before writing E2E tests, check if the feature is already covered at integration level. For each AC:

| AC  | Frontend test covers it? | Backend test covers it? | Recommendation           |
| --- | ------------------------ | ----------------------- | ------------------------ |
| AC1 | Yes (controller.test.js) | —                       | Descope from E2E         |
| AC2 | No                       | No                      | Write E2E                |
| AC3 | No                       | Yes (route.test.js)     | Enhance integration test |

Only `Write E2E` items need test code.
