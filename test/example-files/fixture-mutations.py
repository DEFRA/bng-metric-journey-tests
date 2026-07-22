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
    print("\nDone.")
