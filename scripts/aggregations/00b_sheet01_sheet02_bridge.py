#!/usr/bin/env python3
"""S5.5 #1a — sheet_01 ↔ sheet_02 SK bridge.

Problem: sheet_01_institution_funding_panel (the HERD-tracked 1,014-uni panel)
and sheet_02_institution_agency (a 2,056-SK federal-grants universe) live on
different `institution_sk` surrogate spaces. Only 504 SKs overlap directly,
which means 524 of the 1,014 HERD profile pages have no rows in any
aggregation that sources sheet_02 — empty "Federal funding by agency" charts.

This script emits a directional bridge from each sheet_02 SK to the sheet_01
SK(s) that should consume its data. A single sheet_02 SK may map to multiple
sheet_01 SKs when sub-campuses share a single rolled-up federal record (e.g.
"PENNSYLVANIA STATE UNIVERSITY, THE" in sheet_02 should feed both itself and
"Pennsylvania State University, The, University Park and Hershey Medical
Center" in sheet_01).

Match passes (most specific to most general):
  1) Direct SK equality                              ('self_identity')
  2) Normalized canonical_name + state_code match     ('exact')
  3) Name-only unique match (state blank in sheet_02) ('name_only_unique')
  4) Parent-strip on sheet_02 name                    ('parent_strip')
  5) Parent-strip on sheet_01 name → sheet_02 lookup  ('s1_parent_strip')

Unmatched sheet_02 SKs are emitted with match_method='unmatched' and
sheet01_sk=NULL. Downstream aggregation scripts can drop them or bucket as
'Other (unbridged)'.

Output: apps/web/public/data/sheet01_sheet02_bridge.parquet
Columns: sheet02_sk, sheet01_sk, canonical_name, state_code, match_method
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import duckdb
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA = REPO_ROOT / "apps" / "web" / "public" / "data"

S1 = DATA / "sheet_01_institution_funding_panel.parquet"
S2 = DATA / "sheet_02_institution_agency.parquet"
OUT = DATA / "sheet01_sheet02_bridge.parquet"

# Suffixes commonly attached to sheet_02 (or sheet_01) sub-units that should
# resolve to a sheet_01 parent. We strip from the right (so trailing matches
# win). Each entry is matched after normalization, so use lowercase + bare words.
PARENT_SUFFIXES = [
    "medical school",
    "medical center",
    "school medicine",
    "school public health",
    "school nursing",
    "school dentistry",
    "school pharmacy",
    "school veterinary medicine",
    "school law",
    "school engineering",
    "school business",
    "graduate school biomedical sciences",
    "graduate school",
    "health sciences center",
    "health sciences",
    "medical campus",
    "flagship campus",
    "main campus",
    # Penn State + Dartmouth shapes: 'university park hershey medical center'
    "university park hershey medical center",
    "hitchcock medical center",
    "dartmouth hitchcock medical center",
]


def _norm(s: object) -> str:
    """Aggressive normalization for fuzzy comparisons.

    Process order matters:
      1) lowercase
      2) punctuation -> space   (this is what converts 'U.' / 'C.' into bare 'u'/'c')
      3) single-letter expansions for sheet_02's abbreviated style ('Stanford U.', 'Smith C.')
      4) drop stopwords / connectors that vary across sources (of, and, at, the, etc.)
      5) collapse whitespace
    """
    if not isinstance(s, str):
        return ""
    s = s.lower().strip()
    # Strip punctuation EARLY so 'U.' becomes 'u ' and 'Berkeley-' becomes 'berkeley '.
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    # Now expand standalone 'u'/'c' to full words to match sheet_01's spelling.
    s = re.sub(r"\bu\b", "university", s)
    s = re.sub(r"\bc\b", "college", s)
    # Drop stopwords + filler words that frequently vary across naming styles.
    s = re.sub(
        r"\b(the|inc|incorporated|llc|corp|corporation|of|and|a|at|in)\b",
        " ",
        s,
    )
    return re.sub(r"\s+", " ", s).strip()


def _parent_strip(name_norm: str) -> str | None:
    """Strip a known sub-unit suffix; return the parent stem if any was removed.

    Suffixes are already normalized strings, so we match them directly against
    the normalized name. We pick the LONGEST suffix that matches to avoid
    leaving a partial fragment (e.g. 'medical center' would match before
    'university park hershey medical center' otherwise).
    """
    longest_match = None
    longest_len = 0
    for suf in PARENT_SUFFIXES:
        if name_norm == suf or name_norm.endswith(" " + suf):
            if len(suf) > longest_len:
                longest_match = suf
                longest_len = len(suf)
    if longest_match is None:
        return None
    if name_norm == longest_match:
        return None  # whole name was the suffix; not a sub-unit
    stem = name_norm[: -(longest_len + 1)].strip()
    return stem or None


# Curated manual overrides: high-value HERD universities where automatic
# matching is ambiguous (e.g. "U. Michigan" → could be Ann Arbor, Dearborn, or
# Flint — context tells us Ann Arbor) or where the institutional naming has
# diverged enough that neither stem-strip nor name-only matching can resolve
# it. Each entry: (sheet01_sk → sheet02_sk).
MANUAL_OVERRIDES: list[tuple[str, str]] = [
    # Top-50 HERD universities where automatic name-only matching is ambiguous.
    ("INST0000210", "INST0070812"),  # Univ Michigan, Ann Arbor ← U. Michigan
    ("INST0000177", "INST0070874"),  # Univ Pittsburgh, Pittsburgh ← U. Pittsburgh
    ("INST0010345", "INST0070796"),  # Univ Maryland ← U. Maryland, College Park
    ("INST0000005", "INST0070813"),  # Univ Minnesota, Twin Cities ← U. Minnesota
    ("INST0000013", "INST0060910"),  # Northwestern University ← Northwestern U., Evanston
    ("INST0075179", "INST0032028"),  # Icahn School of Medicine at Mount Sinai ← MOUNT SINAI SCHOOL OF MEDICINE
    ("INST0000061", "INST0070730"),  # CINCINNATI UNIV OF ← U. Cincinnati
    ("INST0000225", "INST0065283"),  # Rutgers, New Brunswick ← Rutgers, The State U. New Jersey
    ("INST0000269", "INST0065283"),  # Rutgers, Camden  ← Rutgers, The State U. New Jersey
    ("INST0001489", "INST0070310"),  # Texas A&M College Station ← Texas A&M U., College Station
    ("INST0000015", "INST0000505"),  # Penn State Univ Park+Hershey ← PSU (parent self-bridged)
    ("INST0000248", "INST0070946"),  # UT Southwestern Dallas ← U. Texas Southwestern MC
    ("INST0000182", "INST0003829"),  # Dartmouth + Hitchcock ← Dartmouth College
    ("INST0000425", "INST0067671"),  # SUNY Downstate Health Sciences U.
    ("INST0000112", "INST0074535"),  # Wash Univ in St. Louis ← Washington U., Saint Louis
    ("INST0000051", "INST0070905"),  # USC ← U. Southern California
    # SUNY system shapes (sheet_01 'State University of New York, …' → sheet_02 'State U. New York …')
    ("INST0000927", "INST0068493"),  # The State U. New York, U. at Buffalo ← State U. New York, The, U. at Buffalo
    ("INST0000001", "INST0068490"),  # State U. New York Univ at Albany ← State U. New York, The, Albany
    ("INST0001484", "INST0068494"),  # SUNY Upstate Medical U.
    ("INST0075172", "INST0067661"),  # SUNY Binghamton U.
    # Indiana, Bloomington (canonical sheet_01 SK)
    ("INST0000027", "INST0053355"),  # Indiana University, Bloomington ← Indiana U., Bloomington
]


def _verify_overrides(s1_set: set[str], s2_set: set[str]) -> list[tuple[str, str]]:
    """Drop any override pair where either SK isn't present in its sheet."""
    keep: list[tuple[str, str]] = []
    for s1_sk, s2_sk in MANUAL_OVERRIDES:
        if s1_sk in s1_set and s2_sk in s2_set:
            keep.append((s1_sk, s2_sk))
        else:
            missing = []
            if s1_sk not in s1_set:
                missing.append(f"s1_sk={s1_sk}")
            if s2_sk not in s2_set:
                missing.append(f"s2_sk={s2_sk}")
            print(f"  WARN: override dropped ({', '.join(missing)} missing)")
    return keep


def main() -> None:
    for p in (S1, S2):
        if not p.exists():
            print(f"ERROR: missing {p}", file=sys.stderr)
            sys.exit(1)

    con = duckdb.connect()
    s1 = con.execute(
        f"SELECT DISTINCT institution_sk AS sheet01_sk, canonical_name, state_code "
        f"FROM read_parquet('{S1}')"
    ).fetchdf()
    s2 = con.execute(
        f"SELECT DISTINCT institution_sk AS sheet02_sk, canonical_name, state_code "
        f"FROM read_parquet('{S2}')"
    ).fetchdf()

    def _clean_state(v: object) -> str:
        """Normalize blank/NaN state codes to '' (instead of NaN)."""
        if v is None:
            return ""
        try:
            if pd.isna(v):
                return ""
        except (TypeError, ValueError):
            pass
        s = str(v).strip()
        return s

    s1["norm"] = s1["canonical_name"].apply(_norm)
    s2["norm"] = s2["canonical_name"].apply(_norm)
    s1["state_code"] = s1["state_code"].apply(_clean_state)
    s2["state_code"] = s2["state_code"].apply(_clean_state)

    s1_sk_set = set(s1["sheet01_sk"])
    # Index sheet_01 for fast lookup. We also index parent-stripped variants of
    # each sheet_01 name (e.g. 'Pennsylvania State University ... Hershey
    # Medical Center' → 'pennsylvania state university') so that a plain
    # sheet_02 name like 'PENNSYLVANIA STATE UNIVERSITY, THE' resolves cleanly.
    s1_by_norm_state: dict[tuple[str, str], str] = {}
    s1_by_norm_only: dict[str, list[str]] = {}

    def _index(norm_name: str, state: str, sk: str) -> None:
        if not norm_name:
            return
        key = (norm_name, state)
        # First indexer wins (we already iterate s1 in natural order, so
        # primary SKs land first).
        s1_by_norm_state.setdefault(key, sk)
        s1_by_norm_only.setdefault(norm_name, []).append(sk)

    for _, r in s1.iterrows():
        _index(r["norm"], r["state_code"], r["sheet01_sk"])
        stem = _parent_strip(r["norm"])
        if stem:
            _index(stem, r["state_code"], r["sheet01_sk"])

    # Forward index: norm_name (and state) → sheet_02 SK(s). We use this in the
    # final pass (5) to map sheet_01 sub-units back to their sheet_02 parents.
    s2_by_norm_state: dict[tuple[str, str], list[str]] = {}
    s2_by_norm_only: dict[str, list[str]] = {}
    for _, r in s2.iterrows():
        if r["norm"]:
            s2_by_norm_state.setdefault((r["norm"], r["state_code"]), []).append(r["sheet02_sk"])
            s2_by_norm_only.setdefault(r["norm"], []).append(r["sheet02_sk"])

    rows = []
    bridged_pairs: set[tuple[str, str]] = set()  # (sheet02_sk, sheet01_sk)
    for _, r in s2.iterrows():
        sheet02_sk = r["sheet02_sk"]
        sheet01_sk: str | None = None
        method = "unmatched"
        norm = r["norm"]
        state = r["state_code"]  # already cleaned to '' for null/blank

        # 1) Self-identity: same SK lives in both universes
        if sheet02_sk in s1_sk_set:
            sheet01_sk = sheet02_sk
            method = "self_identity"

        # 2) Exact normalized name + state
        if sheet01_sk is None and norm and state:
            key = (norm, state)
            if key in s1_by_norm_state:
                sheet01_sk = s1_by_norm_state[key]
                method = "exact"

        # 2b) Name-only (when state is blank in sheet_02 — common for abbreviated
        # names like "Stanford U."). Only accept if name resolves to exactly 1
        # sheet_01 SK across all states.
        if sheet01_sk is None and norm and not state:
            candidates = s1_by_norm_only.get(norm, [])
            unique = sorted(set(candidates))
            if len(unique) == 1:
                sheet01_sk = unique[0]
                method = "name_only_unique"

        # 3) Parent strip (e.g. "HARVARD MEDICAL SCHOOL" → "HARVARD")
        if sheet01_sk is None and norm:
            stem = _parent_strip(norm)
            if stem:
                if state:
                    key = (stem, state)
                    if key in s1_by_norm_state:
                        sheet01_sk = s1_by_norm_state[key]
                        method = "parent_strip"
                if sheet01_sk is None:
                    # Name-only unique match (works whether state blank or not)
                    candidates = s1_by_norm_only.get(stem, [])
                    unique = sorted(set(candidates))
                    if len(unique) == 1:
                        sheet01_sk = unique[0]
                        method = "parent_strip"

        rows.append({
            "sheet02_sk": sheet02_sk,
            "sheet01_sk": sheet01_sk,
            "canonical_name": r["canonical_name"],
            "state_code": state or None,
            "match_method": method,
        })
        if sheet01_sk is not None:
            bridged_pairs.add((sheet02_sk, sheet01_sk))

    # Pass 4b: apply curated manual overrides for high-value HERD universities
    # where automatic matching is ambiguous or impossible.
    s2_lookup_by_sk = {r["sheet02_sk"]: r for _, r in s2.iterrows()}
    s2_sk_set = set(s2_lookup_by_sk)
    s1_sk_set_check = set(s1["sheet01_sk"])
    print("\nValidating manual overrides:")
    valid_overrides = _verify_overrides(s1_sk_set_check, s2_sk_set)
    for s1_sk, s2_sk in valid_overrides:
        pair = (s2_sk, s1_sk)
        if pair in bridged_pairs:
            continue
        s2_row = s2_lookup_by_sk.get(s2_sk)
        rows.append({
            "sheet02_sk": s2_sk,
            "sheet01_sk": s1_sk,
            "canonical_name": s2_row["canonical_name"] if s2_row is not None else None,
            "state_code": (s2_row["state_code"] if s2_row is not None else "") or None,
            "match_method": "manual_override",
        })
        bridged_pairs.add(pair)

    # Pass 5: walk every sheet_01 SK not yet covered and try parent-stripping
    # to find a sheet_02 parent. Emits additional (sheet02_sk, sheet01_sk) rows.
    s1_already_bridged = {sk for (_, sk) in bridged_pairs}

    for _, r1 in s1.iterrows():
        s1_sk = r1["sheet01_sk"]
        if s1_sk in s1_already_bridged:
            continue
        s1_norm = r1["norm"]
        s1_state = r1["state_code"]
        if not s1_norm:
            continue
        stem = _parent_strip(s1_norm)
        if not stem:
            continue

        # 5a) stem + state in sheet_02
        candidates: list[str] = []
        if s1_state:
            candidates = s2_by_norm_state.get((stem, s1_state), [])
        # 5b) stem name-only unique
        if not candidates:
            cands = s2_by_norm_only.get(stem, [])
            if len(set(cands)) == 1:
                candidates = cands

        if not candidates:
            continue
        # Use first candidate; emit one extra bridge row pointing the existing
        # sheet_02 SK to this additional sheet_01 sub-unit.
        s2_sk = candidates[0]
        pair = (s2_sk, s1_sk)
        if pair in bridged_pairs:
            continue
        s2_row = s2_lookup_by_sk.get(s2_sk)
        rows.append({
            "sheet02_sk": s2_sk,
            "sheet01_sk": s1_sk,
            "canonical_name": s2_row["canonical_name"] if s2_row is not None else None,
            "state_code": (s2_row["state_code"] if s2_row is not None else "") or None,
            "match_method": "s1_parent_strip",
        })
        bridged_pairs.add(pair)
        s1_already_bridged.add(s1_sk)

    bridge = pd.DataFrame(rows)
    matched = bridge[bridge["sheet01_sk"].notna()]
    print(f"Bridge built: {len(bridge):,} sheet_02 SKs")
    print(f"  matched: {len(matched):,} ({len(matched) / len(bridge) * 100:.1f}%)")
    print(f"  unmatched: {len(bridge) - len(matched):,}")
    print("\nBy match_method:")
    print(bridge["match_method"].value_counts().to_string())

    # Coverage of sheet_01 universe (how many of the 1,014 HERD universities
    # now have at least one bridged sheet_02 row?).
    s1_total = len(s1)
    s1_covered = matched["sheet01_sk"].nunique()
    print(
        f"\nsheet_01 coverage: {s1_covered:,}/{s1_total:,} universities have "
        f"≥1 bridged sheet_02 SK ({s1_covered / s1_total * 100:.1f}%)"
    )

    bridge.to_parquet(OUT, compression="zstd")
    size_mb = OUT.stat().st_size / 1024 / 1024
    print(f"\nWrote {OUT.name}: {len(bridge):,} rows, {size_mb:.2f} MB")


if __name__ == "__main__":
    main()
