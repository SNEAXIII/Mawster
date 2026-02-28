from pydantic import BaseModel, Field


class TokenBody(BaseModel):
    token: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class LoginResponse(BaseModel):
    token_type: str = Field(examples=["bearer"])
    access_token: str = Field(examples=["access_token"])
    refresh_token: str = Field(examples=["refresh_token"])
