# Validate Adhoc Implementation — Reference

Reference for `/validate-adhoc-implementation`.

Validate that a **development ticket's implementation matches its intent**, and produce evidence. This is **not** journey-test work: do not create, modify, or run the journey-test suite. The output is a pass/fail verdict printed in chat plus evidence saved under `docs/`.

There are two layers to every validation, and you do both:

1. **Code-level review** — read the actual source/diff in the relevant repo and reason about whether each requirement and AC is met.
2. **Functional evidence** — run the real thing (an app route, a self-contained HTML artifact, or a backend entry point against fixtures) and capture screenshots / output that demonstrate the behaviour.

---

## Inputs

- **Key-details** (required) — ticket key/title, requirements, ACs. Read them fresh; do not rely on a cached version from earlier in the session.
- **PR screenshot** (optional) — identifies the repo(s), PR number(s), branch names and merge status. Some tickets have **no PR** — the implementation may still be present in the repo (landed via another PR). Always check.
- **Supporting documents** (optional) — most commonly a self-contained HTML widget that is supposed to have been published. Treat it as the source of truth for a content comparison.

---

## Repositories

Sibling repos under `VSCodeProjects/` (paths relative to this repo):

- `../bng-metric-frontend` — Hapi.js + Nunjucks frontend
- `../bng-metric-backend` — backend + validation logic (e.g. `validateGpkg`)
- `../bng-metric-harness` — gen-gpkg tooling, `example-files/*.gpkg` fixtures, `packages/bng-lib`
- `../bng-metric-digital-prototype` — GOV.UK Prototype Kit app (Trading Rules, Simulator, Enhancement Rules, gen-gpkg)

The PR screenshot names the repo(s) and PR number(s) — start there.

---

## Step 1 — Locate the implementation

1. From the PR screenshot, note each repo, PR number, branch, and merge status.
2. In the relevant repo: `git log --oneline`, find the PR's merge/commits, `git show --stat <sha>` and read the changed files **at HEAD**.
3. If HEAD has drifted past the ticket's change (a later PR re-touched the same files), inspect the file **at the ticket's merge commit** as well, and report the divergence.
4. **If no PR was provided / none exists:** search the repo for the feature anyway (`git log --oneline -- <path>`, grep for routes/markers). State plainly whether the implementation is present and which commit introduced it. "No dedicated PR" ≠ "not implemented".

---

## Step 2 — Validate requirements & ACs

- Map **each** requirement and AC to concrete code. Confirm the implementation matches intent, and quote the file/line (`path:line`).
- When a **supporting HTML/doc** is attached, the publish is correct only if the repo's view matches it. Compare: `<title>`, version banner, distinctive headings/markers, and dataset counts (e.g. number of `"habitat":` entries). Faithful copy ⇒ pass.
- Call out ACs that **cannot be verified in-repo** (e.g. "URL posted to the ticket's Jira comments", or the live CDP host URL) — mark them clearly as outside what code review can confirm.
- Note non-blocking nuances honestly: dead locals, gating inconsistencies, confusing version labels, dev-only nav links, etc. (See "Things to flag" in the template.)

---

## Step 3 — Capture functional evidence

Pick the **most faithful feasible** method for the artifact:

- **Live app route (preferred when HEAD == the ticket's state):** run the app and screenshot the real route. For the prototype, use the run recipe below. Confirm coexistence of sibling routes where relevant.
- **Self-contained HTML widget:** if the running app serves a _later_ version than the ticket's, render the exact committed bytes (or the attached file) standalone via `file://` with Playwright. Disclose that it's a standalone render of the committed artifact.
- **Backend logic / validators:** invoke the real entry point (e.g. `validateGpkg(buffer)` from `../bng-metric-backend/src/validation/baseline/geopackage.js`) against the matching `../bng-metric-harness/example-files/*.gpkg` fixtures, asserting the developer-stated expected outcome per case. Save a reproducible script **and** its captured output.

Screenshot scoping (per project convention): use `locator.screenshot()` (panel / table / header) for content evidence; use `page.screenshot({ fullPage: true })` only for whole-page context.

Playwright is available at `node_modules/playwright` in **this** repo; drive standalone files and live routes from a small script in `/tmp`.

---

## Step 4 — Save evidence under `docs/`

- Save to `docs/<ticket-key-or-slug>-evidence/` (e.g. `docs/bmd-566-evidence/`).
- `docs/` is **gitignored** — evidence is local/ephemeral, not committed. The chat verdict is the deliverable; the saved files back it up for whoever runs the validation. The markdown links resolve in the local IDE.
- **Clear that ticket's own evidence folder** at the start of a re-run (do not touch other tickets' folders).
- Include: screenshots, any reproducible script(s) + captured output (`*.txt`), and a short `notes.txt` / `capture-notes.txt` of key facts (status codes, versions, row counts, file magic, etc.).
- Reference every artifact in the chat report as a clickable markdown link, e.g. `[live-01-landing.png](docs/<slug>-evidence/live-01-landing.png)`.

---

## Step 5 — Print the verdict in chat

Use the template below. Keep it tight: a verdict header, a per-requirement/AC table or short sections with status + evidence links, a functional-evidence table where relevant, the flags, the method disclosure, and the evidence path.

```
## <TICKET / TITLE> — Verdict: ✅ / ⚠️ / ❌ <one-line summary>

<one or two sentences of context: which PR/commit, or "already in the repo via <sha> — no dedicated PR">

### <Requirement / AC 1> ✅/⚠️/❌
- evidence + `path:line` references

### <Requirement / AC 2> …

### Functional evidence
| Check | Result |
|---|---|
| <route / fixture / case> | <status / pass-fail / value> |

### Things to flag
- <non-blocking nuances, deviations, anything the author should confirm>
- <ACs that can't be verified in-repo>

Evidence saved to docs/<slug>-evidence/.
Method: <code-level + live route | code-level + standalone render | code-level + direct validator run>.
```

Verdict glyphs: ✅ implemented as intended · ⚠️ implemented with caveats / unverifiable AC · ❌ not implemented or deviates from intent.

---

## Step 6 — Cleanup

- Stop any server you started (`pkill -f "govuk-prototype-kit serve"`) and confirm it is down.
- Leave the repos as you found them (the clean install in Step-3's prototype recipe is fine to leave).

---

## Appendix — Prototype run recipe

The prototype needs Node ≥24 and fetches the `bng-library` GitHub dependency (so `git` is required). Local default Node may be too old — use nvm's Node 24.

```sh
cd ../bng-metric-digital-prototype
# Use nvm's Node 24 without hardcoding a patch version:
export PATH="$(dirname "$(ls -d $HOME/.nvm/versions/node/v24*/bin/node | sort -V | tail -1)"):$PATH"
node -v   # expect v24.x (engines wants >=24.14.1; nearby 24.x runs fine)
# Only if node_modules is missing or built for the wrong Node — this forces a multi-minute reinstall:
#   rm -rf node_modules
npm_config_engine_strict=false npm ci                        # fetches bng-library from GitHub, builds better-sqlite3
PORT=3010 SHOW_TOOLS=true NODE_ENV=development \
  nohup node_modules/.bin/govuk-prototype-kit serve > /tmp/proto-server.log 2>&1 &
```

Gating to be aware of:

- The `gen-gpkg` route is enabled only when `NODE_ENV !== 'production'`.
- Header nav links (Trading Rules, Simulator, Enhancement Rules, Generate test GeoPackage) render only when `SHOW_TOOLS === 'true'` — so "no menu link in production, direct-link access" is satisfied by this gating.
- `/TradingRules` 302-redirects to a cache-busting `?v=<n>`; request the redirected URL to get a 200.

Wait for readiness, then probe routes:

```sh
for i in $(seq 1 30); do [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3010/)" = 200 ] && break; sleep 1; done
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3010/<Route>
```

Backend validator (no server needed): run a small `.mjs` that imports `validateGpkg` from the backend and reads fixtures from `../bng-metric-harness/example-files/`; print `{ valid, errors }` per case. Run it with the backend's installed Node so `better-sqlite3` loads.
