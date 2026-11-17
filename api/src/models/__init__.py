from sqlalchemy import Index, UniqueConstraint
from sqlmodel import SQLModel

from src.models.alliance.Alliance import Alliance  # noqa: F401
from src.models.alliance.AllianceInvitation import AllianceInvitation  # noqa: F401
from src.models.alliance.AllianceOfficer import AllianceOfficer  # noqa: F401
from src.models.alliance.AllianceStrategist import AllianceStrategist  # noqa: F401
from src.models.alliance.AllianceVisitor import AllianceVisitor  # noqa: F401
from src.models.alliance.DefensePlan import (  # noqa: F401
    DefenseActivePlan,
    DefensePlan,
    DefensePlanNode,
)
from src.models.alliance.DefenseTemplate import DefenseTemplate, DefenseTemplateNode  # noqa: F401
from src.models.champion.AscensionRequest import AscensionRequest  # noqa: F401
from src.models.champion.Champion import Champion  # noqa: F401
from src.models.champion.ChampionSagaRole import ChampionSagaRole  # noqa: F401
from src.models.champion.ChampionUser import ChampionUser  # noqa: F401
from src.models.champion.RequestedUpgrade import RequestedUpgrade  # noqa: F401
from src.models.user.AdminAuditEntry import AdminAuditEntry  # noqa: F401
from src.models.user.GameAccount import GameAccount  # noqa: F401
from src.models.user.GameAccountMastery import GameAccountMastery  # noqa: F401
from src.models.user.LoginLog import LoginLog  # noqa: F401
from src.models.user.Mastery import Mastery  # noqa: F401
from src.models.user.NoteReport import NoteReport  # noqa: F401
from src.models.user.User import User  # noqa: F401
from src.models.user.UserMute import UserMute  # noqa: F401
from src.models.user.UserWarn import UserWarn  # noqa: F401
from src.models.vision.VisionCorrection import VisionCorrection  # noqa: F401
from src.models.vision.VisionImport import VisionImport  # noqa: F401
from src.models.vision.VisionJob import VisionJob  # noqa: F401
from src.models.vision.VisionPrediction import VisionPrediction  # noqa: F401
from src.models.vision.VisionSample import VisionSample  # noqa: F401
from src.models.war.Season import Season  # noqa: F401
from src.models.war.War import War  # noqa: F401
from src.models.war.WarBan import WarBan  # noqa: F401
from src.models.war.WarDefensePlacement import WarDefensePlacement  # noqa: F401
from src.models.war.WarFightNote import WarFightNote  # noqa: F401
from src.models.war.WarFightNoteRevision import WarFightNoteRevision  # noqa: F401
from src.models.war.WarFightRecord import WarFightRecord  # noqa: F401
from src.models.war.WarFightRecordImport import WarFightRecordImport  # noqa: F401
from src.models.war.WarPrefightAttacker import WarPrefightAttacker  # noqa: F401
from src.models.war.WarReadyBattlegroup import WarReadyBattlegroup  # noqa: F401
from src.models.war.WarSynergyAttacker import WarSynergyAttacker  # noqa: F401

# InnoDB indexed every FK on its own; PostgreSQL does not, so the FK columns that lead no
# key get the index here, once for every model.
for _table in SQLModel.metadata.tables.values():
    _keys = [tuple(_table.primary_key.columns)]
    _keys += [tuple(c.columns) for c in _table.constraints if isinstance(c, UniqueConstraint)]
    _keys += [tuple(i.columns) for i in _table.indexes]
    for _fk in _table.foreign_key_constraints:
        _cols = tuple(_fk.columns)
        if not any(_key[: len(_cols)] == _cols for _key in _keys):
            Index(f"ix_{_table.name}_{'_'.join(c.name for c in _cols)}", *_cols)
            _keys.append(_cols)
