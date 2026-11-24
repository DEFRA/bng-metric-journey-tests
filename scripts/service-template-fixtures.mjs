// Check, or refresh, the BNG Service template fixtures in
// test/example-files/service-template/ against their manifest.
//
// Every file there is a copy of a file in the harness's curated corpus
// (bng-metric-harness/example-files/service-template/), built by its recipes
// or bng-library's generator. manifest.json names each file's source and its
// SHA-256, and the harness commit the copies were taken from, so a file can be
// traced back to the recipe that builds it.
//
//   npm run check:fixtures            fail if a file is missing, unlisted or
//                                     changed since it was copied; and, with
//                                     the harness checked out beside this
//                                     repo, say which have changed there since
//   npm run check:fixtures -- --sync  copy every source again from the
//                                     harness, and record its new hashes and
//                                     commit
//
// BNG_HARNESS_DIR names another harness checkout.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

const REPO_ROOT = path.resolve(import.meta.dirname, '..')
const FIXTURE_DIR = path.join(
  REPO_ROOT,
  'test',
  'example-files',
  'service-template'
)
const MANIFEST = path.join(FIXTURE_DIR, 'manifest.json')
const CORPUS = path.join('example-files', 'service-template')
const JSON_INDENT = 2

const { values: options } = parseArgs({
  options: { sync: { type: 'boolean', default: false } }
})

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

/**
 * The harness checkout: BNG_HARNESS_DIR, or the one beside this repo. Null
 * when there is none beside it; a BNG_HARNESS_DIR with no corpus is a mistake,
 * so it stops the script rather than being taken for no harness.
 */
function harnessDir() {
  const configured = process.env.BNG_HARNESS_DIR
  const dir = configured ?? path.resolve(REPO_ROOT, '..', 'bng-metric-harness')
  if (existsSync(path.join(dir, CORPUS))) {
    return dir
  }
  if (configured) {
    console.error(`✘ BNG_HARNESS_DIR is ${configured}, which has no ${CORPUS}`)
    process.exit(1)
  }
  return null
}

function git(dir, args) {
  return execFileSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}

/**
 * The commit the copies come from, which must hold the bytes copied: a
 * corpus with changes not yet committed would record a commit without them.
 */
function cleanHarnessCommit(dir) {
  const changes = git(dir, ['status', '--porcelain', '--', CORPUS])
  if (changes) {
    console.error(
      `✘ ${CORPUS} has changes not committed in ${dir}, so no commit holds the files --sync would copy:\n${changes}`
    )
    process.exit(1)
  }
  const commit = git(dir, ['rev-parse', 'HEAD'])
  try {
    git(dir, ['merge-base', '--is-ancestor', commit, 'origin/main'])
  } catch {
    console.warn(
      `! harness ${commit} is not on its origin/main, so the copies come from a branch: sync again once it merges`
    )
  }
  return commit
}

function readManifest() {
  return JSON.parse(readFileSync(MANIFEST, 'utf8'))
}

/** Problems with the committed copies themselves: these fail the check. */
function copyProblems(manifest) {
  const names = manifest.files.map(({ file }) => file)
  const listed = new Set(names)
  const problems = readdirSync(FIXTURE_DIR)
    .filter((name) => name.endsWith('.gpkg') && !listed.has(name))
    .map((name) => `${name} is not in manifest.json`)
  // A file listed twice, as a merge that keeps both sides of a conflict
  // leaves it, would otherwise pass: the folder holds the one copy.
  for (const file of listed) {
    if (names.indexOf(file) !== names.lastIndexOf(file)) {
      problems.push(`${file} is in manifest.json more than once`)
    }
  }
  for (const { file, sha256: expected } of manifest.files) {
    const copy = path.join(FIXTURE_DIR, file)
    if (!existsSync(copy)) {
      problems.push(`${file} is in manifest.json but not in the folder`)
    } else if (sha256(copy) !== expected) {
      problems.push(
        `${file} has changed since it was copied: copy it again with --sync, not by hand`
      )
    }
  }
  return problems
}

/** Copies whose source has changed in the harness: reported, not failed. */
function staleCopies(manifest, harness) {
  return manifest.files.flatMap(({ file, source, sha256: expected }) => {
    const original = path.join(harness, CORPUS, source)
    if (!existsSync(original)) {
      return [`${file}: its source ${source} is no longer in the harness`]
    }
    return sha256(original) === expected
      ? []
      : [`${file}: ${source} has changed in the harness`]
  })
}

/**
 * Copy every source again. Every check runs before the first file is copied,
 * so a sync that stops leaves the folder and manifest.json as they were.
 */
function sync(manifest, harness) {
  const commit = cleanHarnessCommit(harness)
  const missing = manifest.files
    .map(({ source }) => source)
    .filter((source) => !existsSync(path.join(harness, CORPUS, source)))
  if (missing.length > 0) {
    console.error(
      `✘ These sources are not in ${path.join(harness, CORPUS)}, so nothing was copied:\n  ${missing.join('\n  ')}`
    )
    process.exit(1)
  }
  for (const entry of manifest.files) {
    const original = path.join(harness, CORPUS, entry.source)
    copyFileSync(original, path.join(FIXTURE_DIR, entry.file))
    entry.sha256 = sha256(original)
    console.log(`  ${entry.file} ← ${entry.source}`)
  }
  manifest.harnessCommit = commit
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, JSON_INDENT)}\n`)
  console.log(
    `✔ ${manifest.files.length} fixtures copied from harness ${manifest.harnessCommit}`
  )
}

function check(manifest, harness) {
  const problems = copyProblems(manifest)
  for (const problem of problems) {
    console.error(`✘ ${problem}`)
  }
  if (problems.length > 0) {
    process.exit(1)
  }
  console.log(
    `✔ ${manifest.files.length} fixtures match manifest.json (harness ${manifest.harnessCommit})`
  )
  if (!harness) {
    console.log(
      '  The harness is not checked out beside this repo, so the copies were not compared with it.'
    )
    return
  }
  const stale = staleCopies(manifest, harness)
  for (const line of stale) {
    console.warn(`! ${line}`)
  }
  if (stale.length > 0) {
    console.warn(
      `  Run npm run check:fixtures -- --sync to copy them again, then check the specs that use them.`
    )
  }
}

const manifest = readManifest()
const harness = harnessDir()
if (options.sync) {
  if (!harness) {
    console.error(
      '✘ --sync needs the harness: clone bng-metric-harness beside this repo, or set BNG_HARNESS_DIR'
    )
    process.exit(1)
  }
  sync(manifest, harness)
} else {
  check(manifest, harness)
}
