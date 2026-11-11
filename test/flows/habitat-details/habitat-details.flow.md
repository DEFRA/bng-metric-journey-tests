# Habitat Details User Flow

## Overview

A BNG Completer views and edits the habitat reference and dropdown fields for a single
baseline feature (area habitat, vertical area habitat, hedgerow, or watercourse). On save
the backend recomputes derived values (distinctiveness, condition score, habitat units, status) and the user is
returned to the feature type's unit-type baseline page — `area-baseline`,
`hedgerows-baseline` or `watercourses-baseline-summary` (BMD-1043, frontend PR#352; it was
the baseline habitat list, anchored to the edited row or tab, now removed). Watercourse
features are fully editable: saves persist the encroachment selections and
recompute units from the engine's encroachment multipliers (BMD-597).

## Steps

### Step 1 — View habitat details `[IMPLEMENTED]`

- **Route:** `GET /baseline-habitat-details`
- **Template:** `src/server/habitat-details/habitat-details.njk` (shared template rendered as `habitat-details/habitat-details`; the GET/POST handlers come from the `createHabitatDetailsControllers` factory in `src/server/common/helpers/habitat-details-controller.js`)
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoints:**
  - `GET /projects/{projectId}/features/{featureId}` — fetches the feature with its type discriminator (`habitat`, `hedgerow`, or `watercourse`); 404 if not found
  - `GET /projects/{projectId}` — fetches the project name for the page caption/title; failures are swallowed and fall back to `"Project"` (non-blocking)
  - For area habitats:
    - `GET /reference/habitat-types-by-broad` — all habitat types grouped by broad (cached in-process)
    - `GET /reference/trading-rules` — trading rules by distinctiveness band (cached in-process)
    - `GET /reference/conditions?habitatType={broadType} - {type}` — condition options (only when both broadType and type are set)
  - For hedgerows:
    - `GET /reference/hedgerow-types` — hedgerow habitat types (cached in-process)
    - `GET /reference/trading-rules` — trading rules by distinctiveness band (cached in-process)
    - `GET /reference/conditions?habitatType={type}&featureType=hedgerow` — hedgerow condition options (only when type is set)
  - For watercourses:
    - `GET /reference/watercourse-types` — watercourse habitat types, filtered to the in-scope V.Low/Low/Medium distinctiveness bands (High/V.High excluded, e.g. "Priority habitat" and "Other rivers and streams") (cached in-process) (BMD-597)
    - `GET /reference/trading-rules?featureType=watercourse` — watercourse trading rules (cached in-process)
    - `GET /reference/watercourse-encroachments` — watercourse + riparian encroachment option lists (cached in-process)
    - `GET /reference/conditions?habitatType={type}&featureType=watercourse` — watercourse condition options (only when type is set)
- **Description:** Feature type is resolved by the backend; the area (also used for individual trees), vertical area, hedgerow and watercourse strategies render the shared stacked-field form. The editable **Habitat reference** input starts with the saved ref and stops at 99 characters (`maxlength`, frontend PR#474; was 100). A vertical area habitat is sized in square metres and its habitat type list is narrowed to vertical habitats. Size is read-only: **Size (hectares)** for areas and **Length (km)** for linear features. Other read-only fields are Distinctiveness, **Strategic significance** (fixed "Low (1)"), Required action to meet trading rules, and the final Units in this habitat summary row. Broad habitat (areas only), Habitat type and Condition are editable selects. Watercourses also show editable Watercourse encroachment followed by Riparian encroachment; these are form controls, not summary-list terms. Their options remain culvert-aware (BMD-597). The JSON reference script supports client-side preview updates. Back and Cancel targets are described below. `[IMPLEMENTED]`

- **The heading shows the ref as saved (BMD-1058) `[IMPLEMENTED]`:** the `<h1>` is `"{Habitat|Hedgerow|Watercourse} {ref}"`, built in `habitat-details-controller.js` from the stored ref with no trimming of its own. The grids do trim refs when they display them, which hides what was saved. So the details heading is where the journey suite checks the backend's clean (`cleanHabitatRef`): the raw `textContent` of the `<h1>` must be exactly `"Habitat H001"` for the file's `"␣␣H001␣␣"` (trimmed), and `"Habitat "` plus all 99 characters for a ref at the limit (saved whole; a longer ref is refused at upload since BMD-1175). `toHaveText` would normalise whitespace and hide a failure, so the tests compare the raw text. See `baseline-habitat-details.spec.js` › _habitat reference cleaning_.
- **Back and Cancel link targets (BMD-878, frontend PR#199; BMD-935, frontend PR#226) `[IMPLEMENTED]`:** both links are chosen from the request's `Referer` header by `postInterventionBackHref` in `src/server/common/helpers/habitat-details-controller.js`. BMD-878 introduced the rule for Back; BMD-935 applied the identical rule to Cancel, which until then always went to the baseline habitat list.
  - If the referrer is **same-host**, has pathname **`/post-intervention-habitat-details`**, carries the **same `projectId`**, and a **valid UUID `featureId`** — both links point at `/post-intervention-habitat-details?featureId={refererFeatureId}&projectId={projectId}`, returning the user to the post-intervention habitat details page they clicked "View baseline details" on. They resolve to one shared value (`piBackHref`), so in this case Back and Cancel are byte-identical hrefs.
  - Otherwise (no referrer, malformed referrer, cross-host, a different path such as the feature's own baseline grid, or a mismatched `projectId`) both fall back to the feature type's baseline page, with no anchor: `/projects/{projectId}/area-baseline`, `/projects/{projectId}/hedgerows-baseline` or `/projects/{projectId}/watercourses-baseline-summary` (set by each strategy's `backHref` / `cancelHref`). **Changed by BMD-1043 (frontend PR#352):** the fallback was the baseline habitat list, where Cancel carried the area row anchor (`#habitat-{featureId}`) and Back did not, and linear features used the tab anchors `#hedgerows` / `#watercourses`.
  - **After a refused save (BMD-1061):** the POST's referrer is the baseline page itself, so the origin travels in the hidden `returnUrl` field. A refused save keeps the post-intervention Back and Cancel targets. Only a same-site path to that project's post-intervention details page is accepted.
  - **Testing note:** because the target is derived from `Referer`, a test that reaches this page with `page.goto()` sends no referrer and will always exercise the fallback. Exercising the post-intervention branch requires a real **click** on the "View baseline details" link from `/post-intervention-habitat-details`.
  - **Testing note (BMD-935):** in the matched-referrer case the two links render the same href twice on one page, so an assertion that merely looks for that string in the markup is satisfied by whichever link still carries it. Assert Back and Cancel separately — the frontend's own unit test for the Cancel case does not, and cannot fail if `cancelHref` regresses.
- **Where each strategy is tested `[IMPORTANT]`:** the frontend controller unit tests
  (`../bng-metric-frontend/src/server/baseline-habitat-details/controller.test.js`) have a
  `GET` describe for **area** and a `GET (hedgerow strategy)` describe — but **none for
  watercourse**; every watercourse reference in that file is POST/redirect/encroachment
  forwarding. The journey suite's consolidated `AC2–AC13` watercourse panel test is
  therefore the **only** coverage of the watercourse page render anywhere, and it is
  deliberately exhaustive. Keep it that way, and prefer adding assertions to it over
  splitting it back into per-field tests. See `workshop/integration-overlap-ledger.md`
  (chunk 4) for the audit.
- **Client-side dropdown behaviour (area habitats; display-only, no DB writes until Save — `src/client/javascripts/baseline-habitat-details.js`):**
  - **Change condition** — no handler; the new value is simply the visible selection. Distinctiveness, trading rules and the Units row are untouched.
  - **Select a valid habitat type** — `#distinctivenessDisplay` and `#tradingRuleDisplay` update for the new type; the Condition select resets to "Choose condition" and is repopulated for the new type via the conditions proxy (Step 3). Units row is untouched.
  - **Deselect habitat type** ("Choose habitat type") — `#distinctivenessDisplay` and `#tradingRuleDisplay` are cleared; Condition resets to "Choose condition". Units row is untouched.
  - **Select a new broad habitat** — derived displays cleared; the Habitat type select is repopulated for the new broad and reverts to "Choose habitat type"; Condition resets to "Choose condition". Units row is untouched.
  - **Deselect broad habitat** ("Choose broad habitat") — derived displays cleared; Habitat type reverts to "Choose habitat type" (single placeholder option); Condition resets to "Choose condition". Units row is untouched.
- **Client-side dropdown behaviour (hedgerows; display-only, no DB writes until Save):** hedgerows have no broad-habitat dimension, so only Habitat type + Condition are editable.
  - **Change condition** — no handler; the new value is simply the visible selection. Derived displays and the Units row are untouched.
  - **Select a valid habitat type** — `#distinctivenessDisplay` and `#tradingRuleDisplay` update for the new type; the Condition select resets to "Choose condition" (hedgerow types share the same Good/Moderate/Poor condition set, so the options are unchanged but the selection still resets). Units row is untouched.
  - **Deselect habitat type** ("Choose habitat type") — `#distinctivenessDisplay` and `#tradingRuleDisplay` are cleared; Condition resets to "Choose condition". Units row is untouched.
- **Client-side dropdown behaviour (watercourses; display-only, no DB writes until Save — BMD-597):** watercourses have no broad-habitat dimension; Habitat type, Condition, Watercourse encroachment and Riparian encroachment are editable.
  - **Change condition** — no handler; the new value is simply the visible selection. Derived displays and the Units row are untouched.
  - **Select a valid habitat type** — `#distinctivenessDisplay` and `#tradingRuleDisplay` update for the new type; the Condition select resets to "Choose condition" and repopulates via the conditions proxy; both encroachment selects reset to their "Choose …" placeholders and repopulate culvert-aware (Culvert → only "N/A - Culvert"; any other type → the graded options without it).
  - **Deselect habitat type** ("Choose habitat type") — derived displays cleared; Condition resets to "Choose condition"; both encroachment selects reset to their placeholders only. Units row is untouched.
- **Validation (query params):**
  - `featureId` required, must be a valid UUID → 400 if missing or invalid
  - `projectId` required, must be a valid UUID → 400 if missing or invalid
  - BNG Completer role required → redirects to `/auth/forbidden` if missing
  - Unauthenticated (no session) → redirects to `/auth/forbidden`
  - Feature not found → 404
  - Watercourse features are viewable (200) via the registered watercourse strategy (BMD-502); a genuinely unknown feature type → 500 (Boom.badImplementation in strategy lookup)
- **On success:** Renders the habitat details form
- **On error:** 400 for invalid/missing query params; 404 if feature does not exist

---

### Step 2 — Save habitat details `[IMPLEMENTED]`

- **Route:** `POST /baseline-habitat-details`
- **Template:** None on success (redirect). A refused reference re-renders `src/server/habitat-details/habitat-details.njk`.
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** `PUT /projects/{projectId}/features/{featureId}` — persists ref (optional; left out, the stored ref is kept) and broadType / habitatType / condition (plus watercourseEncroachment / riparianEncroachment from the watercourse form); recomputes distinctiveness, condition score, habitat units, and Complete/Incomplete status; uses row-level locking with a 5 s timeout; returns `{ type, feature }`. Watercourse saves persist the encroachment selections and recompute units from the engine's encroachment multipliers (BMD-597).
- **Description:** Submits the habitat reference and dropdown selections. Only a reference the user changed is checked and sent, trimmed, so a habitat imported before BMD-1058 can still have its dropdowns saved. Empty dropdowns are sent as null by the frontend. A rename is carried onto the post-intervention rows joined to the feature and onto its stored geometry rows. A save that leaves any required input empty (a deselected dropdown, or a watercourse encroachment) cannot be priced, so the feature is saved with `units: null` and status `Incomplete` (BMD-1070, backend PR #498 — it used to save `0`). Its Units cell on the baseline grid is then blank. The redirect anchor is determined by the feature type returned in the backend response.
- **Validation (payload):**
  - `projectId` required UUID
  - `featureId` required UUID
  - `habitatRef` optional string, allow empty string
  - `returnUrl` optional string, allow empty string
  - `broadHabitat` optional string, allow empty string
  - `habitatType` optional string, allow empty string
  - `condition` optional string, allow empty string
  - `watercourseEncroachment` optional string, allow empty string (watercourse form only)
  - `riparianEncroachment` optional string, allow empty string (watercourse form only)
  - `crumb` optional (CSRF token injected by `appForm` macro)
- **On success** (`habitatDetailsDestination(projectId, payload.type, 'baseline')`, `src/server/common/helpers/habitat-details-destination.js`; BMD-1043 — these were anchors on the removed baseline habitat list):
  - Area habitat or tree: Redirects to `/projects/{projectId}/area-baseline`
  - Hedgerow: Redirects to `/projects/{projectId}/hedgerows-baseline`
  - Watercourse: Redirects to `/projects/{projectId}/watercourses-baseline-summary`
- **On error:**
  - **Invalid reference** (blank, whitespace only, U+FFFD or a lone surrogate) → 400. The page re-renders with the summary "You have entered an invalid habitat reference." and inline "Enter a valid habitat reference.", title prefixed `Error:`. The heading keeps the saved ref, the input and dropdowns keep what was submitted, nothing is saved.
  - **More than 99 characters** once trimmed → 400 with "Enter a habitat reference of 99 characters or fewer.", keeping what was typed; nothing is saved (frontend PR#474, BMD-1175). Until then the backend truncated to 100.
  - **Rename onto a ref already in use** → backend 422 `HABITAT_REF_IN_USE`, shown as 400 with "You have entered a habitat reference that is already in use." and "Enter a habitat reference that is not already in use." Area habitats are checked within their layer; hedgerows and watercourses are checked together. Keeping a ref never clashes, and imports may still repeat one. Open: the PO allowed duplicates on BMD-1180 (2026-11-03), and BMD-1061's AC5 doesn't exclude them.
  - **Other backend refusals:** 400 with a ref sent shows the invalid-reference page; 400 without one is an error page; 404 → 404; 409 (lock timeout) → 409; anything else, including 422 out-of-scope distinctiveness → 502. An expired session passes through to sign-in.

---

### Step 3 — Fetch condition options (client-side proxy) `[IMPLEMENTED]`

- **Route:** `GET /api/reference/conditions`
- **Template:** None (JSON response)
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** `GET /reference/conditions?habitatType={habitatType}[&featureType=hedgerow|watercourse]` — returns condition options; `featureType` selects the hedgerow or watercourse conditions table instead of area habitats
- **Description:** Thin frontend proxy consumed by client-side JS when the user changes the Habitat type dropdown. Refreshes the Condition select options without a full page reload.
- **Validation (query params):**
  - `habitatType` required, min length 1 → 400 if missing or empty
  - `featureType` optional; must be `'habitat'`, `'hedgerow'`, or `'watercourse'` if provided → 400 otherwise
  - BNG Completer role required → redirects to `/auth/forbidden` if missing
- **On success:** Returns JSON array of condition objects from the backend
- **On error:** Backend returns 4xx or 5xx → 502 Bad Gateway
