"""FastAPI dependency providers (singletons)."""

from functools import lru_cache

from .config import get_settings
from .storage.base import ContentStore
from .storage.json_store import JSONFileStore


@lru_cache
def get_store() -> ContentStore:
    """The active content store. Swap the implementation here for the DB store."""
    return JSONFileStore(get_settings().data_dir)
