"""
Scrape MCOC wiki for champion data and portrait images.
Downloads full-size portraits; build_assets makes the WebP thumbnails from them.

Usage:
    uvx run scrape-champions.py
"""

import asyncio
import json
import re
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from scrapling.fetchers import AsyncStealthySession

# Add api/ to sys.path so we can import src.enums
_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT / "api"))
from src.enums.ChampionClass import ChampionClass  # noqa: E402

WIKI_BASE = "https://marvel-contestofchampions.fandom.com"
# /wiki/ pages sit behind a Cloudflare challenge; the MediaWiki API serves the same rendered HTML.
WIKI_API_URL = (
    f"{WIKI_BASE}/api.php?action=parse&page=List_of_Champions&prop=text&format=json&formatversion=2"
)
OUTPUT_DIR = _ROOT / "static-assets" / "static" / "champions"
JSON_OUTPUT = _ROOT / "api" / "src" / "fixtures" / "champions.json"
# Wiki revision of each portrait on disk; outside static/ so it is never served.
REVISIONS_FILE = _ROOT / "static-assets" / "portrait_revisions.json"

VALID_CLASSES = {c.value for c in ChampionClass}

REVISION_LATEST = "/revision/latest"

# Columns of a List_of_Champions row: portrait, name, release date, class.
PORTRAIT_COL, NAME_COL, DATE_COL, CLASS_COL = 0, 1, 2, 3

HEADERS = {"Referer": f"{WIKI_BASE}/"}


def _fetch(url: str, timeout: int):
    from curl_cffi import requests as cffi_requests

    resp = cffi_requests.get(url, headers=HEADERS, timeout=timeout)
    resp.raise_for_status()
    return resp


def clean_image_url(url: str) -> str:
    """Strip Fandom's thumbnail suffixes to get the original full-size image, keeping its `cb`."""
    if REVISION_LATEST in url:
        cb = parse_qs(urlsplit(url).query).get("cb")
        query = f"?cb={cb[0]}" if cb else ""
        return f"{url.split(REVISION_LATEST, maxsplit=1)[0]}{REVISION_LATEST}{query}"
    return url


def image_revision(url: str) -> str:
    """Fandom's `cb` is the upload timestamp of the file's latest revision."""
    return parse_qs(urlsplit(url).query).get("cb", [""])[0]


def sanitize_filename(name: str) -> str:
    """Create a safe, lowercase filename from a champion name."""
    safe = re.sub(r"[^a-zA-Z0-9_\-]", "_", name.lower())
    return re.sub(r"_+", "_", safe).strip("_")


def _save_clean_png(data: bytes, filepath: Path) -> None:
    """Re-save PNG via PIL to strip non-deterministic metadata chunks."""
    import io

    from PIL import Image

    with Image.open(io.BytesIO(data)) as img:
        img.save(filepath, format="PNG", optimize=False)


# The image CDN now answers scripts with a Cloudflare challenge page, so images go through a
# browser that solves it; the API above is not challenged.
CONCURRENCY = 50


def _is_current(path: Path, revision: str, revisions: dict[str, str], force: bool) -> bool:
    """A portrait on disk is reused while the wiki still serves the revision it was downloaded at."""
    return path.exists() and not force and bool(revision) and revisions.get(path.stem) == revision


async def download_images(
    jobs: list[tuple[str, str, Path]], revisions: dict[str, str], force: bool
) -> list[bool]:
    """Download `(name, url, path)` jobs over one browser with CONCURRENCY tabs; True per success.

    `revisions` is updated in place for every portrait downloaded."""

    # A fetch waiting over 60 s for a free tab raises, so no more fetches than tabs are in flight.
    gate = asyncio.Semaphore(CONCURRENCY)
    stale = {
        path
        for _, url, path in jobs
        if not _is_current(path, image_revision(url), revisions, force)
    }
    print(
        f"  {len(stale)} portrait(s) new or updated on the wiki, {len(jobs) - len(stale)} up to date"
    )
    if not stale:
        return [True] * len(jobs)
    done = 0

    async def one(name: str, url: str, path: Path) -> bool:
        nonlocal done
        if path not in stale:
            return True
        async with gate:
            try:
                page = await session.fetch(url)
                # A challenge page that slipped through is HTML: PIL refuses it and the old file stays.
                _save_clean_png(page.body, path)
                revisions[path.stem] = image_revision(url)
                ok = True
            except Exception as e:
                print(f"  [WARN] Failed to download {url}: {e}")
                ok = False
        done += 1
        print(f"  [{done}/{len(stale)}] {name}")
        return ok

    async with AsyncStealthySession(
        headless=True, solve_cloudflare=True, max_pages=CONCURRENCY
    ) as session:
        return await asyncio.gather(*(one(*job) for job in jobs))


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
    tables = soup.find_all("table", class_=re.compile(r"wiki|article|fandom", re.IGNORECASE))
    print(f"  [DEBUG] Tables with wiki/article/fandom class: {len(tables)}")
    return tables


def _extract_champion_name(cells):
    """Extract champion name from row cells. Returns name or empty string."""
    name_cell = cells[NAME_COL]
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
    class_cell = cells[CLASS_COL]
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
    portrait_cell = cells[PORTRAIT_COL]
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
        class_text = cells[CLASS_COL].get_text(separator=" ", strip=True)
        print(f"  [SKIP] {name}: no single valid class ({class_text})")
        return

    portrait_url = _extract_portrait_url(cells)
    if portrait_url is None:
        print(f"  [SKIP] {name}: no valid portrait image")
        return

    release_date = cells[DATE_COL].get_text(strip=True)

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
    from bs4 import BeautifulSoup

    print(f"Fetching {WIKI_API_URL} ...")
    html = _fetch(WIKI_API_URL, timeout=60).json()["parse"]["text"]
    print(f"  [DEBUG] HTML length: {len(html)}")

    soup = BeautifulSoup(html, "lxml")

    champions = []
    seen_names = set()

    tables = _find_champion_tables(soup)
    if not tables:
        print("  [ERROR] No tables found at all!")
        print(f"  [DEBUG] Page start:\n{html[:2000]}")
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
            if len(cells) <= CLASS_COL:
                continue
            _parse_champion_row(cells, seen_names, champions, row_idx)

    print(f"\n  [DEBUG] Total champions collected: {len(champions)}")
    return champions


def download_champion_images(champions: list[dict], force: bool = False):
    """Download champion images and data from the wiki."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    names = [sanitize_filename(champ["name"]) for champ in champions]
    jobs = [
        (champ["name"], champ["portrait_url"], OUTPUT_DIR / f"{name}.png")
        for champ, name in zip(champions, names, strict=True)
    ]
    revisions = (
        json.loads(REVISIONS_FILE.read_text(encoding="utf-8")) if REVISIONS_FILE.exists() else {}
    )
    results = asyncio.run(download_images(jobs, revisions, force))
    # Saved before the checks below: the portraits downloaded are on disk whatever they decide.
    REVISIONS_FILE.write_text(
        json.dumps(revisions, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    # A failed --force re-download still leaves the previous portrait usable.
    failed = [
        name
        for (name, _, path), ok in zip(jobs, results, strict=True)
        if not ok and not path.exists()
    ]
    final_data = [
        {
            "name": champ["name"],
            "champion_class": champ["champion_class"],
            # build_assets serves the PNG converted to WebP.
            "image_url": f"/static/champions/{name}.webp",
        }
        for champ, name in zip(champions, names, strict=True)
    ]

    if failed:
        sys.exit(
            f"\n{len(failed)} portrait(s) missing, {JSON_OUTPUT.name} left untouched: {', '.join(failed)}"
        )

    # A wiki page that parses to fewer rows (layout change, challenge page) must not erase champions.
    previous = json.loads(JSON_OUTPUT.read_text(encoding="utf-8")) if JSON_OUTPUT.exists() else []
    dropped = sorted({c["name"] for c in previous} - {c["name"] for c in final_data})
    if dropped:
        sys.exit(
            f"\n{len(dropped)} champion(s) would vanish, {JSON_OUTPUT.name} left untouched: {', '.join(dropped)}"
        )

    JSON_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with JSON_OUTPUT.open("w", encoding="utf-8") as f:
        json.dump(final_data, f, indent=2, ensure_ascii=False)

    print(f"\nDone! JSON saved to {JSON_OUTPUT}")
    print(f"Images saved to {OUTPUT_DIR}")
    print(f"Total champions: {len(final_data)}")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="MCOC Champion Scraper")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download and re-resize images even if they already exist",
    )
    args = parser.parse_args()

    print("=== MCOC Champion Scraper ===")
    if args.force:
        print("  [INFO] Force mode: overwriting existing images")
    champions = scrape_champions_list()
    print(f"\nFound {len(champions)} champions with single class and valid image.\n")
    if not champions:
        sys.exit(f"No champion parsed from the wiki, {JSON_OUTPUT.name} left untouched.")
    download_champion_images(champions, force=args.force)


if __name__ == "__main__":
    main()
