"""Application configuration loaded from environment variables."""
from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache


class Settings(BaseSettings):
    # MongoDB
    mongodb_uri: str = Field(default="mongodb://localhost:27017", alias="MONGODB_URI")
    db_name: str = Field(default="focusflow", alias="DB_NAME")

    # JWT
    jwt_secret: str = Field(default="change-me-to-a-long-random-string-in-production", alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(default=60, alias="ACCESS_TOKEN_EXPIRE_MINUTES")

    # Gemini
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-1.5-flash", alias="GEMINI_MODEL")

    # App
    frontend_url: str = Field(default="http://localhost:3000", alias="FRONTEND_URL")
    mode: str = Field(default="norm", alias="MODE")

    class Config:
        env_file = ".env"
        populate_by_name = True
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
