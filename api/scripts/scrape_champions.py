"""
Scrape MCOC wiki for champion data and portrait images.
Outputs a JSON file and downloads portrait images into a folder.

Usage:
    cd api
    python -m scripts.scrape_champions

Requires: requests, beautifulsoup4, lxml
    pip install requests beautifulsoup4 lxml
"""

import json
import os
import re
import time
from pathlib import Path
from urllib.parse import unquote

import requests
from bs4 import BeautifulSoup

WIKI_URL = "https://marvel-contestofchampions.fandom.com/wiki/List_of_Champions"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "static" / "champions"
JSON_OUTPUT = Path(__file__).resolve().parent.parent / "scripts" / "champions.json"

VALID_CLASSES = {"Science", "Cosmic", "Mutant", "Skill", "Tech", "Mystic"}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}


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
    if filepath.exists():
        return True
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        filepath.write_bytes(resp.content)
        return True
    except Exception as e:
        print(f"  [WARN] Failed to download {url}: {e}")
        return False


def scrape_champions() -> list[dict]:
    """Scrape the wiki and return a list of champion dicts."""
    print(f"Fetching {WIKI_URL} ...")
    resp = requests.get(WIKI_URL, headers=HEADERS, timeout=60)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")

    # Find the main playable champions table
    # The first big table in the page after "List of Playable Champions" heading
    champions = []
    seen_names = set()

    # Find all sortable tables (the main champion table is sortable)
    tables = soup.find_all("table", class_="sortable")

    for table in tables:
        rows = table.find_all("tr")
        for row in rows:
            cells = row.find_all("td")
            if len(cells) < 5:
                continue

            # Cell 0: portrait image
            # Cell 1: featured image
            # Cell 2: champion name (link)
            # Cell 3: release date
            # Cell 4: class

            # Extract name
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

            # Extract class - check the text content of the last cell
            class_cell = cells[4]
            class_text = class_cell.get_text(separator=" ", strip=True)

            # Check for multiple classes (skip multi-class champions)
            class_matches = [c for c in VALID_CLASSES if c in class_text]
            if len(class_matches) != 1:
                print(f"  [SKIP] {name}: {'multiple classes' if len(class_matches) > 1 else 'no valid class'} ({class_text})")
                continue

            champion_class = class_matches[0]

            # Extract release date
            date_cell = cells[3]
            release_date = date_cell.get_text(strip=True)

            # Extract portrait image URL
            portrait_cell = cells[0]
            portrait_img = portrait_cell.find("img")
            portrait_url = None
            if portrait_img:
                # Try data-src first (lazy loaded), then src
                portrait_url = portrait_img.get("data-src") or portrait_img.get("src")
                if portrait_url:
                    portrait_url = clean_image_url(portrait_url)

            if not portrait_url or "File:" in portrait_cell.get_text():
                print(f"  [SKIP] {name}: no valid portrait image")
                continue

            seen_names.add(name)
            champions.append({
                "name": name,
                "champion_class": champion_class,
                "release_date": release_date,
                "portrait_url": portrait_url,
            })

    return champions


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    champions = scrape_champions()
    print(f"\nFound {len(champions)} champions with single class and valid image.\n")

    # Download images and build final JSON
    final_data = []
    for i, champ in enumerate(champions, 1):
        filename = sanitize_filename(champ["name"]) + ".png"
        filepath = OUTPUT_DIR / filename

        print(f"  [{i}/{len(champions)}] {champ['name']} ({champ['champion_class']})")

        success = download_image(champ["portrait_url"], filepath)

        entry = {
            "name": champ["name"],
            "champion_class": champ["champion_class"],
            "image_filename": filename if success else None,
        }
        final_data.append(entry)

        # Be polite to the server
        if i % 10 == 0:
            time.sleep(0.5)

    # Write JSON
    JSON_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with open(JSON_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(final_data, f, indent=2, ensure_ascii=False)

    print(f"\nDone! JSON saved to {JSON_OUTPUT}")
    print(f"Images saved to {OUTPUT_DIR}")
    print(f"Total champions: {len(final_data)}")


if __name__ == "__main__":
    main()
