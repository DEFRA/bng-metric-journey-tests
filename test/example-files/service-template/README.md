# BNG Service template fixtures

The files the BNG Service template run (`SERVICE_TEMPLATE_ENABLED=true`) uploads. Each is a copy of a file in the harness's curated corpus, `bng-metric-harness/example-files/service-template/`, which builds every file from a recipe (`scripts/service-template/recipes.mjs`) or from bng-library's generator (`npm run generate:gpkg -- --format bng-service`), and whose own README says how each file is made and what the service does with it.

[`manifest.json`](manifest.json) lists every file here with:

- `source`: its path in the harness corpus;
- `sha256`: its hash when it was copied;
- `for`: what it holds, and what the service does with it;

and `harnessCommit`, the harness commit the copies were taken from.

```sh
npm run check:fixtures            # every file listed, present and unchanged; with the harness beside this repo, which have changed there since
npm run check:fixtures -- --sync  # copy every file again from the harness, recording its hashes and commit
```

`BNG_HARNESS_DIR` names another harness checkout. CI's lint job runs the check.

**Never edit a file here, or cut a new one from it.** A scenario the corpus does not have yet gets a recipe in the harness first; then add its entry to `manifest.json` and run `--sync`. The legacy fixtures one folder up, and `fixture-mutations.py`, are the legacy template's and do not apply here.

A file whose name ends `-baseline.gpkg` is a baseline-stage file: its post-intervention tables are present and empty. The rest hold both stages.
