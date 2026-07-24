import uuid

from httpx import Response
from pydantic import BaseModel


def is_valid_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except (ValueError, TypeError):
        return False


def extract_body_to_model(response: Response, model: type[BaseModel]) -> BaseModel:
    return model.model_validate(response)
