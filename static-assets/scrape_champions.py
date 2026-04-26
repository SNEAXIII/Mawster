"""
Scrape MCOC wiki for champion data and portrait images.
Downloads portraits and auto-resizes to sizes defined in pyproject.toml [tool.scraper].

Usage:
    uvx run scrape-champions.py
"""

import json
import re
import sys
import time
import tomllib
from pathlib import Path

# Add api/ to sys.path so we can import src.enums
_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT / "api"))
from src.enums.ChampionClass import ChampionClass  # noqa: E402

WIKI_URL = "https://marvel-contestofchampions.fandom.com/wiki/List_of_Champions"
OUTPUT_DIR = _ROOT / "static-assets" / "static" / "champions"
JSON_OUTPUT = _ROOT / "api" / "src" / "fixtures" / "champions.json"

_PYPROJECT = Path(__file__).resolve().parent / "pyproject.toml"


def _load_resize_sizes() -> list[int]:
    with open(_PYPROJECT, "rb") as f:
        config = tomllib.load(f)
    return config.get("tool", {}).get("scraper", {}).get("resize_sizes", [])


VALID_CLASSES = {c.value for c in ChampionClass}

REVISION_LATEST = "/revision/latest"


def clean_image_url(url: str) -> str:
    """Strip Fandom's thumbnail suffixes to get the original full-size image."""
    if REVISION_LATEST in url:
        return f"{url.split(REVISION_LATEST)[0]}{REVISION_LATEST}"
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


def _find_champion_tables(soup):
    """Try multiple strategies to find champion tables in the wiki page."""
    # Strategy 1: table with class "sortable"
    tables = soup.find_all("table", class_="sortable")
    print(f"  [DEBUG] Tables with class='sortable': {len(tables)}")
    if tables:
        return tables

    # Strategy 2: tables inside #mw-content-text
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

    if tables:
        return tables

    # Strategy 3: any table with class containing "wiki"
    tables = soup.find_all("table", class_=re.compile(r"wiki|article|fandom", re.I))
    print(f"  [DEBUG] Tables with wiki/article/fandom class: {len(tables)}")
    return tables


def _extract_champion_name(cells):
    """Extract champion name from row cells. Returns name or empty string."""
    name_cell = cells[2]
    name_link = name_cell.find("a")
    if name_link:
        name = name_link.get("title", "").strip()
        if not name:
            name = name_link.get_text(strip=True)
    else:
        name = name_cell.get_text(strip=True)
    return name


def _resolve_champion_class(cells):
    """Resolve champion class from cell. Returns class string or None."""
    class_cell = cells[4]
    class_text = class_cell.get_text(separator=" ", strip=True)

    class_link = class_cell.find("a")
    if class_link:
        class_title = class_link.get("title", "")
        if class_title in VALID_CLASSES:
            class_text = class_title

    class_matches = [c for c in VALID_CLASSES if c in class_text]
    if len(class_matches) != 1:
        return None
    return class_matches[0]


def _extract_portrait_url(cells):
    """Extract portrait URL from portrait cell. Returns URL or None."""
    portrait_cell = cells[0]
    portrait_img = portrait_cell.find("img")
    if not portrait_img:
        return None
    portrait_url = portrait_img.get("data-src") or portrait_img.get("src")
    if portrait_url:
        portrait_url = clean_image_url(portrait_url)
    if not portrait_url or "File:" in portrait_cell.get_text():
        return None
    return portrait_url


def _parse_champion_row(cells, seen_names, champions, row_idx):
    """Parse a single table row and append champion if valid."""
    name = _extract_champion_name(cells)
    if not name or name in seen_names:
        return

    if len(champions) < 3:
        print(f"  [DEBUG] Row {row_idx}: name='{name}', cells={len(cells)}")
        for ci, c in enumerate(cells):
            print(f"    cell[{ci}] text='{c.get_text(strip=True)[:50]}'")

    champion_class = _resolve_champion_class(cells)
    if champion_class is None:
        class_text = cells[4].get_text(separator=" ", strip=True)
        print(f"  [SKIP] {name}: no single valid class ({class_text})")
        return

    portrait_url = _extract_portrait_url(cells)
    if portrait_url is None:
        print(f"  [SKIP] {name}: no valid portrait image")
        return

    release_date = cells[3].get_text(strip=True)

    seen_names.add(name)
    champions.append(
        {
            "name": name,
            "champion_class": champion_class,
            "release_date": release_date,
            "portrait_url": portrait_url,
        }
    )


def scrape_champions_list() -> list[dict]:
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

    tables = _find_champion_tables(soup)
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
            _parse_champion_row(cells, seen_names, champions, row_idx)

    print(f"\n  [DEBUG] Total champions collected: {len(champions)}")
    return champions


def download_champion_images(champions: list[dict]):
    """Download champion images and data from the wiki."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

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
            "image_url": f"/static/champions/{filename}" if success else None,
        }
        final_data.append(entry)

        if i % 10 == 0:
            time.sleep(0.1)

    JSON_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(JSON_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(final_data, f, indent=2, ensure_ascii=False)

    print(f"\nDone! JSON saved to {JSON_OUTPUT}")
    print(f"Images saved to {OUTPUT_DIR}")
    print(f"Total champions: {len(final_data)}")


def _resize_to_size(size: int, champions_data: list[dict]) -> None:
    from PIL import Image

    resized_count = 0
    skipped_count = 0
    error_count = 0

    print(f"\nResizing {len(champions_data)} champion images to {size}x{size}...\n")

    for champ in champions_data:
        image_url = champ.get("image_url")
        if not image_url:
            skipped_count += 1
            continue

        filename = Path(image_url).name
        stem = Path(image_url).stem
        source_path = OUTPUT_DIR / filename
        output_path = OUTPUT_DIR / f"{stem}_{size}x{size}.png"

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

    print(
        f"Done! Resized: {resized_count}, Skipped: {skipped_count}, Errors: {error_count}"
    )


def action_resize():
    """Resize all champion images using sizes defined in pyproject.toml."""
    try:
        from PIL import Image  # noqa: F401
    except ImportError:
        print("Pillow is required for resizing. Install it with: pip install Pillow")
        return

    if not JSON_OUTPUT.exists():
        print(f"JSON file not found: {JSON_OUTPUT}")
        print("Run the download action first.")
        return

    sizes = _load_resize_sizes()
    if not sizes:
        print("No resize_sizes configured in [tool.scraper] of pyproject.toml.")
        return

    with open(JSON_OUTPUT, "r", encoding="utf-8") as f:
        champions_data = json.load(f)

    for size in sizes:
        _resize_to_size(size, champions_data)

    print(f"\nOutput directory: {OUTPUT_DIR}")


def main():
    print("=== MCOC Champion Scraper ===")
    champions = scrape_champions_list()
    print(f"\nFound {len(champions)} champions with single class and valid image.\n")
    download_champion_images(champions)
    print("\nStarting image resizing...")
    action_resize()


if __name__ == "__main__":
    main()
