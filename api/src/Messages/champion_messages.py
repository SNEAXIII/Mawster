from fastapi import HTTPException
from starlette import status


class ChampionError(HTTPException):
    def __init__(self, detail: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(status_code=status_code, detail=detail)

    def __str__(self):
        return self.detail


CHAMPION_NOT_FOUND = ChampionError(
    "Champion introuvable", status_code=status.HTTP_404_NOT_FOUND
)
CHAMPION_LOAD_SUCCESS = "Champions chargés avec succès"
CHAMPION_ALIAS_UPDATED = "Alias du champion mis à jour avec succès"
CHAMPION_DELETED = "Champion supprimé avec succès"
