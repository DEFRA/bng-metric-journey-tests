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
