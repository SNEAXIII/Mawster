"""
Scrape MCOC wiki for champion data and portrait images.
Outputs a JSON file and downloads portrait images into a folder.

Interactive mode:
    1. Download images and data from the wiki
    2. Resize all images to a custom size (e.g. 40x40)

Usage:
    cd api
    python scripts/scrape_champions.py

Requires: curl_cffi, beautifulsoup4, lxml, Pillow (for resize)
    pip install curl_cffi beautifulsoup4 lxml Pillow
"""

import json
import os
import re
import sys
import time
from pathlib import Path

# Add parent dir to sys.path so we can import src.enums
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src.enums.ChampionClass import ChampionClass  # noqa: E402

WIKI_URL = "https://marvel-contestofchampions.fandom.com/wiki/List_of_Champions"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "static" / "champions"
JSON_OUTPUT = Path(__file__).resolve().parent.parent / "scripts" / "champions.json"

VALID_CLASSES = {c.value for c in ChampionClass}


def clean_image_url(url: str) -> str:
    """Strip Fandom's thumbnail suffixes to get the original full-size image."""
    if "/revision/latest" in url:
        return url.split("/revision/latest")[0] + "/revision/latest"
    return url


def sanitize_filename(name: str) -> str:
    """Create a safe, lowercase filename from a champion name."""
    safe = re.sub(r"[^a-zA-Z0-9_\-]", "_", name.lower())
    safe = re.sub(r"_+", "_", safe).strip("_")
    return safe


def download_image(url: str, filepath: Path) -> bool:
    """Download an image. Returns True on success."""
    from curl_cffi import requests as cffi_requests

    if filepath.exists():
        return True
    try:
        resp = cffi_requests.get(url, impersonate="chrome", timeout=30)
        resp.raise_for_status()
        filepath.write_bytes(resp.content)
        return True
    except Exception as e:
        print(f"  [WARN] Failed to download {url}: {e}")
        return False


def scrape_champions() -> list[dict]:
    """Scrape the wiki and return a list of champion dicts."""
    from curl_cffi import requests as cffi_requests
    from bs4 import BeautifulSoup

    print(f"Fetching {WIKI_URL} ...")
    resp = cffi_requests.get(WIKI_URL, impersonate="chrome", timeout=60)
    resp.raise_for_status()
    print(f"  [DEBUG] Response status: {resp.status_code}, length: {len(resp.text)}")

    soup = BeautifulSoup(resp.text, "lxml")

    champions = []
    seen_names = set()

    # --- Try multiple strategies to find the champions table ---
    # Strategy 1: table with class "sortable"
    tables = soup.find_all("table", class_="sortable")
    print(f"  [DEBUG] Tables with class='sortable': {len(tables)}")

    # Strategy 2: tables inside #mw-content-text
    if not tables:
        content_div = soup.find("div", id="mw-content-text")
        if content_div:
            parser_output = content_div.find("div", class_="mw-parser-output")
            if parser_output:
                tables = parser_output.find_all("table", recursive=False)
                print(f"  [DEBUG] Tables in mw-parser-output: {len(tables)}")
            else:
                tables = content_div.find_all("table")
                print(f"  [DEBUG] Tables in mw-content-text: {len(tables)}")
        else:
            tables = soup.find_all("table")
            print(f"  [DEBUG] All tables in page: {len(tables)}")

    # Strategy 3: any table with class containing "wiki"
    if not tables:
        tables = soup.find_all("table", class_=re.compile(r"wiki|article|fandom", re.I))
        print(f"  [DEBUG] Tables with wiki/article/fandom class: {len(tables)}")

    if not tables:
        print("  [ERROR] No tables found at all!")
        print(f"  [DEBUG] Page start:\n{resp.text[:2000]}")
        return champions

    for table_idx, table in enumerate(tables):
        table_classes = table.get("class", [])
        print(f"\n  [DEBUG] Processing table {table_idx} (classes={table_classes})")

        rows = table.find_all("tr")
        print(f"  [DEBUG] Rows in table: {len(rows)}")

        if rows:
            header_cells = rows[0].find_all(["th", "td"])
            header_texts = [c.get_text(strip=True)[:30] for c in header_cells]
            print(f"  [DEBUG] Header cells ({len(header_cells)}): {header_texts}")

        for row_idx, row in enumerate(rows):
            cells = row.find_all("td")
            if len(cells) < 5:
                continue

            # Cell 0: portrait image
            # Cell 1: featured image
            # Cell 2: champion name (link)
            # Cell 3: release date
            # Cell 4: class

            name_cell = cells[2]
            name_link = name_cell.find("a")
            if name_link:
                name = name_link.get("title", "").strip()
                if not name:
                    name = name_link.get_text(strip=True)
            else:
                name = name_cell.get_text(strip=True)

            if not name or name in seen_names:
                continue

            if len(champions) < 3:
                print(f"  [DEBUG] Row {row_idx}: name='{name}', cells={len(cells)}")
                for ci, c in enumerate(cells):
                    print(f"    cell[{ci}] text='{c.get_text(strip=True)[:50]}'")

            class_cell = cells[4]
            class_text = class_cell.get_text(separator=" ", strip=True)

            class_link = class_cell.find("a")
            if class_link:
                class_title = class_link.get("title", "")
                if class_title in VALID_CLASSES:
                    class_text = class_title

            class_matches = [c for c in VALID_CLASSES if c in class_text]
            if len(class_matches) != 1:
                print(
                    f"  [SKIP] {name}: {'multiple classes' if len(class_matches) > 1 else 'no valid class'} ({class_text})"
                )
                continue

            champion_class = class_matches[0]

            date_cell = cells[3]
            release_date = date_cell.get_text(strip=True)

            portrait_cell = cells[0]
            portrait_img = portrait_cell.find("img")
            portrait_url = None
            if portrait_img:
                portrait_url = portrait_img.get("data-src") or portrait_img.get("src")
                if portrait_url:
                    portrait_url = clean_image_url(portrait_url)

            if not portrait_url or "File:" in portrait_cell.get_text():
                print(f"  [SKIP] {name}: no valid portrait image")
                continue

            seen_names.add(name)
            champions.append(
                {
                    "name": name,
                    "champion_class": champion_class,
                    "release_date": release_date,
                    "portrait_url": portrait_url,
                }
            )

    print(f"\n  [DEBUG] Total champions collected: {len(champions)}")
    return champions


def action_download():
    """Download champion images and data from the wiki."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    champions = scrape_champions()
    print(f"\nFound {len(champions)} champions with single class and valid image.\n")

    final_data = []
    for i, champ in enumerate(champions, 1):
        base_name = sanitize_filename(champ["name"])
        filename = base_name + ".png"
        filepath = OUTPUT_DIR / filename

        print(f"  [{i}/{len(champions)}] {champ['name']} ({champ['champion_class']})")

        success = download_image(champ["portrait_url"], filepath)

        entry = {
            "name": champ["name"],
            "champion_class": champ["champion_class"],
            "image_filename": base_name if success else None,
        }
        final_data.append(entry)

        if i % 10 == 0:
            time.sleep(0.5)

    # Write JSON (image_filename without extension for flexible size usage)
    JSON_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(JSON_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(final_data, f, indent=2, ensure_ascii=False)

    print(f"\nDone! JSON saved to {JSON_OUTPUT}")
    print(f"Images saved to {OUTPUT_DIR}")
    print(f"Total champions: {len(final_data)}")


def action_resize():
    """Resize all champion images to a given size based on the JSON data."""
    try:
        from PIL import Image
    except ImportError:
        print("Pillow is required for resizing. Install it with: pip install Pillow")
        return

    size_input = input("Enter the desired size (e.g. 40 for 40x40): ").strip()
    try:
        size = int(size_input)
        if size < 1:
            raise ValueError
    except ValueError:
        print("Invalid size. Please enter a positive integer.")
        return

    if not JSON_OUTPUT.exists():
        print(f"JSON file not found: {JSON_OUTPUT}")
        print("Run the download action first.")
        return

    with open(JSON_OUTPUT, "r", encoding="utf-8") as f:
        champions_data = json.load(f)

    resized_count = 0
    skipped_count = 0
    error_count = 0

    print(f"\nResizing {len(champions_data)} champion images to {size}x{size}...\n")

    for champ in champions_data:
        base_name = champ.get("image_filename")
        if not base_name:
            skipped_count += 1
            continue

        # Source is always the original .png
        source_path = OUTPUT_DIR / f"{base_name}.png"
        # Output: <base_name>_NxN.png
        output_filename = f"{base_name}_{size}x{size}.png"
        output_path = OUTPUT_DIR / output_filename

        if not source_path.exists():
            print(f"  [MISS] {source_path.name} not found, skipping")
            error_count += 1
            continue

        if output_path.exists():
            skipped_count += 1
            continue

        try:
            with Image.open(source_path) as img:
                resized = img.resize((size, size), Image.LANCZOS)
                resized.save(output_path, "PNG")
            resized_count += 1
            if resized_count % 20 == 0:
                print(f"  Resized {resized_count} images...")
        except Exception as e:
            print(f"  [ERROR] Failed to resize {source_path.name}: {e}")
            error_count += 1

    print(f"\nDone! Resized: {resized_count}, Skipped (already exist): {skipped_count}, Errors: {error_count}")
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Format: <name>_{size}x{size}.png")


def main():
    print("=== MCOC Champion Scraper ===")
    print()
    print("Choose an action:")
    print("  1. Download images and data from the wiki")
    print("  2. Resize all images to a custom size (e.g. 40x40)")
    print()

    choice = input("Enter your choice (1 or 2): ").strip()

    if choice == "1":
        action_download()
    elif choice == "2":
        action_resize()
    else:
        print("Invalid choice. Please enter 1 or 2.")


if __name__ == "__main__":
    main()
