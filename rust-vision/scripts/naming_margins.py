#!/usr/bin/env python3
"""Naming health: how far each verified card sits from the runner-up, and whether the
gallery framing still fits. Reads `out/debug/<stem>/rust_cards.json`: run the bench first.

    python scripts/naming_margins.py          # fails under the floors
    python scripts/naming_margins.py --sweep  # refits the framing, a few minutes
"""

import argparse
import collections
import glob
import json
import os
import statistics
import sys
from pathlib import Path

import numpy as np
from PIL import Image

# Measured after the framing fix: see the `naming-margins` skill. Raise them, never lower.
FLOOR_MIN_MARGIN = 0.10
FLOOR_MEAN_MARGIN = 0.41
CEILING_UNDER_020 = 24

# Mirrors src/mosaic.rs (Triangle resize approximated by PIL's BILINEAR).
WIDTH = 24
ROWS = int(WIDTH * 0.568)
BASE_TOP, BASE_BOTTOM = 0.198, 0.766  # framing at scale 1, the sweep's reference
CURRENT = (0.97, 0.01, 0.02)  # scale, x, y of the shipped VISIBLE_* constants
PORTRAITS = "../static-assets/static/champions"
SCALES = [0.93, 0.94, 0.95, 0.96, 0.97, 0.98, 1.0]


def embed(pixels):
    height, width = pixels.shape[:2]
    cell = width / WIDTH
    rows = min(int(height / cell), ROWS)
    kept = min(round(rows * cell), height)
    bottom = Image.fromarray(pixels[height - kept :]).resize(
        (WIDTH, rows), Image.BILINEAR
    )
    values = np.asarray(bottom, dtype=np.float32)
    inner = (
        values[max(1 + rows - ROWS, 0) : rows - 1, 1 : WIDTH - 1].reshape(-1, 3).copy()
    )
    inner -= inner.sum(0) / (len(inner) + 1e-6)
    inner /= np.sqrt((inner**2).sum(0) / (len(inner) + 1e-6)) + 1e-6
    inner = inner.reshape(-1)
    return inner / (np.sqrt((inner**2).sum()) + 1e-6)


def compare(left, right):
    common = min(len(left), len(right))
    return float(left[len(left) - common :] @ right[len(right) - common :])


def load_cards():
    """Every card of a verified shot: (stem, box, margin, GT name)."""
    cards = []
    for gt_path in sorted(glob.glob("artifacts-vision/data/real/*.gt.json")):
        gt = json.loads(Path(gt_path).read_text(encoding="utf-8"))
        stem = os.path.basename(gt_path).removesuffix(".gt.json")
        report = f"out/debug/{stem}/rust_cards.json"
        if not gt.get("_verified"):
            continue
        if not os.path.exists(report):
            sys.exit(f"{report} is missing: run the bench without --no-save")
        cells = {
            card["cell"]: card
            for card in json.loads(Path(report).read_text(encoding="utf-8"))
        }
        for cell, truth in gt["cells"].items():
            if cell in cells:
                card = cells[cell]
                cards.append((stem, card["portrait"], card["margin"], truth["name"]))
    return cards


def check(cards):
    by_name = collections.defaultdict(list)
    for _, _, margin, name in cards:
        by_name[name].append(margin)
    margins = [m for _, _, m, _ in cards]
    lowest, mean = min(margins), statistics.mean(margins)
    under = sum(m < 0.20 for m in margins)
    print(f"{len(margins)} cards: min {lowest:.4f} mean {mean:.4f} under 0.20: {under}")
    for name, values in sorted(by_name.items(), key=lambda kv: min(kv[1]))[:8]:
        print(f"  {min(values):.4f} {name} (n={len(values)})")
    failures = [
        f"min margin {lowest:.4f} < {FLOOR_MIN_MARGIN}"
        if lowest < FLOOR_MIN_MARGIN
        else "",
        f"mean margin {mean:.4f} < {FLOOR_MEAN_MARGIN}"
        if mean < FLOOR_MEAN_MARGIN
        else "",
        f"{under} cards under 0.20 > {CEILING_UNDER_020}"
        if under > CEILING_UNDER_020
        else "",
    ]
    failures = [failure for failure in failures if failure]
    print("FAIL: " + "; ".join(failures) if failures else "PASS")
    return not failures


def sweep(cards):
    background = Image.open("src/fixtures/card_bg.png").convert("RGBA")
    stems = {
        c["name"]: os.path.splitext(os.path.basename(c["image_url"]))[0]
        for c in json.loads(
            Path("src/fixtures/champions.json").read_text(encoding="utf-8")
        )
        if c.get("image_url")
    }
    by_name = collections.defaultdict(list)
    for card in cards:
        by_name[card[3]].append(card)
    champions = []
    for name, own in by_name.items():
        path = f"{PORTRAITS}/{stems.get(name, name)}.png"
        if not os.path.exists(path):
            continue
        portrait = Image.open(path).convert("RGBA")
        file_size = portrait.size
        portrait = portrait.resize((256, round(portrait.height * 256 / portrait.width)))
        queries = []
        for stem, box, _, _ in sorted(own, key=lambda c: c[2])[:2]:
            shot = glob.glob(f"artifacts-vision/data/real/{stem}.png") + glob.glob(
                f"artifacts-vision/data/real/{stem}.jpg"
            )
            left, top, right, bottom = box
            crop = (
                Image.open(shot[0])
                .convert("RGB")
                .crop(
                    (
                        int(left),
                        int(top),
                        int(left) + int(right - left),
                        int(top) + int(bottom - top),
                    )
                )
            )
            queries.append(embed(np.asarray(crop)))
        champions.append((name, file_size, portrait, queries))

    def score(portrait, queries, x, y, side):
        window = portrait.crop(
            (
                round(x),
                round(y + BASE_TOP * side),
                round(x + side),
                round(y + BASE_BOTTOM * side),
            )
        )
        band = background.resize(window.size, Image.BILINEAR)
        band.alpha_composite(window)
        embedded = embed(np.asarray(band.convert("RGB")))
        return float(np.mean([compare(query, embedded) for query in queries]))

    square = [c for c in champions if c[1][0] == c[1][1]]
    fits = []
    for scale in SCALES:
        for x in np.arange(0, 1 - scale + 1e-6, 0.01):
            for y in np.arange(0, 0.06, 0.01):
                if y + BASE_BOTTOM * scale > 1:
                    continue
                values = [
                    score(p, q, x * 256, y * 256, scale * 256) for _, _, p, q in square
                ]
                fits.append((float(np.mean(values)), scale, float(x), float(y)))
    fits.sort(reverse=True)
    scale, x, y = CURRENT
    shipped = np.mean(
        [score(p, q, x * 256, y * 256, scale * 256) for _, _, p, q in square]
    )
    print(f"{len(square)} square portraits: shipped {CURRENT} scores {shipped:.4f}")
    for mean, scale, x, y in fits[:5]:
        print(f"  mean {mean:.4f} scale={scale:.2f} x={x:.2f} y={y:.2f}")
    print("non-square files, at the shipped framing:")
    for name, file_size, portrait, queries in champions:
        if file_size[0] == file_size[1]:
            continue
        slack = portrait.width - portrait.height
        side = min(portrait.size)
        places = {"left": 0, "center": slack / 2, "right": slack}
        found = {
            label: score(portrait, queries, at + x * side, y * side, scale * side)
            for label, at in places.items()
        }
        found["bottom-left"] = score(
            portrait, queries, x * 256, -slack + y * 256, scale * 256
        )
        print(f"  {name} {file_size}", {k: round(v, 3) for k, v in found.items()})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--sweep", action="store_true", help="refit the gallery framing"
    )
    args = parser.parse_args()
    cards = load_cards()
    if args.sweep:
        sweep(cards)
    elif not check(cards):
        sys.exit(1)


if __name__ == "__main__":
    main()
