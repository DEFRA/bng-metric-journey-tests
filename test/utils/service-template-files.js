// The BNG Service template fixtures, by what they are for. Each is a copy of a
// harness corpus file, listed with its source in
// test/example-files/service-template/manifest.json; the upload flows take
// these paths relative to test/example-files/.
const DIR = 'service-template'

// A 3-parcel site. The baseline-stage file's post-intervention tables are
// present and empty; the other holds both stages.
export const SMALL_SITE_BASELINE = `${DIR}/small-site-baseline.gpkg`
export const SMALL_SITE = `${DIR}/small-site.gpkg`

// The default site: vertical area habitats, an Enhanced tree, habitats that get
// worse, and Retained, Enhanced and Created features linked to their parents.
export const DEFAULT_SITE_BASELINE = `${DIR}/default-site-baseline.gpkg`
export const DEFAULT_SITE = `${DIR}/default-site.gpkg`

// A Retained area habitat whose parent's shape changed after it was copied.
export const PARENT_SHAPE_CHANGED = `${DIR}/lineage-parent-geom-mismatch.gpkg`

// HG017, a hedgerow that gets worse, with no years created in advance.
export const HEDGEROW_DEGRADE_NO_ADVANCE = `${DIR}/degrade-hedgerow-advance-missing.gpkg`

// R003, a watercourse whose encroachment alone gets worse, 10 years in advance.
export const WATERCOURSE_DEGRADED = `${DIR}/watercourse-degraded.gpkg`

// V004, a vertical area habitat with no Area: refused at the baseline upload.
export const VERTICAL_AREA_MISSING = `${DIR}/vertical-area-missing.gpkg`

// Every unit type's trading rules met, with the area habitats above the 10%
// net gain target.
export const TRADING_ALL_MET = `${DIR}/trading-all-met.gpkg`

// Area habitats and trees only Enhanced or Created, none Retained.
export const NO_RETAINED_AREA = `${DIR}/thirty-plus.gpkg`

// 16 trees in every size band and setting: T001 Small, T003 Medium, T005
// Large and T007 Very large among them.
export const TREE_SIZES = `${DIR}/size-and-setting.gpkg`

// The default site with the Retained H002's Baseline Strategic Significance
// High, which the service prices at Low.
export const BASELINE_SIGNIFICANCE_HIGH = `${DIR}/baseline-significance-high.gpkg`

// A Medium deficit not covered from below: a Medium grassland lost (-153.69
// units) and two Low grasslands enhanced (+166.54). Hedgerows, no watercourses.
export const AREA_TRADING_DEFICIT = `${DIR}/trading-higher-deficit-not-covered-from-below.gpkg`

// Vertical area habitats V001 Retained, V002 Enhanced, V003 Created (IGGI) and
// V004 Lost: its IGGI trades in the merged intertidal group.
export const EVERY_VERTICAL_RETENTION = `${DIR}/every-retention.gpkg`

// Its baseline-stage file: hedgerows and no watercourses.
export const AREA_TRADING_DEFICIT_BASELINE = `${DIR}/trading-higher-deficit-not-covered-from-below-baseline.gpkg`

// Watercourses and no hedgerows: the degraded watercourse's baseline-stage file.
export const WATERCOURSE_DEGRADED_BASELINE = `${DIR}/watercourse-degraded-baseline.gpkg`

// A Very low hedgerow lost to development: Medium and Low Met, Very low not.
export const VERY_LOW_HEDGEROW_LOST = `${DIR}/trading-lost-to-development.gpkg`

// A Low hedgerow loss covered by the Medium surplus; no watercourses.
export const LOW_LOSS_COVERED = `${DIR}/trading-lower-deficit-covered-from-above.gpkg`

// R003, a 100 m ditch re-meandered into a 130 m Enhanced watercourse beside
// the Retained R001 and R002.
export const WATERCOURSE_REMEANDERED = `${DIR}/watercourse-remeandered.gpkg`

// Every field filled: area habitats Met, hedgerows and watercourses Not met.
export const DATA_COMPLETE = `${DIR}/data-complete.gpkg`

// Every unit type above the 10% target, with the area trading rules Not met
// and the hedgerow and watercourse ones Met.
export const NET_GAIN_MET = `${DIR}/net-gain-met.gpkg`

// Watercourses gaining 2.7%: above zero and below the 10% target.
export const WATERCOURSE_ENHANCED_SHORTER = `${DIR}/watercourse-enhanced-shorter.gpkg`

// HG001, an Enhanced hedgerow whose enhancement the Metric does not allow:
// saved Incomplete, its proposed values cleared.
export const HEDGEROW_ENHANCEMENT_NOT_POSSIBLE = `${DIR}/invalid-hedgerow-low-not-possible.gpkg`
