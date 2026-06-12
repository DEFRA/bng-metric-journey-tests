# Habitat Details User Flow

## Overview

A BNG Completer views and edits the dropdown fields for a single baseline feature
(area habitat, hedgerow, or watercourse). On save the backend recomputes derived
values (distinctiveness, condition score, habitat units, status) and the user is
returned to the habitat list anchored to the edited row or tab. Watercourse
features are now viewable; only watercourse editing (save) is unsupported — the
backend rejects watercourse PUTs.

## Steps

### Step 1 — View habitat details `[IMPLEMENTED]`

- **Route:** `GET /baseline-habitat-details`
- **Template:** `src/server/baseline-habitat-details/baseline-habitat-details.njk`
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoints:**
  - `GET /projects/{projectId}/features/{featureId}` — fetches the feature with its type discriminator (`habitat` or `hedgerow`); 404 if not found
  - `GET /projects/{projectId}` — fetches the project name for the page caption/title; failures are swallowed and fall back to `"Project"` (non-blocking)
  - For area habitats:
    - `GET /reference/habitat-types-by-broad` — all habitat types grouped by broad (cached in-process)
    - `GET /reference/trading-rules` — trading rules by distinctiveness band (cached in-process)
    - `GET /reference/conditions?habitatType={broadType} - {type}` — condition options (only when both broadType and type are set)
  - For hedgerows:
    - `GET /reference/hedgerow-types` — hedgerow habitat types (cached in-process)
    - `GET /reference/trading-rules` — trading rules by distinctiveness band (cached in-process)
    - `GET /reference/conditions?habitatType={type}&featureType=hedgerow` — hedgerow condition options (only when type is set)
- **Description:** Feature type is resolved by the backend; the page renders via a strategy (area, hedgerow, or watercourse). Read-only rows: Reference, Size (Area (ha) for habitats / Length (km) for hedgerows / watercourses), Distinctiveness (updated by client JS), Strategic Significance (fixed "Low (1)"), Required action to meet trading rules (updated by client JS), Units in this habitat. Editable rows: Broad habitat (select; area habitats only), Habitat type (select), Condition (select). Watercourse features additionally render read-only Riparian and Watercourse encroachment dropdowns. A JSON script tag (`#bhd-reference-data`) embeds static reference data for client-side JS. Back link and Cancel link navigate to `/projects/{projectId}/baseline-habitat-list` with a tab anchor (`#hedgerows` for hedgerows, `#watercourses` for watercourses, `#habitat-{featureId}` for area habitats).
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
- **Validation (query params):**
  - `featureId` required, must be a valid UUID → 400 if missing or invalid
  - `projectId` required, must be a valid UUID → 400 if missing or invalid
  - BNG Completer role required → redirects to `/auth/forbidden` if missing
  - Unauthenticated → redirects to sign-in
  - Feature not found → 404
  - Watercourse features are viewable (200) via the registered watercourse strategy (BMD-502); a genuinely unknown feature type → 500 (Boom.badImplementation in strategy lookup)
- **On success:** Renders the habitat details form
- **On error:** 400 for invalid/missing query params; 404 if feature does not exist

---

### Step 2 — Save habitat details `[IMPLEMENTED]`

- **Route:** `POST /baseline-habitat-details`
- **Template:** None (redirect only)
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** `PUT /projects/{projectId}/features/{featureId}` — persists broadType / habitatType / condition; recomputes distinctiveness, condition score, habitat units, and Complete/Incomplete status; uses row-level locking with a 5 s timeout; returns `{ type, feature }`
- **Description:** Submits the dropdown selections. Empty strings are coerced to null by the backend. The redirect anchor is determined by the feature type returned in the backend response.
- **Validation (payload):**
  - `projectId` required UUID
  - `featureId` required UUID
  - `broadHabitat` optional string, allow empty string
  - `habitatType` optional string, allow empty string
  - `condition` optional string, allow empty string
  - `crumb` optional (CSRF token injected by `appForm` macro)
- **On success:**
  - Area habitat: Redirects to `/projects/{projectId}/baseline-habitat-list#habitat-{featureId}`
  - Hedgerow: Redirects to `/projects/{projectId}/baseline-habitat-list#hedgerows`
  - Watercourse: Redirects to `/projects/{projectId}/baseline-habitat-list#watercourses`
- **On error:** Backend 4xx/5xx → 502 Bad Gateway; backend 409 (lock timeout on concurrent edit) → 409 Conflict

---

### Step 3 — Fetch condition options (client-side proxy) `[IMPLEMENTED]`

- **Route:** `GET /api/reference/conditions`
- **Template:** None (JSON response)
- **Auth required:** Yes (session + BNG Completer role)
- **Backend endpoint:** `GET /reference/conditions?habitatType={habitatType}[&featureType=hedgerow]` — returns condition options; `featureType=hedgerow` queries the hedgerow conditions table instead of area habitats
- **Description:** Thin frontend proxy consumed by client-side JS when the user changes the Habitat type dropdown. Refreshes the Condition select options without a full page reload.
- **Validation (query params):**
  - `habitatType` required, min length 1 → 400 if missing or empty
  - `featureType` optional; must be `'habitat'`, `'hedgerow'`, or `'watercourse'` if provided → 400 otherwise
  - BNG Completer role required → redirects to `/auth/forbidden` if missing
- **On success:** Returns JSON array of condition objects from the backend
- **On error:** Backend returns 4xx or 5xx → 502 Bad Gateway
