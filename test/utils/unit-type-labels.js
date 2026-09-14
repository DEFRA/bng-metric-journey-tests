export const AREA_HABITATS = 'Area habitats'
export const HEDGEROWS = 'Hedgerows'
export const WATERCOURSES = 'Watercourses'
// The watercourses summary's H1 diverged from its unit-type label in frontend
// PR#271 (2026-09-07): the heading reads "Watercourse habitats" while the nav
// item and the summary section's aria-label stay "Watercourses".
export const WATERCOURSE_HABITATS_HEADING = 'Watercourse habitats'
export const SUMMARY = 'Summary'
export const BASELINE_NAV_CHILD = 'Baseline'

export const TILE_BASELINE = 'On-site baseline'
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
// BMD-860 gave HEDGEROWS alone a post-intervention page, so its tile carries
// its own linked wording where area habitats and watercourses keep the inert
// default above. Their equivalents are separate, unshipped stories — so unlike
// the baseline actions there is no matching AREA_/WATERCOURSES_ constant yet.
export const VIEW_ON_SITE_HEDGEROWS_POST_INTERVENTION =
  'View on-site hedgerows post intervention'
// The current-page item in the left nav's Hedgerows section. Note the hyphen:
// BMD-860's ACs write "Post intervention", the app renders "Post-intervention".
export const POST_INTERVENTION_NAV_CHILD = 'Post-intervention'
