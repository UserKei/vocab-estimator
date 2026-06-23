from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="VOCAB_", env_file=".env", extra="ignore")

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    database_url: str = "sqlite:///./data/vocab_estimator.db"
    word_rank_path: Path = Path("data/wordlists/word_rank.csv")


@lru_cache
def get_settings() -> Settings:
    return Settings()
