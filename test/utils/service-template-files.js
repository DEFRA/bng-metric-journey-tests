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

// The small site's baseline-stage file under a name that starts with
// punctuation and holds brackets, which the filename rule allows.
export const PUNCTUATED_NAME_BASELINE = `${DIR}/(Copy) small-site-baseline.gpkg`

// Two area habitats share the Habitat Ref DUP-1: accepted.
export const DUPLICATE_HABITAT_REF = `${DIR}/duplicate-habitat-ref.gpkg`

// The file checks each upload refuses, one fault to a file. Each holds both
// stages unless its name ends -baseline.
export const HABITAT_REF_INVALID_CHARACTERS = `${DIR}/habitat-ref-invalid-characters.gpkg`
// An area habitat, a hedgerow and a watercourse with no Habitat Ref, in the
// Baseline tables: one error for the three.
export const HABITAT_REF_MISSING_EVERY_LAYER = `${DIR}/missing-habitat-ref-every-layer.gpkg`
// A habitat with no Habitat Ref beside a comment that is not valid UTF-8.
export const HABITAT_REF_MISSING_AND_COMMENT_INVALID = `${DIR}/missing-habitat-ref-and-comment-invalid.gpkg`
// H005's post-intervention Comment: 1,151 characters, and holding U+FFFD.
export const COMMENT_TOO_LONG = `${DIR}/comment-too-long.gpkg`
export const COMMENT_INVALID_CHARACTERS = `${DIR}/comment-invalid-characters.gpkg`
// Incomplete baseline habitats, in both stages: H002; and H002, HG001 and R007.
export const BASELINE_AREA_INCOMPLETE = `${DIR}/baseline-area-incomplete.gpkg`
export const BASELINE_INCOMPLETE_EVERY_LAYER = `${DIR}/baseline-incomplete-every-layer.gpkg`
// H005, Created as Lowland meadows (Very High) in its post-intervention row
// only.
export const DISTINCTIVENESS_POST_INTERVENTION_ONLY = `${DIR}/distinctiveness-post-intervention-only.gpkg`
// The blank Habitat Ref is on a post-intervention row only, so only the
// baseline + post-intervention upload refuses it.
export const POST_INTERVENTION_HABITAT_REF_BLANK = `${DIR}/degrade-habitat-ref-blank.gpkg`
// H001 (Very High) and H002 (High), in both stages.
export const DISTINCTIVENESS_OUT_OF_SCOPE = `${DIR}/distinctiveness-out-of-scope.gpkg`
// T025, a Retained tree marked irreplaceable.
export const IRREPLACEABLE_TREE = `${DIR}/irreplaceable-tree.gpkg`
export const REDLINE_SELF_INTERSECTING = `${DIR}/self-intersecting-redline-baseline.gpkg`
export const REDLINE_NOT_IN_ENGLAND = `${DIR}/redline-not-in-england-baseline.gpkg`
// An empty Red Line Boundary table.
export const REDLINE_MISSING = `${DIR}/redline-missing-baseline.gpkg`
// A Red Line Boundary table holding two boundaries: the default site's one,
// copied.
export const REDLINE_MULTIPLE = `${DIR}/redline-multiple-baseline.gpkg`
// Habitat parcels that do not tile the red line boundary.
export const AREA_SUM_MISMATCH = `${DIR}/area-sum-mismatch-baseline.gpkg`
// H002, drawn as a bowtie.
export const BOWTIE_PARCEL = `${DIR}/bowtie-parcel-baseline.gpkg`
// H002 and H003 overlap.
export const OVERLAPPING_PARCELS = `${DIR}/overlapping-parcels-baseline.gpkg`
// H002, 0.81 square metres.
export const PARCEL_TOO_SMALL = `${DIR}/parcel-too-small-baseline.gpkg`
// H002, outside the red line boundary.
export const PARCEL_OUTSIDE_REDLINE = `${DIR}/parcel-outside-redline-baseline.gpkg`
export const NO_AREA_HABITATS_TABLE = `${DIR}/no-area-habitats-baseline-table.gpkg`
// Area Habitats Baseline has no Baseline Condition or Area column.
export const AREA_HABITATS_MISSING_COLUMNS = `${DIR}/missing-columns-in-area-habitats.gpkg`
// Area Habitats Baseline declares LINESTRING geometry.
export const AREA_HABITATS_WRONG_GEOMETRY_TYPE = `${DIR}/wrong-geometry-type-in-area-habitats.gpkg`
export const REDLINE_NO_GEOMETRY_COLUMN = `${DIR}/no-geometry-column-in-red-line-boundary.gpkg`
export const REDLINE_MULTIPLE_GEOMETRY_COLUMNS = `${DIR}/multiple-geometry-columns-in-red-line-boundary.gpkg`
// Red Line Boundary declares POINT geometry.
export const REDLINE_WRONG_GEOMETRY_TYPE = `${DIR}/wrong-geometry-type-in-red-line-boundary.gpkg`

// Advance and delay both set on H005, HG009 and R003 (Created) and H001, HG002
// and R006 (Enhanced): accepted and left unpriced. H006, Enhanced with neither,
// is priced.
export const ADVANCE_AND_DELAY_EVERY_LAYER = `${DIR}/advance-delay-both-set-every-layer.gpkg`

// Each Enhances one baseline habitat the service cannot price an enhancement
// of: H001, a Medium area habitat in Good condition; R001, a Medium
// watercourse in Good condition; HG001, a Very Low hedgerow; T008, a tree in
// Good condition.
export const UNENHANCEABLE_AREA = `${DIR}/invalid-area-medium-good-enhanced.gpkg`
export const UNENHANCEABLE_WATERCOURSE = `${DIR}/invalid-watercourse-medium-good-enhanced.gpkg`
export const UNENHANCEABLE_VERY_LOW_HEDGEROW = `${DIR}/invalid-hedgerow-very-low-enhanced.gpkg`
export const UNENHANCEABLE_TREE = `${DIR}/tree-enhanced-from-good.gpkg`

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

// H005, a Created area habitat with no target condition or timing: saved
// Incomplete, with no units.
export const AREA_CREATED_INCOMPLETE = `${DIR}/area-created-no-condition-or-timing.gpkg`

// H004 to H006, Enhanced Other neutral grassland with no target condition or
// strategic significance: each saved Incomplete, with no units.
export const AREA_ENHANCED_INCOMPLETE = `${DIR}/invalid-data-incomplete.gpkg`

// HG001 Enhanced into a hedgerow type the metric does not allow, so its
// proposed values are nulled and it is saved Incomplete; HG002 and HG003 are
// Enhanced and Complete.
export const HEDGEROW_INVALID_ENHANCEMENT = `${DIR}/invalid-hedgerow-medium-type-change.gpkg`

// A Low hedgerow replaced by two Very low ones: the Low band below zero,
// carried down to the Very low band as nothing.
export const HEDGEROW_LOW_DEFICIT_VERY_LOW = `${DIR}/trading-trade-down.gpkg`

// R001, a culvert Enhanced in place, saved Incomplete: the watercourse Low
// band below zero, with no Medium surplus to cover it.
export const WATERCOURSE_LOW_DEFICIT = `${DIR}/invalid-watercourse-culvert-enhanced.gpkg`

// The default site with four Retained area habitats renamed in both stages:
// H034 padded with three spaces each side, H029 `Étang-du-Moulin-Ælfrīc`.
export const LONG_AND_PADDED_REFS = `${DIR}/long-and-padded-refs.gpkg`

// The default site's baseline-stage file with long and padded area refs:
// '   H034   ', and H050 padded with x to 99 characters, among them.
export const LONG_PADDED_REFS_BASELINE = `${DIR}/long-and-padded-refs-baseline.gpkg`

// A baseline-stage file with one incomplete habitat per layer: H002 and HG001
// with no Baseline Condition, R007 with no riparian encroachment.
export const BASELINE_STAGE_INCOMPLETE = `${DIR}/baseline-incomplete-every-layer-baseline.gpkg`

// The Enhanced R006 and the Created R004 each missing a Proposed Encroachment.
export const WATERCOURSE_PROPOSED_ENCROACHMENT_BLANK = `${DIR}/watercourse-proposed-encroachment-blank.gpkg`

// No baseline watercourses, and one Created post-intervention ditch, R004.
export const WATERCOURSES_CREATED_ONLY = `${DIR}/watercourses-created-only.gpkg`

// The Enhanced HG002 with no Proposed Strategic Significance.
export const HEDGEROW_SIGNIFICANCE_BLANK = `${DIR}/hedgerow-enhanced-significance-blank.gpkg`

// HG001, an Enhanced hedgerow whose enhancement the Metric does not allow:
// saved Incomplete, its proposed values cleared.
export const HEDGEROW_ENHANCEMENT_NOT_POSSIBLE = `${DIR}/invalid-hedgerow-low-not-possible.gpkg`

// The default site with the Created HG015 given no target condition or
// timing: saved Incomplete.
export const CREATED_HEDGEROW_INCOMPLETE = `${DIR}/hedgerow-created-no-condition-or-timing.gpkg`

// The default site with the Enhanced R006's encroachments reduced on both
// sides: Minor and No Encroachment/No Encroachment, from Major and
// Moderate/Minor.
export const WATERCOURSE_ENCROACHMENT_REDUCED = `${DIR}/watercourse-enhanced-encroachment-reduced.gpkg`

// R001, a Culvert (Low) enhanced to Ditches Moderate: its baseline can become
// Ditches or Canals at any condition, over 10 years (BMD-1047).
export const WATERCOURSE_ENHANCED_CULVERT = `${DIR}/watercourse-enhanced-culvert.gpkg`

// The default site with the Enhanced H006 given no Proposed Strategic
// Significance: saved Incomplete, its proposed condition and years kept.
export const AREA_ENHANCED_SIGNIFICANCE_BLANK = `${DIR}/area-enhanced-significance-blank.gpkg`
