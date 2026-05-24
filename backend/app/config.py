import os
from typing import List
from pydantic_settings import BaseSettings
from pydantic import field_validator


class Settings(BaseSettings):
    # API Keys
    ANTHROPIC_API_KEY: str = ""
    REPLICATE_API_TOKEN: str = ""

    # Database
    DATABASE_URL: str = "sqlite:///./armadio.db"

    # File storage
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10 MB
    ALLOWED_EXTENSIONS: List[str] = ["jpg", "jpeg", "png", "webp"]

    # Security
    SECRET_KEY: str = "change-me-in-production"

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173", "http://192.168.1.8:5173"]

    # App
    APP_NAME: str = "Progetto Armadio"
    DEBUG: bool = False

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    @field_validator("ALLOWED_EXTENSIONS", mode="before")
    @classmethod
    def parse_allowed_extensions(cls, v):
        if isinstance(v, str):
            return [ext.strip() for ext in v.split(",")]
        return v

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
