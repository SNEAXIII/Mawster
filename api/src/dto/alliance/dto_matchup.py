import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.enums.MatchupTargetType import MatchupTargetType
from src.enums.MatchupVerdict import MatchupVerdict
from src.Messages.matchup_messages import (
    DISCOURAGED_HAS_NO_SCORE,
    DUPLICATE_TARGET_TYPE,
    NODE_DETAIL_MISMATCH,
    SCORE_REQUIRED_WHEN_NOT_DISCOURAGED,
    SINGLE_TARGET_REQUIRED,
)


class MatchupSynergyInput(BaseModel):
    champion_id: uuid.UUID
    is_required: bool = True


class MatchupTargetInput(BaseModel):
    """One rating to write. Exactly one of defender/node is set."""

    target_type: MatchupTargetType
    defender_champion_id: Optional[uuid.UUID] = None
    node_number: Optional[int] = Field(default=None, ge=1, le=50)
    verdict: MatchupVerdict
    prefight_champion_id: Optional[uuid.UUID] = None
    synergies: list[MatchupSynergyInput] = Field(default_factory=list, max_length=2)

    @model_validator(mode="after")
    def exactly_one_target(self) -> "MatchupTargetInput":
        is_defender = self.target_type is MatchupTargetType.DEFENDER
        has_defender = self.defender_champion_id is not None
        has_node = self.node_number is not None
        if is_defender and (not has_defender or has_node):
            raise ValueError(SINGLE_TARGET_REQUIRED)
        if not is_defender and (not has_node or has_defender):
            raise ValueError(SINGLE_TARGET_REQUIRED)
        return self


class MatchupUpsertRequest(BaseModel):
    """The unified entry form: rate a champion against a defender, a node, or both at once."""

    champion_id: uuid.UUID
    targets: list[MatchupTargetInput] = Field(min_length=1, max_length=2)

    @model_validator(mode="after")
    def distinct_target_types(self) -> "MatchupUpsertRequest":
        types = [target.target_type for target in self.targets]
        if len(set(types)) != len(types):
            raise ValueError(DUPLICATE_TARGET_TYPE)
        return self


class ChampionRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    champion_id: uuid.UUID
    champion_name: str
    champion_class: str
    image_url: Optional[str] = None


class MatchupSynergyResponse(ChampionRef):
    is_required: bool


class MatchupRatingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    champion: ChampionRef
    target_type: MatchupTargetType
    defender: Optional[ChampionRef] = None
    node_number: Optional[int] = None
    verdict: MatchupVerdict
    prefight: Optional[ChampionRef] = None
    synergies: list[MatchupSynergyResponse] = Field(default_factory=list)
    updated_at: datetime


class MatchupRatedSide(BaseModel):
    """The content of one rating: how the fight goes, and what it costs to take it.

    A rating always targets a single side of a fight — the attacker against a defender, or
    against a node, never both (see ``MatchupTargetInput.exactly_one_target``). A full fight is
    therefore always the composition of two ratings, and this is the half the UI shows of each.
    """

    verdict: MatchupVerdict
    synergies: list[MatchupSynergyResponse] = Field(default_factory=list)
    prefight: Optional[ChampionRef] = None


class MatchupScoredFight(BaseModel):
    """The combined outcome of a whole fight: discouraged, or a score.

    ``score`` is ``None`` exactly when ``is_discouraged`` is True — a discouraged fight is not a
    fight worth zero points, and the UI must render a word where there is no number. The service
    builds these by hand, so the invariant is enforced once here for every shape that carries an
    outcome (both grids' cells, an evaluation row) instead of being restated in each.
    """

    is_discouraged: bool
    score: Optional[int] = None

    @model_validator(mode="after")
    def score_absent_iff_discouraged(self) -> "MatchupScoredFight":
        if self.is_discouraged and self.score is not None:
            raise ValueError(DISCOURAGED_HAS_NO_SCORE)
        if not self.is_discouraged and self.score is None:
            raise ValueError(SCORE_REQUIRED_WHEN_NOT_DISCOURAGED)
        return self


class MatchupGridAxisEntry(MatchupRatedSide):
    """A rated side, named by what it was rated against: a defender, or a node.

    It is the axis of the attacker grid, and it is also what the fight-detail dialog renders as
    one of its two panels — so it doubles as the per-side payload of the defender grid
    (``MatchupDefenderGridCell.node``) and of the evaluation list (``MatchupEvaluationRow``).
    """

    defender: Optional[ChampionRef] = None
    node_number: Optional[int] = None


class MatchupEvaluationRow(MatchupScoredFight):
    """One attacker champion evaluated against the selected defender and/or node.

    The player-aware fields are ``None`` when no game account was requested.

    ``defender`` and ``node`` carry each rated side in full, so a row opens as a fight detail
    exactly like a grid cell does. ``synergies`` and ``prefight`` stay the *merged* view of both
    sides — that is what the list columns show and what playability is computed from — while the
    two sides keep their own, unmerged detail.
    """

    champion: ChampionRef
    defender: Optional[MatchupGridAxisEntry] = None
    node: Optional[MatchupGridAxisEntry] = None
    synergies: list[MatchupSynergyResponse] = Field(default_factory=list)
    prefight: Optional[ChampionRef] = None
    is_playable: Optional[bool] = None
    instance_label: Optional[str] = None
    missing_champions: list[ChampionRef] = Field(default_factory=list)
    is_on_defense: Optional[bool] = None


class MatchupGridCell(MatchupScoredFight):
    """One (defender, node) fight for the grid's fixed attacker.

    Both sides of the fight are on the grid's axes — the attacker is fixed, so its rating against
    each defender and each node is a list shared by every cell. The cell only has to say how the
    pair combines.
    """

    defender_champion_id: uuid.UUID
    node_number: int


class MatchupGridResponse(BaseModel):
    attacker: ChampionRef
    is_owned: Optional[bool] = None
    instance_label: Optional[str] = None
    is_on_defense: Optional[bool] = None
    defenders: list[MatchupGridAxisEntry] = Field(default_factory=list)
    nodes: list[MatchupGridAxisEntry] = Field(default_factory=list)
    cells: list[MatchupGridCell] = Field(default_factory=list)


class MatchupDefenderGridRow(MatchupRatedSide):
    """One attacker rated against the grid's fixed defender.

    This is the "vs defender" side of every fight in that row: the defender does not change from
    one node column to the next, so neither does the rating against it.
    """

    attacker: ChampionRef


class MatchupDefenderGridCell(MatchupScoredFight):
    """One (attacker, node) fight against the grid's fixed defender.

    ``node`` is the attacker's rating against that node — the "vs node" side of the fight; the
    "vs defender" side lives on the row. Unlike the attacker grid, the attacker varies per row
    here, so the node side is per (attacker, node) and cannot be a shared axis: it has to ride on
    the cell, or a click could only ever show half the fight.
    """

    attacker_champion_id: uuid.UUID
    node_number: int
    node: MatchupGridAxisEntry

    @model_validator(mode="after")
    def node_detail_matches_coordinate(self) -> "MatchupDefenderGridCell":
        """``node_number`` is the cell's coordinate and ``node.node_number`` its detail.

        They are two representations of the same node, so a mismatch would put the dialog on a
        different fight than the cell the user clicked — silently, and only for that one cell.
        """
        if self.node.node_number != self.node_number:
            raise ValueError(NODE_DETAIL_MISMATCH)
        return self


class MatchupDefenderGridResponse(BaseModel):
    defender: ChampionRef
    attackers: list[MatchupDefenderGridRow] = Field(default_factory=list)
    cells: list[MatchupDefenderGridCell] = Field(default_factory=list)
