---
name: ground-truth
description: >-
  Create, verify and evaluate a ground truth (GT) for the mcoc-vision Rust
  pipeline. Use whenever the user mentions GT, .gt.json, bootstrap/validate,
  adding a screenshot to the eval set, "check shot_1080", "does it still pass",
  or which field the pipeline reads wrong.
---

# Ground truth

`data/real/shot_<n>.png` + `data/real/shot_<n>.gt.json`. The bench picks shots by
`<n>`, so name new screenshots `shot_<n>`.

```json
{ "_verified": true,
  "cells": { "r0c0": { "name": "Black Panther (Civil War)", "stars": 7, "rank": 5, "sig": 200, "ascension": 2 } } }
```

- `r{row}c{col}`: rows top to bottom, left to right, after the pipeline's filters.
- Five fields, strict equality (name case included). `null` matches only a card read as nothing.
- Unverified GTs are skipped, never scored.

**The rule:** a draft carries the run's mistakes, and the next run repeats them —
two errors that agree score as a pass. Nothing is `_verified` until a human checked
every cell **against the card**, champion variant included.

## Commands (from `mcoc-vision/`)

`cargo run --release --bin mcoc-vision -- [SHOTS] [-o OVERLAYS | -a] [-b BOXES] [--no-save] [--bootstrap | --validate]`
— shots `1080`, `1000-1010`, `4,12` (default: every shot); `-o` overlays `yolo,dots,ratio,boxes,digits,matrix,dims` (default `yolo`), `-a` all but `yolo`; `-b` filters `boxes`/`dims` to `card,stars,text,asc,rank-sig,champion`; output goes to `out/debug/<stem>/` unless `--no-save`.

**Always pass explicit shots to `--bootstrap` / `--validate`**: without them they hit
every GT (overwrite all corrections / sign every draft). `git diff data/real` after.

| Step | Command |
| --- | --- |
| Draft (overwrites the GT) | `-- <n> -o matrix --bootstrap` |
| Check | `-- <n> -o matrix` → `out/debug/shot_<n>/shot_<n>.png`: each card beside the gallery portrait its name came from; green = matches GT, red = GT value of wrong fields, grey = no cell |
| Fix | edit the JSON; keep the **card's** value even when the pipeline disagrees. Exact names: `python -c "import json;print('\n'.join(sorted(c['name'] for c in json.load(open('src/fixtures/champions.json')))))"` |
| Sign | `-- <n> --validate` (flips `_verified`, runs nothing) |
| Score | `-- --no-save` → per-field accuracy, EXTRA / MISSING / WRONG / SKIPPED, non-zero exit on any deviation |

Comparing two versions: score both against the same GTs, verified before either number existed.
