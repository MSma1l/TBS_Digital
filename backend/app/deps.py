"""FastAPI dependency providers (singletons)."""

from functools import lru_cache

from .db import get_engine
from .storage.base import ContentStore
from .storage.db_store import DbStore


@lru_cache
def get_store() -> ContentStore:
    """The active content store — DB-backed, sharing the process-wide engine.

    `JSONFileStore` (storage/json_store.py) remains in the tree as a reference/fallback
    but is no longer wired in.
    """
    return DbStore(get_engine())
