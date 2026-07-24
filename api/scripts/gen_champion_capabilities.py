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


def main(sql_path: str) -> None:
    data = Path(sql_path).read_text(errors="replace")
    m = re.search(r"CREATE TABLE `champion` \(([^;]*?)\n\) ENGINE", data, re.DOTALL)
    cols = re.findall(r"^\s*`([a-z_0-9]+)`", m.group(1), re.MULTILINE)
    ins = re.search(r"INSERT INTO `champion`(?:\s*\([^)]*\))?\s+VALUES\s+", data)
    seg = data[ins.end() :]
    seg = seg[: seg.index(";\n")]
    caps = {}
    for row in _split_rows(seg):
        rec = dict(zip(cols, row))
        flags = {f: rec.get(f, "0") == "1" for f in FLAGS}
        if any(flags.values()):
            caps[_unquote(rec["name"])] = flags
    OUT.write_text(
        json.dumps(caps, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(f"Wrote {len(caps)} champions with capabilities -> {OUT}")


if __name__ == "__main__":
    main(sys.argv[1])
