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
    print("\nDone.")
