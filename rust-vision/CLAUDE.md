# CLAUDE.md — vision

MCOC roster screenshot → champion data (name, stars, rank, sig, ascension). Rust crate inside
Mawster, public. The Mawster vision worker image is built from it.

**Private submodule `artifacts-vision/`**: models (`artifacts/`), the verified screenshots and
their GT (`data/real/`), and the Python that makes synthetic data and trains the two YOLO
models. Nothing from it is ever committed here — no screenshot, GT, `.onnx` or `.pt`.

## Pipeline (`src/pipeline.rs`)
YOLO detector (cards, star rows, text strips) → per card:
- **name**: `mosaic.rs`, no model — the portrait shrunk onto a grid, brightness and contrast
  stripped, dot product against `gallery.bin`, built from Mawster's portraits by `build_gallery`
- **rank / sig**: 11-class YOLO digit reader (`digits.rs`), every band of a shot in one batch
- **ascension**: `asc.rs`, no model — the badge's gold, then the glyph's width
- **stars**: counted from the star row

`pipeline/matrix.rs` places each card in its grid cell (`r{row}c{col}`), the key the GT uses.

## Commands (run from this directory: every path is relative to it)
- `cargo run --release -- [shots]` — run, score against the GT, write `out/debug/<stem>/`
  (`4,12 1000-1010`; none = every shot). `--bootstrap` drafts a GT, `--validate` marks it verified
- `cargo run --release --bin build_gallery` — rebuild `artifacts/gallery/mosaic.bin`, required
  after any change to the mosaic or to a portrait
- `cargo run --release --bin mosaic_bench` — naming recall over the last run's reports
- `python scripts/naming_margins.py` — naming margins and floors (skill `naming-margins`)
- `make worker` · `make publish-job IMG=…` · `make timeline` — the RabbitMQ worker, locally
- Training (GPU, `make install-train`): `make synth && make train`, `make synth-digits &&
  make train-digits`, then `make export-onnx`. Runs in `artifacts-vision/` via `$(TRAIN)`.
  A model does nothing until its `.onnx` replaces the one in `artifacts-vision/artifacts/`.

## Worker (`src/bin/worker/`, feature `worker`)
Fetchers pull `vision.jobs` and the screenshot from RustFS → one inference thread → the
publisher stores the JSON, confirms the result message, then acks (`flow.md`). Config comes
from the environment, or from `/run/secrets` in Swarm: the image is `FROM scratch`, no shell.

## Gotchas
- **Two errors that agree score as a pass.** A GT bootstrapped from a run agrees with that
  run's mistakes: check every cell against the card (skill `ground-truth`) before `--validate`.
- **Ultralytics' `fliplr=0.5` and `mosaic=1.0` are wrong for digits** — a mirrored 2 is not
  a 2. Both are 0.0 in `artifacts-vision/yolo/digits/train_digit_reader.py`.
- **Never `TaskStop` a training run**: it kills the shell, not the dataloader workers, which
  then hold the RAM. Kill the processes whose command line matches `train_`, and their children.
- The Dockerfile's patterns and `.dockerignore` are anchored at this directory: a private path
  is always spelled `artifacts-vision/...`.

## Conventions
English; conventional commits, typed by what a Mawster player sees (see Mawster's CLAUDE.md).
No unit tests while the port is still moving: the safety net is the GT run and `mosaic_bench`.
