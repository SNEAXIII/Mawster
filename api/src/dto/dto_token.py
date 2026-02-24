from pydantic import BaseModel, Field


class TokenBody(BaseModel):
    token: str

class LoginResponse(BaseModel):
    token_type: str = Field(examples=["bearer"])
    access_token: str = Field(examples=["access_token"])
