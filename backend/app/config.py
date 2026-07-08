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

    # Database connection string. SQLite by default; a `postgresql://` URL switches
    # to Postgres (normalised to the psycopg driver in app/db.py).
    #   sqlite:///./data/tbs.db
    #   postgresql://user:pass@host:5432/tbs
    database_url: str = "sqlite:///./data/tbs.db"

    # Legacy: where the JSON stand-in (kept as a reference store) writes its files.
    # The active DB store ignores this.
    data_dir: str = "data"

    # --- Admin bootstrap: seeds the DB `users` table on first run (hashed). ---
    admin_username: str = "admin"
    admin_password: str = "change-me"
    jwt_secret: str = "dev-secret-change-me"
    jwt_expire_minutes: int = 720  # 12h

    # --- Telegram lead-notification bot (app/telegram) --------------------------
    # All optional with safe defaults so boot + existing tests work when unset.
    # When the token is empty the whole integration is a no-op (never touches the
    # network). See backend/.env.example for docs (owned by another agent).
    telegram_bot_token: str = ""  # empty => disabled
    telegram_group_chat_id: str = ""  # optional; else captured via /register
    telegram_enabled: bool = True  # honoured only when a token is present

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def telegram_is_enabled(self) -> bool:
        """True only when the integration should run (token present + enabled)."""
        return bool(self.telegram_bot_token) and self.telegram_enabled


@lru_cache
def get_settings() -> Settings:
    return Settings()
