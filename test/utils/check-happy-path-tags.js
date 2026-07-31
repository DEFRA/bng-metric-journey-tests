#!/usr/bin/env node
/* eslint-disable no-console -- CLI guard: console output is the intended interface */
// Enforces the mechanical half of the @happy-path rule (see AGENTS.md
// "@happy-path — what to tag"). @happy-path selects the concise CDP
// functional-journey suite: PROFILE=@happy-path npm run test:e2e.
//
// Two things are machine-checkable and enforced here:
//   1. Every @happy-path test RUNS on CDP — it must not be skipped under
//      RUN_MODE=e2e. A tag on a test that always skips there is pointless and
//      misleading (it would select a test that never actually runs on CDP).
//   2. No @happy-path test sits in an UNHAPPY describe — validation, role
//      enforcement, unauthenticated access, error/single-error pages, forbidden,
//      session-expired, or empty-state — because those provoke the error
//      responses the CDP monitoring alerts on.
//
// The other half of the rule — "is this a functional journey (an action/outcome,
// not a passive render) and not a redundant variant?" — is a human judgement the
// guard cannot make; it lives in the AGENTS.md rule and the reviewer's head.
//
// It reads Playwright's own resolved e2e test list (authoritative for both the
// describe hierarchy and the runMode==='e2e' skips), needs no browsers, and no
// CDP credentials (--list never connects).

import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HAPPY = 'happy-path' // Playwright strips the leading @ in reporter output

// Resolve the local Playwright CLI by absolute path and run it with the current
// Node binary — never look the command up on PATH (avoids executing an
// unexpected binary from a writeable PATH entry).
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)
const PLAYWRIGHT_CLI = path.join(
  REPO_ROOT,
  'node_modules',
  '.bin',
  'playwright'
)

// Describe titles (any ancestor) that mark a scenario as unhappy.
const UNHAPPY_DESCRIBE_PATTERNS = [
  /—\s*validation\b/i,
  /—\s*role enforcement\b/i,
  /—\s*unauthenticated/i,
  /access denied/i,
  /\berror file\b/i,
  /\bsingle[-\s]?error\b/i,
  /\bforbidden\b/i,
  /\bsession[-\s]?expir/i,
  /\bsession expiry\b/i,
  /\bempty state\b/i
]

function listE2eTests() {
  let raw
  try {
    raw = execFileSync(
      process.execPath,
      [PLAYWRIGHT_CLI, 'test', '--list', '--reporter=json'],
      {
        encoding: 'utf8',
        maxBuffer: 128 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          RUN_MODE: 'e2e',
          ENVIRONMENT: process.env.ENVIRONMENT || 'dev'
        }
      }
    )
  } catch (err) {
    // Playwright exits non-zero on a collection error but still prints the JSON
    // it managed to build on stdout; fall back to that.
    raw = err.stdout
  }
  if (!raw) {
    throw new Error('`playwright test --list` produced no output.')
  }
  return JSON.parse(raw)
}

// Flatten the suite tree into specs, carrying the ancestor-title chain and
// whether the spec is skipped under RUN_MODE=e2e (i.e. does not run on CDP).
function collectSpecs(suite, ancestors, out) {
  const chain = suite.title ? [...ancestors, suite.title] : ancestors
  for (const spec of suite.specs ?? []) {
    const test = (spec.tests ?? [])[0] ?? {}
    const skippedOnCdp = (test.annotations ?? []).some((a) => a.type === 'skip')
    out.push({ spec, chain, skippedOnCdp })
  }
  for (const child of suite.suites ?? []) {
    collectSpecs(child, chain, out)
  }
}

function main() {
  const report = listE2eTests()
  const specs = []
  for (const suite of report.suites ?? []) {
    collectSpecs(suite, [], specs)
  }

  const violations = []
  let happyCount = 0

  for (const { spec, chain, skippedOnCdp } of specs) {
    const tags = spec.tags ?? []
    if (!tags.includes(HAPPY)) {
      continue
    }
    happyCount++

    const where = `  ${spec.file}:${spec.line} — “${spec.title}”`

    if (skippedOnCdp) {
      violations.push(
        `${where}\n    → tagged @happy-path but is skipped on CDP (RUN_MODE=e2e); it would never run there.`
      )
    }

    const unhappyAncestor = chain.find((title) =>
      UNHAPPY_DESCRIBE_PATTERNS.some((re) => re.test(title))
    )
    if (unhappyAncestor) {
      violations.push(
        `${where}\n    → sits inside an unhappy describe “${unhappyAncestor}”; @happy-path must not tag error/boundary scenarios.`
      )
    }
  }

  if (violations.length > 0) {
    console.error(
      `\n✗ @happy-path tag check failed — ${violations.length} violation(s):\n`
    )
    console.error(violations.join('\n\n'))
    console.error(
      '\nFix: remove @happy-path from the test above, or correct its tags/skips.' +
        '\nSee AGENTS.md → "@happy-path — what to tag".\n'
    )
    process.exit(1)
  }

  console.log(
    `✓ @happy-path tag check passed — ${happyCount} happy-path tests, all run on CDP and outside unhappy describes.`
  )
}

try {
  main()
} catch (err) {
  console.error('@happy-path tag check errored: ' + err.message)
  process.exit(1)
}
