N ?= 2000
VAL ?= 200
WORKERS ?= 8
SEED ?= 99
EPOCHS ?= 100
DEVICE ?= 0
MODEL ?= yolo26n.pt
ND ?= 8000
VALND ?= 800
PARTS_LANG ?= fr
SHOTS ?=
IMG ?= artifacts-vision/data/real/shot_0001.png
# The training code lives in the private repo and runs from its root, on this crate's uv project.
TRAIN = uv run --directory artifacts-vision python
COPIES ?= 1
RUFF ?= uvx ruff@0.16.0  # keep in step with .pre-commit-config.yaml

.PHONY: help setup install install-train pdn-layers parts synth synth-train synth-val train \
        synth-digits train-digits export-onnx worker publish-job timeline lint check fix format clean

help:
	@echo "setup         --> uv sync + pre-commit hooks"
	@echo "install       --> uv sync (torch/vision wheels auto-selected: CUDA on Windows, CPU on Linux)"
	@echo "install-train --> install + train dependency group"
	@echo "pdn-layers    --> export templates/parts/sample.pdn's layers to templates/parts/base/"
	@echo "parts         --> cut card parts out of deck screenshots (PARTS_LANG=$(PARTS_LANG) SHOTS=...), then review artifacts-vision/out/parts_review/"
	@echo "synth         --> generate train ($(N)) + val ($(VAL)) detector datasets (WORKERS=$(WORKERS))"
	@echo "synth-train   --> generate only the train split (N=$(N))"
	@echo "synth-val     --> generate only the val split (VAL=$(VAL), SEED=$(SEED))"
	@echo "train         --> train the detector into out/runs, a GPU step (EPOCHS=$(EPOCHS) DEVICE=$(DEVICE) MODEL=$(MODEL))"
	@echo "synth-digits  --> generate train ($(ND)) + val ($(VALND)) rank/sig band datasets"
	@echo "train-digits  --> train the 11-class rank/sig digit reader (DEVICE=$(DEVICE))"
	@echo "export-onnx   --> export the trained detector + digit reader beside their .pt in out/runs"
	@echo "worker        --> run the Rust worker in release, logging to out/worker.log"
	@echo "publish-job   --> upload a screenshot to RustFS and queue its job (IMG=$(IMG) COPIES=$(COPIES))"
	@echo "timeline      --> chart the jobs per worker stage from out/worker.log into out/job_timeline.png"
	@echo "lint          --> ruff check + format check, as CI runs them"
	@echo "check / fix / format --> ruff"
	@echo "clean         --> remove generated datasets + out/ (artifacts/ is never touched)"

setup: install
	uvx pre-commit install

install:
	uv sync

install-train:
	uv sync --group train

pdn-layers:
	$(TRAIN) scripts/export_pdn_layers.py

parts:
	$(TRAIN) scripts/extract_parts.py $(PARTS_LANG) $(SHOTS)

synth: synth-train synth-val

synth-train:
	$(TRAIN) -m yolo.synth.gen_roster_screenshots --n $(N) --split train --workers $(WORKERS)

synth-val:
	$(TRAIN) -m yolo.synth.gen_roster_screenshots --n $(VAL) --split val --seed $(SEED) --workers $(WORKERS)

train:
	$(TRAIN) -m yolo.detector.train_card_detector --epochs $(EPOCHS) --device $(DEVICE) --model $(MODEL)

synth-digits:
	$(TRAIN) -m yolo.synth.gen_digit_bands --n $(ND) --split train
	$(TRAIN) -m yolo.synth.gen_digit_bands --n $(VALND) --split val --seed $(SEED)

train-digits:
	$(TRAIN) -m yolo.digits.train_digit_reader --epochs $(EPOCHS) --device $(DEVICE)

export-onnx:
	$(TRAIN) scripts/export_detector_onnx.py
	$(TRAIN) scripts/export_digits_onnx.py

worker:
	cargo run --release --bin worker --features worker 2>&1 | uv run python scripts/tee_log.py out/worker.log

publish-job:
	uv run scripts/publish_job.py $(IMG) $(COPIES)

timeline:
	uv run python scripts/job_timeline.py

lint:
	$(RUFF) check .
	$(RUFF) format --check .

check:
	$(RUFF) check

fix:
	$(RUFF) check --fix

format:
	$(RUFF) format

clean:
	rm -rf artifacts-vision/data/synth artifacts-vision/data/synth_digits artifacts-vision/out out
