---
name: naming-margins
description: >-
  Audit how safely the Rust pipeline names champions: per-card margins, floors, and a
  refit of the gallery framing. Use after changing the detector, the mosaic, the gallery
  or a portrait, when a champion is read as a lookalike, when a card looks zoomed against
  its gallery band, or when asked whether naming is still healthy.
---

# Naming margins

The GT only says right or wrong. A card can pass at a 0.01 margin and flip on the next
detector: the margin is what shows it coming.

## Commands (from `mcoc-vision/`)

| Step | Command |
| --- | --- |
| Refresh `rust_cards.json` | `cargo run --release --bin mcoc-vision` (not `--no-save`) |
| Check the floors | `uv run python scripts/naming_margins.py` |
| Refit the framing | `uv run python scripts/naming_margins.py --sweep` |
| After changing the framing | `cargo run --release --bin build_gallery`, then the two first steps |

The script reads `rust_cards.json`, so a stale one grades the previous run.

## Reading a failure

- **One champion is low on every shot**: its file. Look at it in `--sweep`'s non-square
  list, then `gallery::OFFSET_ART`.
- **Everyone drops**: the framing moved. `--sweep` says where the best fit went.
- **Never patch a single champion before running the sweep**: a low champion can be the
  visible end of a defect shared by all of them.

## Measured baseline (2026-11-05, 97 verified shots, 1791 cards, detector `best_o2m`, imgsz 800)

| Gallery | GT | Mean | Min | Under 0.05 | Under 0.10 | Under 0.20 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Original framing, new detector | 1790/1791 | – | 0.013 | ≥ 7 | – | – |
| + Bullseye recut alone | 1791/1791 | 0.391 | 0.066 | 0 | 6 | 46 |
| Shared framing, no Bullseye entry | 1790/1791 | 0.414 | 0.006 | 7 | 7 | 31 |
| **Shared framing + `OFFSET_ART` (shipped)** | **1791/1791** | **0.414** | **0.101** | **0** | **0** | **24** |

Shared framing: 97 % of the width, offset 1 % in x and 2 % in y. 254 of 264 champions
preferred the same scale. Sweep score on 261 square portraits: 0.907 at full width, 0.937
shipped. Bullseye sits at 0.20–0.26 (hand fit `(42, 8, 512)`: 0.29–0.31): its 560x534 file
holds the art on the right, White Tiger's same-sized file on the bottom-left, and nothing
in the size tells them apart. Lowest cards: Yondu 0.101, Magik 0.107, Sentry 0.114.

The framing was fitted on these same shots, and 73 of the 337 champions appear in none.
