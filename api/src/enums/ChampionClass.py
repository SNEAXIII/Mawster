from enum import Enum


class ChampionClass(str, Enum):
    SCIENCE = "Science"
    COSMIC = "Cosmic"
    MUTANT = "Mutant"
    SKILL = "Skill"
    TECH = "Tech"
    MYSTIC = "Mystic"
