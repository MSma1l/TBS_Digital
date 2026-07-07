from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App configuration, loaded from environment / a local .env file."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "TBS Digital API"

    # Comma-separated list of origins allowed by CORS (the Next.js app).
    cors_origins: str = "http://localhost:3000"

    # Where the JSON stand-in stores its files. The colleague's DB store
    # ignores this (see backend/README.md → Handoff).
    data_dir: str = "data"

    # --- Auth stand-in: env credentials -> JWT. Replaced by DB-backed users. ---
    admin_username: str = "admin"
    admin_password: str = "change-me"
    jwt_secret: str = "dev-secret-change-me"
    jwt_expire_minutes: int = 720  # 12h

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
