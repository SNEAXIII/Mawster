import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.enums.MatchupTargetType import MatchupTargetType
from src.enums.MatchupVerdict import MatchupVerdict
from src.Messages.matchup_messages import (
    DISCOURAGED_HAS_NO_SCORE,
    DUPLICATE_TARGET_TYPE,
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


class MatchupEvaluationRow(BaseModel):
    """One attacker champion evaluated against the selected defender and/or node.

    ``score`` is ``None`` exactly when ``is_discouraged`` is True.
    The player-aware fields are ``None`` when no game account was requested.
    """

    champion: ChampionRef
    defender_verdict: Optional[MatchupVerdict] = None
    node_verdict: Optional[MatchupVerdict] = None
    is_discouraged: bool
    score: Optional[int] = None
    synergies: list[MatchupSynergyResponse] = Field(default_factory=list)
    prefight: Optional[ChampionRef] = None
    is_playable: Optional[bool] = None
    instance_label: Optional[str] = None
    missing_champions: list[ChampionRef] = Field(default_factory=list)
    is_on_defense: Optional[bool] = None

    @model_validator(mode="after")
    def score_absent_iff_discouraged(self) -> "MatchupEvaluationRow":
        """Keep the two representations of a discouraged fight from drifting apart.

        A discouraged fight has no score — it is not a fight worth zero points. The service
        builds this row by hand, so without this check a stale score could ride alongside a
        discouraged verdict and the UI would render a number where it must render a word.
        """
        if self.is_discouraged and self.score is not None:
            raise ValueError(DISCOURAGED_HAS_NO_SCORE)
        if not self.is_discouraged and self.score is None:
            raise ValueError(SCORE_REQUIRED_WHEN_NOT_DISCOURAGED)
        return self


class MatchupGridAxisEntry(BaseModel):
    """One rated axis value for the attacker: a defender, or a node."""

    defender: Optional[ChampionRef] = None
    node_number: Optional[int] = None
    verdict: MatchupVerdict
    synergies: list[MatchupSynergyResponse] = Field(default_factory=list)
    prefight: Optional[ChampionRef] = None


class MatchupGridCell(BaseModel):
    defender_champion_id: uuid.UUID
    node_number: int
    is_discouraged: bool
    score: Optional[int] = None

    @model_validator(mode="after")
    def score_absent_iff_discouraged(self) -> "MatchupGridCell":
        if self.is_discouraged and self.score is not None:
            raise ValueError(DISCOURAGED_HAS_NO_SCORE)
        if not self.is_discouraged and self.score is None:
            raise ValueError(SCORE_REQUIRED_WHEN_NOT_DISCOURAGED)
        return self


class MatchupGridResponse(BaseModel):
    attacker: ChampionRef
    is_owned: Optional[bool] = None
    instance_label: Optional[str] = None
    is_on_defense: Optional[bool] = None
    defenders: list[MatchupGridAxisEntry] = Field(default_factory=list)
    nodes: list[MatchupGridAxisEntry] = Field(default_factory=list)
    cells: list[MatchupGridCell] = Field(default_factory=list)
