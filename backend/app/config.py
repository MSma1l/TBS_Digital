from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Known insecure placeholder values that must never reach production.
_DEFAULT_JWT_SECRET = "dev-secret-change-me"
_DEFAULT_ADMIN_PASSWORD = "change-me"
_MIN_JWT_SECRET_LEN = 32
_MIN_ADMIN_PASSWORD_LEN = 12


class Settings(BaseSettings):
    """App configuration, loaded from environment / a local .env file."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "TBS Digital API"

    # Deployment environment. When set to "production" a fail-fast guard (below)
    # refuses to boot with insecure defaults (weak JWT secret, default admin
    # password, wildcard CORS).
    environment: str = "development"

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
    jwt_expire_minutes: int = 120  # 2h — short-lived; shrinks the token-theft window

    # Toggle for the request rate limiter (disabled in tests for determinism).
    rate_limit_enabled: bool = True

    # How many trusted reverse proxies sit in front of the app. The rate-limit key is the
    # client IP, but X-Forwarded-For is client-controllable: an attacker who sets it gets a
    # fresh bucket per request and defeats the limit entirely. We therefore trust only the
    # entry the *trusted* proxy added — the Nth from the RIGHT — never the left-most.
    # 1 = one reverse proxy (the shared nginx). 0 = no proxy, use the socket peer directly.
    trusted_proxy_count: int = 1

    # --- Telegram lead-notification bot (app/telegram) --------------------------
    # All optional with safe defaults so boot + existing tests work when unset.
    # When the token is empty the whole integration is a no-op (never touches the
    # network). See backend/.env.example for docs (owned by another agent).
    telegram_bot_token: str = ""  # empty => disabled
    telegram_group_chat_id: str = ""  # optional; else captured via /register
    telegram_enabled: bool = True  # honoured only when a token is present
    # Comma-separated Telegram user ids allowed to run /register, /stats, and the
    # lead classification buttons. Empty => those actions are locked to the pinned
    # group only (see telegram/worker.py authorization).
    telegram_admin_ids: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def telegram_is_enabled(self) -> bool:
        """True only when the integration should run (token present + enabled)."""
        return bool(self.telegram_bot_token) and self.telegram_enabled

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() == "production"

    @property
    def telegram_admin_id_set(self) -> set[int]:
        """Parsed set of Telegram admin user ids (ignores non-numeric entries)."""
        ids: set[int] = set()
        for part in self.telegram_admin_ids.split(","):
            part = part.strip()
            if part:
                try:
                    ids.add(int(part))
                except ValueError:
                    pass
        return ids

    @model_validator(mode="after")
    def _guard_production(self) -> "Settings":
        """Fail-fast: refuse to boot in production with insecure defaults."""
        if not self.is_production:
            return self
        problems: list[str] = []
        if self.jwt_secret in ("", _DEFAULT_JWT_SECRET):
            problems.append("JWT_SECRET is unset or the known default")
        elif len(self.jwt_secret) < _MIN_JWT_SECRET_LEN:
            problems.append(
                f"JWT_SECRET must be >= {_MIN_JWT_SECRET_LEN} chars "
                "(openssl rand -hex 32)"
            )
        if self.admin_password in ("", _DEFAULT_ADMIN_PASSWORD):
            problems.append("ADMIN_PASSWORD is unset or the known default")
        elif len(self.admin_password) < _MIN_ADMIN_PASSWORD_LEN:
            problems.append(
                f"ADMIN_PASSWORD must be >= {_MIN_ADMIN_PASSWORD_LEN} chars"
            )
        if "*" in self.cors_origin_list:
            problems.append("CORS_ORIGINS must not contain '*' in production")
        # Rate limiting is the only brute-force control (no account lockout), so it must
        # never be silently off in production.
        if not self.rate_limit_enabled:
            problems.append("RATE_LIMIT_ENABLED must be true in production")
        # An enabled bot with no admin allow-list trusts *anyone in the bound group* to run
        # /register, /stats and the lead-status buttons — set the operators' user ids.
        if self.telegram_is_enabled and not self.telegram_admin_id_set:
            problems.append(
                "TELEGRAM_ADMIN_IDS must list the operator user ids when the bot is enabled"
            )
        if problems:
            raise ValueError(
                "Refusing to start in production with insecure config: "
                + "; ".join(problems)
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
