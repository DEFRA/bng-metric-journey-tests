# Coding Rules

## Imports

- Always import `test` and `expect` from `@fixtures` (re-exported from `test/fixtures/index.js`).
- Import page objects from `@pages/<name>.page.js`.
- Import flows from `@flows/<name>.flow.js`.
- Never import from `@playwright/test` directly in test or fixture files.

## JavaScript

- ESM only (`"type": "module"` in package.json). Use `import`/`export`, never `require`.
- `async`/`await` throughout — no `.then()` chains in test code.
- No unused variables. No `console.log` in committed code.

## Selectors

Priority order (highest to lowest):

1. `getByRole('button', { name: 'Sign in' })` — preferred for interactive elements
2. `getByLabel('Email address')` — preferred for form inputs
3. `getByTestId('sign-in-button')` — for GOV.UK components with `data-testid`
4. `getByText('some text')` — last resort, non-interactive elements only

Never use:

- CSS class selectors: `locator('.govuk-button')`
- XPath: `locator('//button')`
- `$()` or `$$()` (WDIO-style)

## Waiting

- No `waitForTimeout`. Playwright auto-waits on all locator actions and assertions.
- Use web-first assertions: `await expect(locator).toBeVisible()` — these retry automatically.
- If you need to wait for navigation, use `page.waitForLoadState('domcontentloaded')` immediately after `page.goto()` in page object `open()` methods.

## Test Isolation

- Every test must be independent — no shared mutable state between tests.
- Each spec file uses its own fixture instances (Playwright creates them per-test).
- Do not rely on test execution order.

## Assertions

- Assertions in specs: fine for test-specific checks.
- Assertions in page objects: only inside named `assert*` methods (e.g. `assertSignInVisible()`), to enable reuse across specs.
- Never assert inside a constructor or `open()` method.

## ESLint / Prettier

- Run `npm run lint` and `npm run format:check` before committing.
- Prettier config: 2-space indent, no semicolons, single quotes, no trailing commas (see `.prettierrc.js`).

## File Naming

- Page objects: `test/pages/<name>.page.js`
- Flows: `test/flows/<domain>/<name>.flow.js` and `test/flows/<domain>/<name>.flow.md`
- Specs: `test/specs/<domain>/<name>.spec.js`
- Fixtures: extend `test/fixtures/index.js` in place — one fixture file.

## e2e Mode and Authenticated Describes

Every `describe` block that uses `storageState` must include a skip guard so it does not run on the CDP portal (where stub auth is unavailable):

```js
const E2E_SKIP_REASON = 'Requires stub auth — not available in e2e mode'

test.describe('Feature — some describe', () => {
  test.use({ storageState: STORAGE_STATE })
  test.skip(runMode === 'e2e', E2E_SKIP_REASON)
})
```

- Define `E2E_SKIP_REASON` as a file-level constant (avoids SonarCloud duplicate-literal violations).
- Unauthenticated describes (no `storageState`) must **not** receive `test.skip`.

## @smoke Tagging

Tag tests `@smoke` for: happy path, key unauthenticated redirect per protected route, key role-enforcement redirect, one representative validation error per form. Do not tag exhaustive validation variants, sort-order tests, or error-state edge cases. See `AGENTS.md` for the full rule.

## What to Avoid

- No `test.only` in committed code.
- No hard-coded `sleep`/`waitForTimeout`.
- No business logic (multi-step workflows, cross-page navigation) inside page objects.
- No selector logic inside specs.
