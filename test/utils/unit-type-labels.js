export const AREA_HABITATS = 'Area habitats'
export const HEDGEROWS = 'Hedgerows'
export const WATERCOURSES = 'Watercourses'
// The watercourses summary's H1 diverged from its unit-type label in frontend
// PR#271 (2026-09-07): the heading reads "Watercourse habitats" while the nav
// item and the summary section's aria-label stay "Watercourses".
export const WATERCOURSE_HABITATS_HEADING = 'Watercourse habitats'
export const SUMMARY = 'Summary'
// BMD-984 appended this to the unit-type navigation AFTER the optional unit
// types, and unlike Hedgerows/Watercourses it is not habitat-gated — it renders
// on every page the nav is built for, always last.
export const REPORTS = 'Reports'
export const BASELINE_NAV_CHILD = 'Baseline'

export const TILE_BASELINE = 'On-site baseline'
// The two tiles that can hold a "Met"/"Not met" tag. They are different
// verdicts — see test/utils/unit-type-tiles.js.
export const TILE_NET_PERCENTAGE = 'Total on-site net percentage change'
export const TILE_TRADING_RULES = 'Trading Rules'
export const VIEW_ON_SITE_BASELINE = 'View on-site baseline'
export const VIEW_ON_SITE_AREA_BASELINE = 'View on-site area baseline'
// BMD-859/861 gave the linear types baseline pages too, so their project
// summary tiles carry their own linked wording rather than the inert default.
// Since frontend PR#266 the unit-type summary pages carry the same links.
export const VIEW_ON_SITE_HEDGEROWS_BASELINE = 'View on-site hedgerows baseline'
export const VIEW_ON_SITE_WATERCOURSES_BASELINE =
  'View on-site watercourses baseline'

// The post-intervention tile's action while no post-intervention document
// exists; once one does, the link is replaced by the inert text below.
export const UPLOAD_POST_INTERVENTION = 'Upload on-site post intervention file'
export const VIEW_ON_SITE_POST_INTERVENTION = 'View on-site post intervention'
// Each unit type's post-intervention page gave its tile its own linked wording:
// BMD-860 (hedgerows), BMD-862 (watercourses, frontend PR#285) and BMD-858
// (area habitats, frontend PR#350). The inert default above survives only where
// a page passes no `interventionAction`.
export const VIEW_ON_SITE_AREA_POST_INTERVENTION =
  'View on-site area post intervention'
export const VIEW_ON_SITE_HEDGEROWS_POST_INTERVENTION =
  'View on-site hedgerows post intervention'
export const VIEW_ON_SITE_WATERCOURSES_POST_INTERVENTION =
  'View on-site watercourses post intervention'
// The post-intervention child in the left nav's unit-type sections. No hyphen:
// the app rendered "Post-intervention" until BMD-1024 (frontend #351) aligned
// it with the ACs, which the team confirmed are correct.
export const POST_INTERVENTION_NAV_CHILD = 'Post intervention'
// The trading-summary child under a unit type's nav section, and the area
// Trading Rules tile's link to the same page (BMD-1025). Both render only once
// a post-intervention document exists. Lower-case r per the BMD-1024 ruling
// (frontend PR#351); the tile heading above keeps "Trading Rules".
export const TRADING_RULES_NAV_CHILD = 'Trading rules'
export const VIEW_AREA_TRADING_RULES = 'View area trading rules'
export const VIEW_HEDGEROWS_TRADING_RULES = 'View hedgerows trading rules'
