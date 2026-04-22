"""Fixture: load all champions from scripts/champions.json into the database."""

import json
from pathlib import Path

from src.dto.dto_champion import ChampionLoadRequest
from src.services.ChampionService import ChampionService

JSON_PATH = Path(__file__).resolve().parent.parent / "scripts" / "champions_to_load.json"


async def run(session) -> dict:
    with open(JSON_PATH, encoding="utf-8") as f:
        data = json.load(f)
    champions = [ChampionLoadRequest(**entry) for entry in data]
    return await ChampionService.load_champions(session, champions)
