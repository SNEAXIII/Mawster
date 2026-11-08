# mcoc-vision

Private, standalone repo (Mawster submodule at `Mawster/mcoc-vision`). Extracts
champion data from an MCOC roster screenshot: **name** (image recognition),
**rank**, **signature**, **stars**, **ascension** (OCR + CV). PI is ignored.

## Design

Two problems, two techniques — do **not** train YOLO to classify champions
(the roster grows every month → endless retraining).

```
screenshot
  └─ YOLO detector (card + starrow + textstrip, any size)   src/detect
        ├─ portrait  → CLIP embedding → kNN gallery → NAME          src/naming
        ├─ textstrip → band → YOLO digits (batched) → RANK, SIG     src/ocr
        ├─ starrow   → StarNet (CNN) → STARS(1-7) + AWAKENED        src/classify
        └─ corner    → AscNet (CNN) → ASCENSION 0 / 1 / 2           src/classify
```

- **Naming = embedding + gallery**, not classification. New champion = drop a
  portrait in Mawster's `static-assets` + rebuild gallery. Zero retraining.
- **Synthetic data is fully dynamic**: canvas resolution, grid shape, card size,
  spacing, per-card jitter and scroll-cut are all randomised, so the detector
  generalises across devices/zoom. Card chrome is composited from **real assets**
  (Mawster portraits, arena background sampled from a real screenshot outside the
  card zone, Michroma font ≈ MCOC's Eurostile) → bounding boxes + field labels
  are free.

## Assets (read from the Mawster repo)

- `src/fixtures/champions.json` — champions (name + class + url)
- `Mawster/static-assets/static/champions/<slug>.png` — full-size portraits
- `data/real/shot_0001.png` — reference screenshot (background source, geometry)

Override the Mawster location with `MAWSTER_REPO=/path/to/Mawster` if needed.

## Runbook (make + uv)

Prod is **CPU-only**. A GPU is used for training only. The pipeline loads every
model from `artifacts/` (tracked); `out/` is scratch and can be deleted at will.

```bash
make setup                    # uv sync + pre-commit hooks + CLIP ONNX export (once)
make run IMG=shot.png DEBUG=1 # screenshot -> JSON, annotated PNGs in out/debug
make gate                     # every verified ground truth at 100% — what CI enforces

# retrain a model (GPU box), then ship it
make synth && make train              # detector      -> out/runs/card_detector
make crops && make train-classify     # AscNet        -> out/runs/asc_classifier
make synth-digits && make train-digits  # digit reader -> out/runs/digit_reader
make export-onnx && make promote      # ONNX exports, then copy into artifacts/
make gate && git add artifacts/

make gallery                  # after new portraits in Mawster or an embed.py change
```

Inference is hard-wired to CPU. Override with `MCOC_DEVICE=cuda` only on a dev box.

## Status

| Stage | File | State |
|---|---|---|
| Synthetic assets (portraits/bg/font) | `src/yolo/synth/mawster_assets.py` | ✅ done |
| Card renderer (4 fields + region boxes) | `src/yolo/synth/template_card.py` | ✅ done |
| Screenshot compositor + YOLO labels | `src/yolo/synth/gen_roster_screenshots.py` | ✅ done |
| Photometric augmentation | `src/yolo/synth/photometric_augment.py` | ✅ done |
| YOLO train (+data.yaml) | `src/yolo/detector/train_card_detector.py` | ✅ code ready (needs ultralytics) |
| YOLO infer + region grouping | `src/detect/infer.py` | ✅ code ready |
| Naming (CLIP + kNN gallery) | `src/naming/embed.py` | ✅ code ready (needs open-clip) |
| Rank/sig (batched digit reader) | `src/ocr/digits.py` | ✅ done — 214/214 on both fields |
| Stars count (CV) | `src/ocr/read.py` | ✅ done — 40/40 exact on synth |
| Orchestrator → typed JSON | `src/pipeline.py` | ✅ done |

Light stack (synth + CV star count + regex + schema) is smoke-tested and green.
The heavy models (YOLO detector / CLIP / digit reader) are wired and trained;
prod loads all of them as ONNX, torch-free.

## Next

- Grab ~30 real screenshots; hand-check detector recall + CLIP naming on real crops.
- Improve card fidelity if the sim→real gap hurts recall (rank-badge mini-portrait
  + gold pips, ornate frame). Add more real background screenshots to `data/real/`.
```
