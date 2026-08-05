import js from '@eslint/js'
import neostandard from 'neostandard'
import prettierRecommended from 'eslint-plugin-prettier/recommended'

export default [
  {
    ignores: [
      // one-off ticket-evidence scripts, never lint-clean
      'docs/',
      'allure-results/',
      'allure-report/',
      'docker/',
      'playwright-report/',
      'test-results/',
      'test/evidence/'
    ]
  },
  js.configs.recommended,
  // noStyle: formatting is Prettier's job
  ...neostandard({ env: ['node'], noStyle: true }),
  prettierRecommended,
  {
    rules: {
      'no-console': 'error'
    }
  },
  {
    // CLI tooling scripts (husky hooks, gitleaks install) report progress to
    // the developer's terminal — console is the correct output channel here.
    files: ['scripts/**/*.mjs'],
    rules: {
      'no-console': 'off'
    }
  }
]
