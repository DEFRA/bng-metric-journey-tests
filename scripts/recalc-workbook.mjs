// Recalculate Defra metric workbooks with LibreOffice and print the metric's
// own answers: headline units, trading-rule verdicts and the warnings it
// raises. For ad-hoc spreadsheet validations; nothing in the test suite
// imports it.
//
// It runs inside the bng-metric-harness `bng-scenarios` image (see
// compose.recalc.yml), never on the host: the image carries the LibreOffice
// release, bng-library and published metric template the harness's expected
// results were produced with, so answers here are comparable with its
// manifest.json. Use `npm run recalc:workbook -- --help`.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import {
  PUBLISHED_METRIC_TEMPLATE,
  saveRecalculatedWorkbooks,
  workbookFromGeoPackage
} from 'bng-library/workbook-writer'

const HELP = `Usage: npm run recalc:workbook -- [options] <file> [<file> ...]

Each <file> is either:
  *.xlsx  a metric workbook, recalculated as it stands (a copy,
          <name>.recalculated.xlsx; the original is never changed)
  *.gpkg  a post-intervention GeoPackage, written into the published Defra
          metric template the way the harness scenario generator does, then
          recalculated

Paths are relative to the journey-tests root. Files under
../bng-metric-harness/example-files/ can be named too (mounted read-only).

Options:
  --out DIR     where the recalculated workbooks and results.json go
                (default .cache/recalc; e.g. docs/<ticket>-evidence)
  --published   for a .gpkg: keep the metric's known bugs (Defra's formulas
                exactly as published) instead of correcting them
  --compare     for a .gpkg: write it both corrected and as published, and
                show the two side by side
  --help        show this message
`

// The image downloads the published template into the harness cache at build
// time (Dockerfile.scenarios); /app is the harness root inside the image.
const TEMPLATE_PATH = path.join(
  '/app/.cache/metric-template',
  PUBLISHED_METRIC_TEMPLATE.fileName
)

const HABITAT_KINDS = ['area', 'hedgerow', 'watercourse']

const INPUT_EXTENSIONS = ['.xlsx', '.gpkg']

function parseCli() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string', default: '.cache/recalc' },
      published: { type: 'boolean', default: false },
      compare: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false }
    }
  })
  if (values.help || positionals.length === 0) {
    console.log(HELP)
    process.exit(values.help ? 0 : 1)
  }
  if (values.published && values.compare) {
    throw new Error('--published and --compare cannot be used together')
  }
  const unsupported = positionals.filter(
    (file) => !INPUT_EXTENSIONS.includes(path.extname(file).toLowerCase())
  )
  if (unsupported.length > 0) {
    throw new Error(`${unsupported.join(', ')}: expected a .xlsx or .gpkg file`)
  }
  const missing = positionals.filter((file) => !existsSync(file))
  if (missing.length > 0) {
    throw new Error(
      `not found: ${missing.join(', ')} (paths are relative to the journey-tests root; only it and ../bng-metric-harness/example-files are mounted)`
    )
  }
  // Each input is staged under its own file name, so two with the same name
  // would overwrite each other and report one file's answers for both.
  const names = positionals.map((file) => path.basename(file))
  const clashing = positionals.filter(
    (file, i) => names.indexOf(path.basename(file)) !== i
  )
  if (clashing.length > 0) {
    throw new Error(
      `more than one input named ${[...new Set(clashing.map((file) => path.basename(file)))].join(', ')}; recalculate them in separate runs with different --out folders`
    )
  }
  // Only the repo root is mounted writable: anywhere else is inside the
  // container and is lost when it exits.
  const outRelative = path.relative(process.cwd(), path.resolve(values.out))
  if (
    outRelative === '..' ||
    outRelative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(outRelative)
  ) {
    throw new Error(
      `--out ${values.out} is outside the journey-tests root, so nothing written there would survive the container; use a folder inside it, e.g. docs/<ticket>-evidence`
    )
  }
  // A target that is also an input (an .xlsx already in --out) would be
  // recalculated, and so changed, in place.
  const outDir = path.resolve(values.out)
  const targets = new Set(
    positionals.flatMap((file) =>
      targetsFor(file, values, outDir).map(({ target }) => target)
    )
  )
  const overwritten = positionals.filter((file) =>
    targets.has(path.resolve(file))
  )
  if (overwritten.length > 0) {
    throw new Error(
      `${overwritten.join(', ')} would be overwritten by a recalculated copy in --out ${values.out}; choose another --out`
    )
  }
  if (
    (values.compare || values.published) &&
    !positionals.some((file) => path.extname(file).toLowerCase() === '.gpkg')
  ) {
    console.warn(
      'note: --compare and --published apply to .gpkg inputs only; .xlsx workbooks are recalculated as given'
    )
  }
  return { ...values, outDir, files: positionals }
}

function variantsFor(args) {
  if (args.compare) {
    return [
      { label: 'corrected', corrections: undefined },
      { label: 'published', corrections: [] }
    ]
  }
  return args.published
    ? [{ label: 'published', corrections: [] }]
    : [{ label: 'corrected', corrections: undefined }]
}

// The workbooks one input becomes in the output folder: an .xlsx is copied,
// a .gpkg is written once per variant.
function targetsFor(file, args, outDir) {
  const ext = path.extname(file).toLowerCase()
  const base = path.basename(file, ext)
  const variants =
    ext === '.xlsx' ? [{ label: 'recalculated' }] : variantsFor(args)
  return variants.map((variant) => ({
    ...variant,
    target: path.join(outDir, `${base}.${variant.label}.xlsx`)
  }))
}

// Stage every input as a workbook in the output folder, so the recalculation
// (which saves each file over itself) never touches an original.
function stageInputs(args) {
  const staged = []
  let templateBuffer
  for (const file of args.files) {
    for (const { label, corrections, target } of targetsFor(
      file,
      args,
      args.outDir
    )) {
      if (path.extname(file).toLowerCase() === '.xlsx') {
        copyFileSync(file, target)
        staged.push({ source: file, label, target })
      } else {
        templateBuffer ??= readFileSync(TEMPLATE_PATH)
        const { buffer, issues } = workbookFromGeoPackage({
          postInterventionPath: file,
          templateBuffer,
          corrections
        })
        writeFileSync(target, buffer)
        staged.push({ source: file, label, target, rejectedInputs: issues })
      }
    }
  }
  return staged
}

function units(value) {
  return value === null || value === undefined ? '—' : value.toFixed(4)
}

function percent(value) {
  return value === null || value === undefined
    ? '—'
    : `${(value * 100).toFixed(2)}%`
}

// One line per feature and message: the metric repeats a warning such as
// `Check Data` in every cell of the row it applies to.
function groupRowWarnings(rowWarnings) {
  const grouped = new Map()
  for (const { sheet, reference, message, cell } of rowWarnings) {
    const where = `${sheet} ${reference}: ${message}`
    grouped.set(where, [...(grouped.get(where) ?? []), cell])
  }
  return grouped
}

function report({ source, label, target, rejectedInputs = [] }, results) {
  const { headline, trading, corrected, rowWarnings, sheetWarnings } = results
  console.log(`\n▸ ${source} (${label})`)
  console.log(`  recalculated → ${path.relative(process.cwd(), target)}`)
  console.log('  headline        baseline     post-int.    net change    net %')
  for (const kind of HABITAT_KINDS) {
    console.log(
      `  ${kind.padEnd(14)}  ${units(headline.baselineUnits[kind]).padStart(11)}  ${units(headline.postInterventionUnits[kind]).padStart(11)}  ${units(headline.netUnitChange[kind]).padStart(12)}  ${percent(headline.netPercentChange[kind]).padStart(8)}`
    )
  }
  console.log('  trading rules')
  for (const kind of HABITAT_KINDS) {
    const bands = (trading[kind] ?? [])
      .map((band) => `${band.distinctiveness} ${band.satisfied}`)
      .join(' · ')
    console.log(`    ${kind.padEnd(12)} ${bands}`)
  }
  console.log(
    `  area surplus after Low deficit (K125): ${units(corrected.areaCumulativeSurplus)}`
  )
  for (const [where, cells] of groupRowWarnings(rowWarnings)) {
    console.log(`  row warning   ${where} (${cells.join(', ')})`)
  }
  for (const warning of sheetWarnings) {
    console.log(
      `  sheet warning ${warning.sheet}!${warning.cell}: ${warning.message}`
    )
  }
  for (const issue of rejectedInputs) {
    console.log(`  rejected input ${JSON.stringify(issue)}`)
  }
}

async function main() {
  const args = parseCli()
  const { outDir } = args
  mkdirSync(outDir, { recursive: true })
  const staged = stageInputs(args)

  // LibreOffice's scratch profile forces recalculation on load: without it
  // LibreOffice hands back the values the file was saved with, which looks
  // exactly like success.
  const workDir = mkdtempSync(path.join(outDir, '.recalc-'))
  let results
  try {
    results = await saveRecalculatedWorkbooks(
      staged.map(({ target }) => target),
      { workDir }
    )
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }

  staged.forEach((input, i) => report(input, results[i]))
  writeFileSync(
    path.join(outDir, 'results.json'),
    JSON.stringify(
      staged.map((input, i) => ({ ...input, results: results[i] })),
      null,
      2
    )
  )
  console.log(
    `\nresults → ${path.relative(process.cwd(), path.join(outDir, 'results.json'))}`
  )
}

try {
  await main()
} catch (error) {
  console.error(`recalc-workbook: ${error.message}`)
  process.exit(1)
}
