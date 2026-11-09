from fastapi import HTTPException
from starlette import status

ASCENSION_REQUEST_NOT_FOUND = HTTPException(
    status.HTTP_404_NOT_FOUND, "Ascension request not found"
)
CHAMPION_ALREADY_ASCENDABLE = HTTPException(
    status.HTTP_409_CONFLICT, "Champion is already ascendable"
)
