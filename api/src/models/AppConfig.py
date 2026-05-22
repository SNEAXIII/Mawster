from sqlmodel import Field, SQLModel


class AppConfig(SQLModel, table=True):
    __tablename__ = "app_config"

    key: str = Field(primary_key=True, max_length=100)
    value: str = Field(max_length=500)
