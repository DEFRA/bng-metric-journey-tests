#!/usr/bin/env python3
"""Reproducible GeoPackage fixture mutations for the post-intervention specs.

A GeoPackage (.gpkg) is a SQLite database, so these mutations are applied with
Python's stdlib ``sqlite3`` — no GDAL/ogr required. They set the "Retention
Category" attribute on individual features to exercise the BMD-531/534
post-intervention retention rules:

  - Area habitat "Lost"            -> backend maps to Created (kept, displayed)
  - Hedgerow/watercourse/tree Lost -> backend excludes at import (never shown)
  - Missing / unrecognised value   -> upload rejected (/error-file)

GOTCHA — RTree spatial-index triggers:
  gpkg feature tables carry ``rtree_<table>_<geom>_*`` triggers whose bodies
  call GDAL spatial functions (``ST_IsEmpty``, ``ST_MinX`` …) that plain
  sqlite3 does not provide. They fire on UPDATE and abort the write with
  "no such function: ST_IsEmpty". Because we only change an attribute (never
  geometry), the spatial index stays correct — so we drop those triggers, run
  the UPDATE, then recreate them verbatim from ``sqlite_master``.

Idempotent: re-running regenerates the tree fixture from its source and re-applies
the (already-committed) mixed-fixture change as a no-op.

Usage:
    python3 test/example-files/fixture-mutations.py
"""

import shutil
import sqlite3
from pathlib import Path

EX = Path(__file__).resolve().parent


def update_attr(con, table, set_clause, params):
    """UPDATE an attribute column, safely stepping around gpkg RTree triggers."""
    cur = con.cursor()
    triggers = cur.execute(
        "SELECT name, sql FROM sqlite_master "
        "WHERE type='trigger' AND tbl_name=? AND name LIKE 'rtree\\_%' ESCAPE '\\'",
        (table,),
    ).fetchall()
    for name, _ in triggers:
        cur.execute(f'DROP TRIGGER "{name}"')
    cur.execute(f'UPDATE "{table}" SET {set_clause}', params)
    for _, ddl in triggers:
        cur.execute(ddl)
    return cur.rowcount


def recut_mixed_fixture():
    """`mixed complete and incomplete.gpkg`: Lost hedgerows + Lost river.

    Areas are left untouched (H1 Retained with blank proposed columns -> Complete
    via the baseline side; H2/H3 Enhanced with blank proposed columns ->
    Incomplete). The hedgerows (H1/H2) and river (R1) are set to Lost so the
    backend excludes them at import — which also makes the file pass the strict
    retention schema (its original blank / "Null" linear values were rejected).

    Used by post-intervention-habitat-{details,list}.spec.js.
    """
    path = EX / "Post-intervention - mixed complete and incomplete.gpkg"
    con = sqlite3.connect(path)
    try:
        update_attr(
            con, "Hedgerows",
            '"Retention Category"=? WHERE "Parcel Ref" IN (?, ?)',
            ("Lost", "H1", "H2"),
        )
        update_attr(
            con, "Rivers",
            '"Retention Category"=? WHERE "Parcel Ref"=?',
            ("Lost", "R1"),
        )
        con.commit()
        _report(con, "mixed", [
            ("Habitats", "Parcel Ref"),
            ("Hedgerows", "Parcel Ref"),
            ("Rivers", "Parcel Ref"),
        ])
    finally:
        con.close()


def build_lost_tree_fixture():
    """`trees with a lost tree.gpkg`: copy of complete-with-trees, T007 -> Lost.

    T005/T006 stay Retained (listed); T007 becomes Lost so the backend drops it
    at import. Regenerated fresh from the source fixture on every run.

    Used by post-intervention-habitat-list.spec.js (lost tree exclusion).
    """
    src = EX / "Post-intervention - complete with trees.gpkg"
    dst = EX / "Post-intervention - trees with a lost tree.gpkg"
    shutil.copyfile(src, dst)
    con = sqlite3.connect(dst)
    try:
        update_attr(
            con, "Urban Trees",
            '"Retention Category"=? WHERE "Tree Ref"=?',
            ("Lost", "T007"),
        )
        con.commit()
        _report(con, "trees with a lost tree", [("Urban Trees", "Tree Ref")])
    finally:
        con.close()


def build_distinctiveness_fixture():
    """`habitat distinctiveness out of scope.gpkg`: copy of complete, H1 -> V.High.

    The distinctiveness check keys on "<Broad Habitat Type> - <Habitat Type>" and
    reads the *Proposed* columns for a post-intervention file, so H1's proposed
    pair is retargeted at "Grassland - Lowland meadows" (V.High in the engine's
    DISTINCTIVENESS_CATEGORIES). Every other parcel keeps the source fixture's
    placeholder type strings, which resolve to no band at all — so the file trips
    exactly one visible error and renders the BMD-405 single-error page.

    Used by upload-post-intervention.spec.js (distinctiveness rejection).
    """
    src = EX / "Post-intervention - complete.gpkg"
    dst = EX / "Post-intervention - habitat distinctiveness out of scope.gpkg"
    shutil.copyfile(src, dst)
    con = sqlite3.connect(dst)
    try:
        update_attr(
            con, "Habitats",
            '"Proposed Broad Habitat Type"=?, "Proposed Habitat Type"=? '
            'WHERE "Parcel Ref"=?',
            ("Grassland", "Lowland meadows", "H1"),
        )
        con.commit()
        print("\nhabitat distinctiveness out of scope:")
        for row in con.execute(
            'SELECT "Parcel Ref", "Proposed Broad Habitat Type", '
            '"Proposed Habitat Type" FROM "Habitats" WHERE "Parcel Ref"=?',
            ("H1",),
        ):
            print(f"  Habitats: {row}")
    finally:
        con.close()


def build_created_area_fixture():
    """`created area habitat.gpkg`: copy of complete, H2-7 -> genuinely Created.

    No shipped fixture — here or in the harness — has an area habitat whose
    GPKG "Retention Category" is literally "Created": every post-intervention
    file carries only Retained / Enhanced / Lost, and the backend *maps* a Lost
    area to Created at import. A Lost-sourced Created habitat still carries its
    baseline attributes, so it cannot exercise BMD-736's precondition
    ("Intervention type for the habitat is Created") faithfully. The harness's
    real-world bng-500 pairs do have genuine Created parcels but none of them
    clears the Beta validator (out-of-scope High distinctiveness, and their
    post-intervention habitat polygons do not tile the redline boundary).

    So H2-7 is recut here to match what a real created parcel looks like:
    Retention Category "Created" with every Baseline* attribute cleared, its
    proposed side (Lakes / Ponds (non-priority habitat), Good, Medium) left
    intact so units still calculate. Geometry is untouched, so the file still
    satisfies the area-sum-equals-redline rule.

    Used by the BMD-736 AC validation evidence spec.
    """
    src = EX / "Post-intervention - complete.gpkg"
    dst = EX / "Post-intervention - created area habitat.gpkg"
    shutil.copyfile(src, dst)
    con = sqlite3.connect(dst)
    try:
        update_attr(
            con, "Habitats",
            '"Retention Category"=?, '
            '"Baseline Broad Habitat Type"=NULL, '
            '"Baseline Habitat Type"=NULL, '
            '"Baseline Condition"=NULL, '
            '"Baseline Distinctiveness"=NULL, '
            '"Baseline Strategic Significance"=NULL '
            'WHERE "Parcel Ref"=?',
            ("Created", "H2-7"),
        )
        con.commit()
        _report(con, "created area habitat", [("Habitats", "Parcel Ref")])
    finally:
        con.close()


def build_watercourse_wc3_baseline_fixture():
    """`Baseline - watercourse ref WC3.gpkg`: river ref WC1 -> WC3.

    The post-intervention "watercourses mixed retention" fixture's only Created
    watercourse is WC3, but the shipped baseline watercourse file carries the
    ref WC1 — so a Created watercourse never has a ref-matching baseline
    feature and the "View baseline details" link is hidden for the wrong
    reason. Re-reffing the single baseline river to WC3 gives the Created
    watercourse a genuine baseline counterpart, which is what makes it possible
    to tell whether the Created watercourse page suppresses that link (as the
    Created hedgerow page does) or still resolves it by ref.

    Only the ref string changes — geometry, type, condition and encroachments
    are untouched, so the file still passes baseline validation.

    Used by the BMD-739 AC validation evidence spec.
    """
    src = EX / "Baseline - complete with watercourse refs.gpkg"
    dst = EX / "Baseline - watercourse ref WC3.gpkg"
    shutil.copyfile(src, dst)
    con = sqlite3.connect(dst)
    try:
        update_attr(
            con, "Rivers",
            '"Parcel Ref"=? WHERE "Parcel Ref"=?',
            ("WC3", "WC1"),
        )
        con.commit()
        rows = con.execute('SELECT "Parcel Ref" FROM "Rivers"').fetchall()
        print(f"\nwatercourse ref WC3 baseline:\n  Rivers: {rows}")
    finally:
        con.close()


def recut_all_unit_types_hg032():
    """`all unit and intervention types.gpkg`: HG032 proposed Poor -> Good.

    Backend PR #477 (BMD-820) nulls every proposed field of an enhancement that
    is not valid for its baseline, before the BMD-1051 strategic significance
    check runs. A Medium hedgerow must stay Medium with a strictly better
    condition, so HG032 (Moderate -> Poor) and HG031 (Good -> Moderate) were
    both rejected by BMD-820 and neither witnessed BMD-1051 any more. Moderate
    -> Good is a valid enhancement, so HG032 now reaches the BMD-1051 check,
    where its Medium Proposed Strategic Significance prices it at zero. HG031
    stays as the BMD-820 witness: recut_unenhanceable_baselines later makes it
    Moderate -> Moderate (BMD-1182 refuses a Good Medium baseline), which
    BMD-820 still rejects. HG032 is priced at zero either way, so no total
    changes. The harness's copy of this file keeps Poor.

    Used by hedgerows-post-intervention.spec.js and
    post-intervention-habitat-details.spec.js.
    """
    path = EX / "Post-intervention - all unit and intervention types.gpkg"
    con = sqlite3.connect(path)
    try:
        update_attr(
            con, "Hedgerows",
            '"Proposed Condition"=? WHERE "Parcel Ref"=?',
            ("Good", "HG032"),
        )
        con.commit()
        rows = con.execute(
            'SELECT "Parcel Ref", "Baseline Condition", "Proposed Condition" '
            'FROM "Hedgerows" WHERE "Parcel Ref"=?',
            ("HG032",),
        ).fetchall()
        print(f"\nall unit types HG032:\n  Hedgerows: {rows}")
    finally:
        con.close()


# BMD-1182 (backend PR #544) refuses the WHOLE file when an Enhanced feature's
# baseline cannot be enhanced: a Medium area habitat, hedgerow or watercourse in
# Good condition (an individual tree counts as a Medium area habitat), a Very
# Low hedgerow in any condition, or a Low hedgerow in Good condition whose type
# the metric lets become no Medium hedgerow. Each Good baseline below drops one
# step so the file imports again. Not every Low Good hedge is caught: "all unit
# and intervention types" HG040 (Native hedgerow, Good -> Poor) has a Medium
# target, so the backend accepts it and it is left alone. The hedgerows stay invalid under BMD-820 (a Medium hedge
# needs a strictly better condition), so they are still nulled at import as
# they were before; HR2 and HG012 were Good -> Good, so their proposed side
# drops with them to stay invalid rather than become a priced enhancement.
# Trees and area habitats only move their baseline units. HG001 in "net gain
# met" is Very Low, which no condition change can enhance, so it is Retained.
# HG006 in "created linear features" is a Low hedge in Good condition whose
# type has no Medium target since backend PR #551 repinned bng-library; it was
# Good -> Good and stays nulled as Moderate -> Moderate.
#   (file, table, ref column, ref, {column: value})
_ALL_TYPES = "Post-intervention - all unit and intervention types.gpkg"
_MODERATE_BASELINE = {"Baseline Condition": "Moderate"}
_MODERATE_BOTH_SIDES = {
    "Baseline Condition": "Moderate",
    "Proposed Condition": "Moderate",
}
_FAIRLY_GOOD_BASELINE = {"Baseline Condition": "Fairly Good"}
UNENHANCEABLE_BASELINE_RECUTS = [
    ("Post-intervention - hedgerows mixed retention.gpkg", "Hedgerows",
     "Parcel Ref", "HR2", _MODERATE_BOTH_SIDES),
    (_ALL_TYPES, "Habitats", "Parcel Ref", "H084", _MODERATE_BASELINE),
    (_ALL_TYPES, "Hedgerows", "Parcel Ref", "HG011", _MODERATE_BASELINE),
    (_ALL_TYPES, "Hedgerows", "Parcel Ref", "HG012", _MODERATE_BOTH_SIDES),
    (_ALL_TYPES, "Hedgerows", "Parcel Ref", "HG026", _MODERATE_BASELINE),
    (_ALL_TYPES, "Hedgerows", "Parcel Ref", "HG031", _MODERATE_BASELINE),
    *[(_ALL_TYPES, "Urban Trees", "Tree Ref", ref, _FAIRLY_GOOD_BASELINE)
      for ref in ("T018", "T027", "T029", "T033", "T053")],
    *[("Post-intervention - created linear features.gpkg", "Urban Trees",
       "Tree Ref", ref, _FAIRLY_GOOD_BASELINE)
      for ref in ("T017", "T024")],
    ("Post-intervention - created linear features.gpkg", "Hedgerows",
     "Parcel Ref", "HG006", _MODERATE_BOTH_SIDES),
    ("Post-intervention - linear net gain met.gpkg", "Habitats",
     "Parcel Ref", "H006", _MODERATE_BASELINE),
    ("Post-intervention - linear net gain met.gpkg", "Urban Trees",
     "Tree Ref", "T004", _FAIRLY_GOOD_BASELINE),
    ("Post-intervention - net gain met.gpkg", "Hedgerows",
     "Parcel Ref", "HG001", {"Retention Category": "Retained"}),
    # Fairly Good, not Moderate: Moderate cuts the baseline enough to lift the
    # watercourse gain past the 10% target (14.26%), which is the one thing
    # this fixture must not do. Fairly Good keeps it a positive gain below it.
    ("Post-intervention - watercourse gain below target.gpkg", "Rivers",
     "Parcel Ref", "R002", _FAIRLY_GOOD_BASELINE),
]


def recut_unenhanceable_baselines():
    """BMD-1182: lift every Enhanced row off an unenhanceable baseline.

    See UNENHANCEABLE_BASELINE_RECUTS. Used by
    post-intervention-habitat-details.spec.js, the area/hedgerows/watercourses
    post-intervention specs, project-summary.spec.js and
    test/utils/summary-projects.js.
    """
    for name, table, ref_col, ref, values in UNENHANCEABLE_BASELINE_RECUTS:
        con = sqlite3.connect(EX / name)
        try:
            for column, value in values.items():
                update_attr(
                    con, table,
                    f'"{column}"=? WHERE "{ref_col}"=?',
                    (value, ref),
                )
            con.commit()
            row = con.execute(
                f'SELECT "{ref_col}", "Baseline Condition", '
                f'"Proposed Condition", "Retention Category" '
                f'FROM "{table}" WHERE "{ref_col}"=?',
                (ref,),
            ).fetchone()
            assert row is not None, f"{name}: no {table} row with {ref_col}={ref}"
            print(f"unenhanceable baseline recut ({name}): {row}")
        finally:
            con.close()


def _build_all_created_fixture(src_name, dst_name, table):
    src = EX / src_name
    dst = EX / dst_name
    shutil.copyfile(src, dst)
    con = sqlite3.connect(dst)
    try:
        update_attr(con, table, '"Retention Category"=?', ("Created",))
        con.commit()
        _report(con, dst_name, [(table, "Parcel Ref")])
    finally:
        con.close()


def build_created_hedgerows_fixture():
    """`created hedgerows.gpkg`: copy of complete with hedgerows, HR1-HR3 Created.

    Backend PR #478 (BMD-1056/BMD-1066) derives the baseline from a
    post-intervention file's own rows, so a Retained or Enhanced hedgerow now
    puts hedgerows into the baseline too. Only a file whose hedgerows are all
    Created reaches the post-intervention-only state (BMD-897/BMD-919). The
    Baseline* columns are left as they are: the backend ignores them on a
    Created row.

    Used by getHedgerowGainProject in test/utils/summary-projects.js.
    """
    _build_all_created_fixture(
        "Post-intervention - complete with hedgerows.gpkg",
        "Post-intervention - created hedgerows.gpkg",
        "Hedgerows",
    )


def build_created_watercourses_fixture():
    """`created watercourses.gpkg`: copy of complete with watercourses, WC1-WC3 Created.

    The watercourse twin of build_created_hedgerows_fixture.

    Used by getWatercourseGainProject in test/utils/summary-projects.js.
    """
    _build_all_created_fixture(
        "Post-intervention - complete with watercourses.gpkg",
        "Post-intervention - created watercourses.gpkg",
        "Rivers",
    )


def build_watercourses_uplift_fixture():
    """`watercourses mixed retention uplift.gpkg`: copy of watercourses mixed retention, WC2 Good.

    Backend PR #478 (BMD-1056/BMD-1066) derives the baseline from the PI file:
    WC1 (Retained) and WC2 (Enhanced, Moderate -> Moderate). With nothing
    gained, the watercourse trading verdict became Not met, the same as the
    area verdict, so the watercourses post-intervention page could no longer
    show it reads its own verdict. Improving WC2 to Good makes the watercourse
    verdict Met again while the area verdict stays Not met.

    Used by getWatercourseInterventionTypesProject in
    test/utils/summary-projects.js.
    """
    src = EX / "Post-intervention - watercourses mixed retention.gpkg"
    dst = EX / "Post-intervention - watercourses mixed retention uplift.gpkg"
    shutil.copyfile(src, dst)
    con = sqlite3.connect(dst)
    try:
        update_attr(
            con, "Rivers",
            '"Proposed Condition"=? WHERE "Parcel Ref"=?',
            ("Good", "WC2"),
        )
        con.commit()
        rows = con.execute(
            'SELECT "Parcel Ref", "Retention Category", "Proposed Condition" '
            'FROM "Rivers"'
        ).fetchall()
        print(f"\nwatercourses mixed retention uplift:\n  Rivers: {rows}")
    finally:
        con.close()


def build_unrecognised_riparian_fixture():
    """`Baseline - unrecognised riparian encroachment.gpkg`: R002 riparian -> Severe/Severe.

    BMD-1059 (backend PR#476) saves a blank or unrecognised encroachment as
    null instead of reading it as "no encroachment, x1", so the watercourse is
    Incomplete and its units are cleared. No other fixture in this repo or the
    harness carries such a value, so this one does: a copy of `no hedgerows`
    (three Ditches rivers, the watercourses baseline grid fixture) with R002's
    riparian encroachment changed from "Minor/Minor" to "Severe/Severe", which
    is not in the reference data and which normalisation leaves unchanged.

    One defect only: the watercourse encroachment ("Major"), type and condition
    are untouched, so the upload still passes validation and only that field is
    nulled. Used by watercourses-baseline.spec.js.
    """
    src = EX / "Baseline - no hedgerows.gpkg"
    dst = EX / "Baseline - unrecognised riparian encroachment.gpkg"
    shutil.copyfile(src, dst)
    con = sqlite3.connect(dst)
    try:
        update_attr(
            con, "Rivers",
            '"Baseline Encroachment into riparian zone"=? WHERE "Parcel Ref"=?',
            ("Severe/Severe", "R002"),
        )
        con.commit()
        rows = con.execute(
            'SELECT "Parcel Ref", "Baseline Encroachment into Watercourse", '
            '"Baseline Encroachment into riparian zone" FROM "Rivers"'
        ).fetchall()
        print(f"\nunrecognised riparian encroachment baseline:\n  Rivers: {rows}")
    finally:
        con.close()


def build_null_proposed_encroachment_fixture():
    """`Post-intervention - null proposed encroachment.gpkg`: WC2/WC3 proposed -> NULL.

    BMD-1070's developer note: a null encroachment must no longer be read as
    "no encroachment". Created and Enhanced watercourses are priced from their
    PROPOSED encroachments, so a null there must leave them unpriced.

    A copy of `watercourses mixed retention uplift` (WC1 Retained, WC2
    Enhanced, WC3 Created, all priced) with WC2's proposed watercourse
    encroachment and WC3's proposed riparian encroachment emptied. WC1 is
    untouched and stays priced as the control.

    One defect per row, so the upload still passes validation. Used by
    watercourses-post-intervention.spec.js.
    """
    src = EX / "Post-intervention - watercourses mixed retention uplift.gpkg"
    dst = EX / "Post-intervention - null proposed encroachment.gpkg"
    shutil.copyfile(src, dst)
    con = sqlite3.connect(dst)
    try:
        update_attr(
            con, "Rivers",
            '"Proposed Encroachment into Watercourse"=NULL WHERE "Parcel Ref"=?',
            ("WC2",),
        )
        update_attr(
            con, "Rivers",
            '"Proposed Encroachment into riparian zone"=NULL WHERE "Parcel Ref"=?',
            ("WC3",),
        )
        con.commit()
        rows = con.execute(
            'SELECT "Parcel Ref", "Retention Category", '
            '"Proposed Encroachment into Watercourse", '
            '"Proposed Encroachment into riparian zone" FROM "Rivers"'
        ).fetchall()
        print(f"\nnull proposed encroachment post-intervention:\n  Rivers: {rows}")
    finally:
        con.close()


_CREATED_AREA_SIGNIFICANCE = "Proposed Strategic Significance"
_CREATED_AREA_NO_TARGET = {
    "Proposed Condition": None,
    "Habitat created in advance/years": None,
    "Delay in starting habitat creation/years": None,
}

# BMD-1048 (Created area edit form). Each file is `created area habitat.gpkg`
# with H2-7's attributes changed as listed. Only `partly blank` has a journey
# test (post-intervention-habitat-details.spec.js, AC2); the rest back the
# /validate-ac-manual demos named in each entry.
_BMD1048_CREATED_AREA_VARIANTS = [
    # AC2a and AC2e: no target condition or timing; the legacy significance
    # label the file already carries maps to Low (frontend PR#448).
    ("Post-intervention - created area partly blank.gpkg", _CREATED_AREA_NO_TARGET),
    # AC2b: no dropdown value at all.
    (
        "Post-intervention - created area all blank.gpkg",
        {
            **_CREATED_AREA_NO_TARGET,
            "Proposed Broad Habitat Type": None,
            "Proposed Habitat Type": None,
            "Proposed Distinctiveness": None,
            _CREATED_AREA_SIGNIFICANCE: None,
        },
    ),
    # AC2c: no reference, which the upload refuses.
    ("Post-intervention - created area blank reference.gpkg", {"Parcel Ref": None}),
    # AC2d: the legacy label for High.
    (
        "Post-intervention - created area partly blank high significance.gpkg",
        {
            **_CREATED_AREA_NO_TARGET,
            _CREATED_AREA_SIGNIFICANCE: "Formally identified in local strategy",
        },
    ),
    # AC2f: the legacy Medium label, rejected at import (BMD-1051).
    (
        "Post-intervention - created area partly blank unsupported significance.gpkg",
        {
            **_CREATED_AREA_NO_TARGET,
            _CREATED_AREA_SIGNIFICANCE: (
                "Location ecologically desirable but not in local strategy"
            ),
        },
    ),
]

# BMD-1048 flag-on demos. `service-template/area-created.gpkg` is a verbatim
# copy of the harness's
# example-files/service-template/permutations/intervention/area-created.gpkg;
# these cut its Created habitat H001.
_BMD1048_SERVICE_TEMPLATE_VARIANTS = [
    # AC2a-flag-on: no target condition or timing.
    (
        "service-template/area-created-no-condition-or-timing.gpkg",
        _CREATED_AREA_NO_TARGET,
    ),
    # AC2c-flag-on: no broad habitat or type, which the upload refuses.
    (
        "service-template/area-created-no-habitat-type.gpkg",
        {
            "Proposed Broad Habitat Type": None,
            "Proposed Habitat Type": None,
            "Proposed Distinctiveness": None,
        },
    ),
]


def _build_attribute_variant(src_name, dst_name, table, ref_col, ref, values):
    shutil.copyfile(EX / src_name, EX / dst_name)
    con = sqlite3.connect(EX / dst_name)
    try:
        (matches,) = con.execute(
            f'SELECT count(*) FROM "{table}" WHERE "{ref_col}"=?', (ref,)
        ).fetchone()
        if matches != 1:
            raise SystemExit(f"{dst_name}: expected 1 {ref} row, found {matches}")
        assignments = ", ".join(f'"{column}"=?' for column in values)
        update_attr(
            con, table, f'{assignments} WHERE "{ref_col}"=?',
            (*values.values(), ref),
        )
        con.commit()
        print(f"  {dst_name}: {ref} {sorted(values)}")
    finally:
        con.close()


def build_bmd1048_created_area_fixtures():
    """BMD-1048 Created area fixtures: see the two variant lists above."""
    print("\nBMD-1048 created area variants:")
    for dst_name, values in _BMD1048_CREATED_AREA_VARIANTS:
        _build_attribute_variant(
            "Post-intervention - created area habitat.gpkg", dst_name,
            "Habitats", "Parcel Ref", "H2-7", values,
        )
    for dst_name, values in _BMD1048_SERVICE_TEMPLATE_VARIANTS:
        _build_attribute_variant(
            "service-template/area-created.gpkg", dst_name,
            "Area Habitats Post-Intervention", "Habitat Ref", "H001", values,
        )


def _report(con, label, layers):
    print(f"\n{label}:")
    for table, ref in layers:
        rows = con.execute(
            f'SELECT "{ref}", "Retention Category" FROM "{table}"'
        ).fetchall()
        print(f"  {table}: {rows}")


if __name__ == "__main__":
    recut_mixed_fixture()
    build_lost_tree_fixture()
    build_distinctiveness_fixture()
    build_created_area_fixture()
    build_watercourse_wc3_baseline_fixture()
    recut_all_unit_types_hg032()
    recut_unenhanceable_baselines()
    build_created_hedgerows_fixture()
    build_created_watercourses_fixture()
    build_watercourses_uplift_fixture()
    build_unrecognised_riparian_fixture()
    build_null_proposed_encroachment_fixture()
    build_bmd1048_created_area_fixtures()
    print("\nDone.")
