"""One-off: extract champion capability flags from a prod SQL dump into a side file.

Usage:
    python scripts/gen_champion_capabilities.py <path-to-uncompressed-prod.sql>

Writes src/fixtures/champions_capabilities.json = {name: {flag: bool, ...}, ...},
including only champions that have at least one True flag. champions.json is NOT touched.
Champion capability data is public game data (no PII).
"""

import json
import re
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "src" / "fixtures" / "champions_capabilities.json"
FLAGS = ("is_ascendable", "has_prefight", "is_saga_attacker", "is_saga_defender")

# The repo root (api/scripts/gen_champion_capabilities.py -> Mawster/). Dumps are
# read from `backups/`, so nothing outside the repo needs to be reachable here.
ALLOWED_ROOT = Path(__file__).resolve().parents[2]


def _split_rows(seg: str):
    rows, i, n = [], 0, len(seg)
    while i < n:
        if seg[i] == "(":
            depth, i, fields, cur, instr, esc = 1, i + 1, [], "", False, False
            while i < n and depth > 0:
                ch = seg[i]
                if esc:
                    cur += ch
                    esc = False
                    i += 1
                    continue
                if instr:
                    if ch == "\\":
                        cur += ch
                        esc = True
                    elif ch == "'":
                        instr = False
                        cur += ch
                    else:
                        cur += ch
                    i += 1
                    continue
                if ch == "'":
                    instr = True
                    cur += ch
                    i += 1
                    continue
                if ch == "(":
                    depth += 1
                    cur += ch
                    i += 1
                    continue
                if ch == ")":
                    depth -= 1
                    if depth == 0:
                        fields.append(cur.strip())
                        i += 1
                        break
                    cur += ch
                    i += 1
                    continue
                if ch == "," and depth == 1:
                    fields.append(cur.strip())
                    cur = ""
                    i += 1
                    continue
                cur += ch
                i += 1
            rows.append(fields)
        else:
            i += 1
    return rows


def _unquote(s: str) -> str:
    if not (s.startswith("'") and s.endswith("'")):
        return s
    # Reverse SQL backslash-escaping (e.g. 'M\'Baku' -> M'Baku) in a single pass
    # so that `\\` and `\'` sequences aren't double-processed.
    return re.sub(r"\\(.)", lambda m: m.group(1), s[1:-1])


def _sql_path_from_argv(raw: str) -> Path:
    """Resolve and validate the CLI path before any filesystem access.

    Same discipline as `src/fixtures/paths.py`, with a wider root: dumps live in
    `backups/` at the repo root, not under `api/`. The path is resolved
    (symlinks and `..` chains included) and must land inside the repo, be a
    regular file, and carry a `.sql` suffix — so a faulty argument exits
    non-zero instead of reading whatever it happens to point at.
    """
    resolved = Path(raw).expanduser().resolve()

    if not resolved.is_relative_to(ALLOWED_ROOT):
        msg = f"❌ Refusing to read {resolved}: outside {ALLOWED_ROOT}"
        raise SystemExit(msg)
    if not resolved.is_file():
        msg = f"❌ No such SQL dump: {resolved}"
        raise SystemExit(msg)
    if resolved.suffix.lower() != ".sql":
        msg = f"❌ Expected an uncompressed .sql dump, got: {resolved.name}"
        raise SystemExit(msg)

    return resolved


def main(sql_path: str) -> None:
    data = _sql_path_from_argv(sql_path).read_text(errors="replace")
    m = re.search(r"CREATE TABLE `champion` \(([^;]*?)\n\) ENGINE", data, re.DOTALL)
    cols = re.findall(r"^\s*`([a-z_0-9]+)`", m.group(1), re.MULTILINE)
    ins = re.search(r"INSERT INTO `champion`(?:\s*\([^)]*\))?\s+VALUES\s+", data)
    seg = data[ins.end() :]
    seg = seg[: seg.index(";\n")]
    caps = {}
    for row in _split_rows(seg):
        rec = dict(zip(cols, row, strict=False))
        flags = {f: rec.get(f, "0") == "1" for f in FLAGS}
        if any(flags.values()):
            caps[_unquote(rec["name"])] = flags
    OUT.write_text(
        json.dumps(caps, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(f"Wrote {len(caps)} champions with capabilities -> {OUT}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        msg = f"Usage: python {Path(sys.argv[0]).name} <path-to-uncompressed-prod.sql>"
        raise SystemExit(msg)
    main(sys.argv[1])
