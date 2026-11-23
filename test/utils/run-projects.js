// The projects each spec uses, in the template this run tests. Each
// `getRun*Project` returns the legacy project from summary-projects.js in the
// legacy run, or a BNG Service template stand-in for it in the
// service-template run; each `getServiceTemplate*Project` is a project only
// the service-template run uses. They share summary-projects.js's project
// cache, so a project either module builds is built once per worker.
import { isServiceTemplateRun } from '@utils/template-run.js'
import {
  AREA_CREATED_INCOMPLETE,
  AREA_ENHANCED_INCOMPLETE,
  AREA_TRADING_DEFICIT,
  AREA_TRADING_DEFICIT_BASELINE,
  BASELINE_INCOMPLETE_EVERY_LAYER,
  BASELINE_SIGNIFICANCE_HIGH,
  DATA_COMPLETE,
  DEFAULT_SITE,
  DEFAULT_SITE_BASELINE,
  EVERY_VERTICAL_RETENTION,
  HEDGEROW_INVALID_ENHANCEMENT,
  HEDGEROW_LOW_DEFICIT_VERY_LOW,
  HEDGEROW_SIGNIFICANCE_BLANK,
  LONG_AND_PADDED_REFS,
  LONG_PADDED_REFS_BASELINE,
  LOW_LOSS_COVERED,
  NET_GAIN_MET,
  NO_RETAINED_AREA,
  SMALL_SITE,
  SMALL_SITE_BASELINE,
  TRADING_ALL_MET,
  TREE_SIZES,
  VERY_LOW_HEDGEROW_LOST,
  WATERCOURSE_DEGRADED,
  WATERCOURSE_DEGRADED_BASELINE,
  WATERCOURSE_ENHANCED_SHORTER,
  WATERCOURSE_LOW_DEFICIT,
  WATERCOURSE_PROPOSED_ENCROACHMENT_BLANK,
  WATERCOURSE_REMEANDERED,
  WATERCOURSES_CREATED_ONLY
} from '@utils/service-template-files.js'
import {
  buildBaselineOnlyProject,
  buildPostInterventionOnlyProject,
  getOrBuildProject,
  projectKey,
  getAllUnitTypesPostInterventionProject,
  getAllUnitTypesProject,
  getAreaGainProject,
  getAreaInterventionTypesProject,
  getAreaTradingDeficitProject,
  getBaselineOnlyProject,
  getHedgerowGainProject,
  getHedgerowInterventionTypesProject,
  getHedgerowTradingAllMetProject,
  getHedgerowTradingMetProject,
  getIntertidalTradingProject,
  getLinearInterventionTypesProject,
  getNoHedgerowsPostInterventionProject,
  getNoWatercoursesPostInterventionProject,
  getNoWatercoursesProject,
  getTargetMetProject,
  getTreesPostInterventionProject,
  getWatercourseGainProject,
  getWatercourseInterventionTypesProject
} from '@utils/summary-projects.js'

/**
 * A project with a baseline and no post-intervention data, in the BNG
 * Service template: the small site's baseline-stage file.
 *
 * @param {import('@playwright/test').Browser} browser
 * @returns {Promise<{id: string, name: string}>}
 */
export function getServiceTemplateBaselineProject(browser) {
  return getOrBuildProject(projectKey(SMALL_SITE_BASELINE), () =>
    buildBaselineOnlyProject(browser, SMALL_SITE_BASELINE)
  )
}

/**
 * A project with a baseline and no post-intervention data, in the template
 * this run tests, for a spec that needs a baseline but none in particular.
 *
 * @param {import('@playwright/test').Browser} browser
 * @returns {Promise<{id: string, name: string}>}
 */
export function getRunBaselineProject(browser) {
  return isServiceTemplateRun()
    ? getServiceTemplateBaselineProject(browser)
    : getBaselineOnlyProject(browser)
}

/**
 * A BNG Service template file uploaded at the baseline + post-intervention
 * upload into an empty project, which writes both documents from the one
 * file. Shared, as the other builds are.
 */
function getServiceTemplatePostInterventionProject(browser, file) {
  return getOrBuildProject(projectKey(undefined, file), () =>
    buildPostInterventionOnlyProject(browser, file)
  )
}

/**
 * The BNG Service template stand-ins for the legacy projects below, each
 * picked for the property its legacy project is used for, and each project in
 * the template this run tests.
 *
 * - every unit type, baseline only: the default site's baseline-stage file;
 * - every unit type, with a post-intervention document: the default site,
 *   whose area habitats (267.48 -> 230.88 units) and watercourses (7.65 ->
 *   2.45, against 8.42 required) fall short of the 10% target, and whose area
 *   and watercourse trading rules are not met. Its hedgerows clear the target
 *   (23.40 -> 26.67), so a hedgerow shortfall uses the small site;
 * - area habitats that meet the target and the trading rules:
 *   trading-all-met.gpkg.
 *
 * @param {import('@playwright/test').Browser} browser
 * @returns {Promise<{id: string, name: string}>}
 */
export function getRunAllUnitTypesProject(browser) {
  return isServiceTemplateRun()
    ? getOrBuildProject(projectKey(DEFAULT_SITE_BASELINE), () =>
        buildBaselineOnlyProject(browser, DEFAULT_SITE_BASELINE)
      )
    : getAllUnitTypesProject(browser)
}

/** @see getRunAllUnitTypesProject */
export function getRunAllUnitTypesPostInterventionProject(browser) {
  return isServiceTemplateRun()
    ? getServiceTemplatePostInterventionProject(browser, DEFAULT_SITE)
    : getAllUnitTypesPostInterventionProject(browser)
}

/** @see getRunAllUnitTypesProject */
export function getRunAreaGainProject(browser) {
  return isServiceTemplateRun()
    ? getServiceTemplatePostInterventionProject(browser, TRADING_ALL_MET)
    : getAreaGainProject(browser)
}

/**
 * Area post-intervention stand-ins, as above:
 *
 * - area habitats on all three tabs, priced: the default site, whose tabs also
 *   hold its vertical area habitats and trees;
 * - no Retained area habitat at all: thirty-plus.gpkg;
 * - a tree in every size band: size-and-setting.gpkg;
 * - a Retained habitat whose file gives a strategic significance above Low:
 *   baseline-significance-high.gpkg (legacy: the all-unit-types pair).
 */
export function getRunAreaInterventionTypesProject(browser) {
  return isServiceTemplateRun()
    ? getServiceTemplatePostInterventionProject(browser, DEFAULT_SITE)
    : getAreaInterventionTypesProject(browser)
}

/** @see getRunAreaInterventionTypesProject */
export function getRunNoRetainedAreaProject(browser) {
  return isServiceTemplateRun()
    ? getServiceTemplatePostInterventionProject(browser, NO_RETAINED_AREA)
    : getAreaGainProject(browser)
}

/** @see getRunAreaInterventionTypesProject */
export function getRunTreesPostInterventionProject(browser) {
  return isServiceTemplateRun()
    ? getServiceTemplatePostInterventionProject(browser, TREE_SIZES)
    : getTreesPostInterventionProject(browser)
}

/** @see getRunAreaInterventionTypesProject */
export function getRunRetainedSignificanceProject(browser) {
  return isServiceTemplateRun()
    ? getServiceTemplatePostInterventionProject(
        browser,
        BASELINE_SIGNIFICANCE_HIGH
      )
    : getAllUnitTypesPostInterventionProject(browser)
}

/**
 * Area trading summary stand-ins:
 *
 * - a Medium deficit not covered from below: the same harness scenario in the
 *   BNG Service template, trading-higher-deficit-not-covered-from-below.gpkg,
 *   with the same figures;
 * - an IGGI habitat in the merged intertidal group: every-retention.gpkg,
 *   whose IGGI is a vertical area habitat.
 */
export function getRunAreaTradingDeficitProject(browser) {
  return isServiceTemplateRun()
    ? getServiceTemplatePostInterventionProject(browser, AREA_TRADING_DEFICIT)
    : getAreaTradingDeficitProject(browser)
}

/** @see getRunAreaTradingDeficitProject */
export function getRunIntertidalTradingProject(browser) {
  return isServiceTemplateRun()
    ? getServiceTemplatePostInterventionProject(
        browser,
        EVERY_VERTICAL_RETENTION
      )
    : getIntertidalTradingProject(browser)
}

/**
 * Hedgerow stand-ins:
 *
 * - hedgerows and no watercourses, baseline only: the Medium deficit
 *   scenario's baseline-stage file;
 * - no hedgerows, baseline only: the degraded watercourse's baseline-stage
 *   file (the legacy baseline-only project has none either);
 * - hedgerows that fall short of the 10% target: the small site (legacy: the
 *   all-unit-types pair; the default site's hedgerows clear the target);
 * - hedgerows Met in every band, with both linear types clearing the target:
 *   trading-all-met.gpkg;
 * - hedgerows only post-intervention: thirty-plus.gpkg.
 */
export function getRunNoWatercoursesProject(browser) {
  return isServiceTemplateRun()
    ? getOrBuildProject(projectKey(AREA_TRADING_DEFICIT_BASELINE), () =>
        buildBaselineOnlyProject(browser, AREA_TRADING_DEFICIT_BASELINE)
      )
    : getNoWatercoursesProject(browser)
}

/** @see getRunNoWatercoursesProject */
export function getRunNoHedgerowsBaselineProject(browser) {
  return isServiceTemplateRun()
    ? getOrBuildProject(projectKey(WATERCOURSE_DEGRADED_BASELINE), () =>
        buildBaselineOnlyProject(browser, WATERCOURSE_DEGRADED_BASELINE)
      )
    : getBaselineOnlyProject(browser)
}

/** @see getRunNoWatercoursesProject */
export function getRunHedgerowShortfallProject(browser) {
  return isServiceTemplateRun()
    ? getServiceTemplatePostInterventionProject(browser, SMALL_SITE)
    : getAllUnitTypesPostInterventionProject(browser)
}

/** @see getRunNoWatercoursesProject */
export function getRunHedgerowTradingMetProject(browser) {
  return isServiceTemplateRun()
    ? getServiceTemplatePostInterventionProject(browser, TRADING_ALL_MET)
    : getHedgerowTradingMetProject(browser)
}

/** @see getRunNoWatercoursesProject */
export function getRunHedgerowTradingAllMetProject(browser) {
  return isServiceTemplateRun()
    ? getServiceTemplatePostInterventionProject(browser, TRADING_ALL_MET)
    : getHedgerowTradingAllMetProject(browser)
}

/** @see getRunNoWatercoursesProject */
export function getRunTargetMetProject(browser) {
  return isServiceTemplateRun()
    ? getServiceTemplatePostInterventionProject(browser, TRADING_ALL_MET)
    : getTargetMetProject(browser)
}

/** @see getRunNoWatercoursesProject */
export function getRunHedgerowGainProject(browser) {
  return isServiceTemplateRun()
    ? getServiceTemplatePostInterventionProject(browser, NO_RETAINED_AREA)
    : getHedgerowGainProject(browser)
}

/**
 * Hedgerows post-intervention stand-ins:
 *
 * - hedgerows on all three tabs, and the grids' rows: the default site, whose
 *   Enhanced and Created hedgerows are all priced;
 * - Retained and Enhanced hedgerows but no Created one: trading-all-met.gpkg;
 * - hedgerows that break the trading rules: the small site (legacy: the area
 *   gain pair).
 */
export function getRunHedgerowInterventionTypesProject(browser) {
  return isServiceTemplateRun()
    ? getServiceTemplatePostInterventionProject(browser, DEFAULT_SITE)
    : getHedgerowInterventionTypesProject(browser)
}

/** @see getRunHedgerowInterventionTypesProject */
export function getRunLinearInterventionTypesProject(browser) {
  return isServiceTemplateRun()
    ? getServiceTemplatePostInterventionProject(browser, DEFAULT_SITE)
    : getLinearInterventionTypesProject(browser)
}

/** @see getRunHedgerowInterventionTypesProject */
export function getRunHedgerowNoCreatedProject(browser) {
  return isServiceTemplateRun()
    ? getServiceTemplatePostInterventionProject(browser, TRADING_ALL_MET)
    : getAllUnitTypesPostInterventionProject(browser)
}

/** @see getRunHedgerowInterventionTypesProject */
export function getRunHedgerowTradingNotMetProject(browser) {
  return isServiceTemplateRun()
    ? getServiceTemplatePostInterventionProject(browser, SMALL_SITE)
    : getAreaGainProject(browser)
}

/**
 * Hedgerows trading summary stand-ins:
 *
 * - a Low loss covered by the Medium surplus, with no watercourses: the same
 *   harness scenario in the BNG Service template,
 *   trading-lower-deficit-covered-from-above.gpkg (legacy: the hedgerow
 *   trading Met pair, built from that scenario);
 * - a Very low band below zero under Met Medium and Low bands:
 *   trading-lost-to-development.gpkg, which only the BNG Service template run
 *   uses.
 */
export function getRunHedgerowLowLossCoveredProject(browser) {
  return isServiceTemplateRun()
    ? getServiceTemplatePostInterventionProject(browser, LOW_LOSS_COVERED)
    : getHedgerowTradingMetProject(browser)
}

/** @see getRunHedgerowLowLossCoveredProject */
export function getServiceTemplateVeryLowDeficitProject(browser) {
  return getServiceTemplatePostInterventionProject(
    browser,
    VERY_LOW_HEDGEROW_LOST
  )
}

/**
 * Watercourses post-intervention stand-ins:
 *
 * - watercourses on all three tabs: the default site, whose Created R005 is
 *   left unpriced (Incomplete), and whose baseline R002 is removed;
 * - a watercourse re-meandered to a longer course than its parent:
 *   watercourse-remeandered.gpkg, which only the BNG Service template run
 *   uses.
 */
export function getRunWatercourseInterventionTypesProject(browser) {
  return isServiceTemplateRun()
    ? getServiceTemplatePostInterventionProject(browser, DEFAULT_SITE)
    : getWatercourseInterventionTypesProject(browser)
}

/** @see getRunWatercourseInterventionTypesProject */
export function getServiceTemplateRemeanderedWatercourseProject(browser) {
  return getServiceTemplatePostInterventionProject(
    browser,
    WATERCOURSE_REMEANDERED
  )
}

/**
 * Project summary stand-ins:
 *
 * - trees in a baseline: the default site's baseline-stage file (legacy: the
 *   baseline-only project, whose trees are in its area habitats);
 * - hedgerows in neither document: the degraded watercourse's file;
 * - watercourses in neither document: the Medium deficit scenario,
 *   trading-higher-deficit-not-covered-from-below.gpkg;
 * - watercourse trading rules Met while the area ones are not: net-gain-met.gpkg
 *   (legacy: the target-met pair);
 * - area trading rules Met while the hedgerow and watercourse ones are not:
 *   data-complete.gpkg (legacy: the area gain pair);
 * - one hedgerow band failing while the Medium band is Met:
 *   trading-lost-to-development.gpkg, whose Very low band fails (legacy: the
 *   linear intervention types pair, whose Low and Very low bands fail);
 * - watercourses gaining less than the 10% target:
 *   watercourse-enhanced-shorter.gpkg, which only the BNG Service template run
 *   uses; the legacy pair is project-summary.spec.js's own.
 */
export function getRunAreaTreesBaselineProject(browser) {
  return isServiceTemplateRun()
    ? getRunAllUnitTypesProject(browser)
    : getBaselineOnlyProject(browser)
}

/** @see getRunAreaTreesBaselineProject */
export function getRunNoHedgerowsPostInterventionProject(browser) {
  return isServiceTemplateRun()
    ? getServiceTemplatePostInterventionProject(browser, WATERCOURSE_DEGRADED)
    : getNoHedgerowsPostInterventionProject(browser)
}

/** @see getRunAreaTreesBaselineProject */
export function getRunNoWatercoursesPostInterventionProject(browser) {
  return isServiceTemplateRun()
    ? getServiceTemplatePostInterventionProject(browser, AREA_TRADING_DEFICIT)
    : getNoWatercoursesPostInterventionProject(browser)
}

/** @see getRunAreaTreesBaselineProject */
export function getRunWatercourseTradingMetProject(browser) {
  return isServiceTemplateRun()
    ? getServiceTemplateNetGainMetProject(browser)
    : getTargetMetProject(browser)
}

/**
 * net-gain-met.gpkg: area habitats clear the 10% target (+290.4%) and still
 * break their trading rules.
 */
export function getServiceTemplateNetGainMetProject(browser) {
  return getServiceTemplatePostInterventionProject(browser, NET_GAIN_MET)
}

/** @see getRunAreaTreesBaselineProject */
export function getRunAreaTradingOnlyMetProject(browser) {
  return isServiceTemplateRun()
    ? getServiceTemplatePostInterventionProject(browser, DATA_COMPLETE)
    : getAreaGainProject(browser)
}

/** @see getRunAreaTreesBaselineProject */
export function getRunHedgerowOneBandFailingProject(browser) {
  return isServiceTemplateRun()
    ? getServiceTemplateVeryLowDeficitProject(browser)
    : getLinearInterventionTypesProject(browser)
}

/** @see getRunAreaTreesBaselineProject */
export function getServiceTemplateWatercourseBelowTargetProject(browser) {
  return getServiceTemplatePostInterventionProject(
    browser,
    WATERCOURSE_ENHANCED_SHORTER
  )
}

/**
 * Projects only the BNG Service template run uses, for the grids' Status
 * column and the unpriced rows an import leaves Incomplete, and for trading
 * bands below zero:
 *
 * - area habitats Enhanced, three Complete and three Incomplete with no
 *   proposed condition or strategic significance: invalid-data-incomplete.gpkg;
 * - a hedgerow Enhanced into a type the metric does not allow, beside two
 *   Complete Enhanced hedgerows: invalid-hedgerow-medium-type-change.gpkg;
 * - a hedgerow Low band below zero over a Very low band:
 *   trading-trade-down.gpkg;
 * - a watercourse Low band below zero with no Medium surplus:
 *   invalid-watercourse-culvert-enhanced.gpkg.
 */
export function getServiceTemplateIncompleteEnhancementsProject(browser) {
  return getServiceTemplatePostInterventionProject(
    browser,
    AREA_ENHANCED_INCOMPLETE
  )
}

/**
 * The default site with H005, one of its many Created area habitats, saved
 * Incomplete: area-created-no-condition-or-timing.gpkg.
 */
export function getServiceTemplateCreatedIncompleteProject(browser) {
  return getServiceTemplatePostInterventionProject(
    browser,
    AREA_CREATED_INCOMPLETE
  )
}

/** @see getServiceTemplateIncompleteEnhancementsProject */
export function getServiceTemplateHedgerowInvalidEnhancementProject(browser) {
  return getServiceTemplatePostInterventionProject(
    browser,
    HEDGEROW_INVALID_ENHANCEMENT
  )
}

/** @see getServiceTemplateIncompleteEnhancementsProject */
export function getServiceTemplateHedgerowLowDeficitProject(browser) {
  return getServiceTemplatePostInterventionProject(
    browser,
    HEDGEROW_LOW_DEFICIT_VERY_LOW
  )
}

/** @see getServiceTemplateIncompleteEnhancementsProject */
export function getServiceTemplateWatercourseLowDeficitProject(browser) {
  return getServiceTemplatePostInterventionProject(
    browser,
    WATERCOURSE_LOW_DEFICIT
  )
}

/**
 * Watercourses only post intervention, from a baseline with none: the legacy
 * watercourse gain pair, or watercourses-created-only.gpkg, whose one
 * watercourse is a Created ditch with no parent.
 *
 * @param {import('@playwright/test').Browser} browser
 * @returns {Promise<{id: string, name: string}>}
 */
export function getRunWatercourseGainProject(browser) {
  return isServiceTemplateRun()
    ? getServiceTemplatePostInterventionProject(
        browser,
        WATERCOURSES_CREATED_ONLY
      )
    : getWatercourseGainProject(browser)
}

/**
 * More projects only the BNG Service template run uses, each from a corpus
 * file made for one edge case:
 *
 * - long, non-ASCII and space-padded Habitat Refs on four Retained area
 *   habitats: long-and-padded-refs.gpkg, and its baseline-stage file;
 * - one incomplete baseline habitat per layer, at a baseline upload:
 *   baseline-incomplete-every-layer-baseline.gpkg;
 * - an Enhanced and a Created watercourse each missing a proposed
 *   encroachment: watercourse-proposed-encroachment-blank.gpkg;
 * - an Enhanced hedgerow with no proposed strategic significance:
 *   hedgerow-enhanced-significance-blank.gpkg.
 */
export function getServiceTemplateLongRefsProject(browser) {
  return getServiceTemplatePostInterventionProject(
    browser,
    LONG_AND_PADDED_REFS
  )
}

/** @see getServiceTemplateLongRefsProject */
export function getServiceTemplateLongRefsBaselineProject(browser) {
  return getOrBuildProject(projectKey(LONG_PADDED_REFS_BASELINE), () =>
    buildBaselineOnlyProject(browser, LONG_PADDED_REFS_BASELINE)
  )
}

/** @see getServiceTemplateLongRefsProject */
export function getServiceTemplateIncompleteBaselineProject(browser) {
  return getOrBuildProject(projectKey(BASELINE_INCOMPLETE_EVERY_LAYER), () =>
    buildBaselineOnlyProject(browser, BASELINE_INCOMPLETE_EVERY_LAYER)
  )
}

/** @see getServiceTemplateLongRefsProject */
export function getServiceTemplateBlankProposedEncroachmentProject(browser) {
  return getServiceTemplatePostInterventionProject(
    browser,
    WATERCOURSE_PROPOSED_ENCROACHMENT_BLANK
  )
}

/** @see getServiceTemplateLongRefsProject */
export function getServiceTemplateHedgerowSignificanceBlankProject(browser) {
  return getServiceTemplatePostInterventionProject(
    browser,
    HEDGEROW_SIGNIFICANCE_BLANK
  )
}
