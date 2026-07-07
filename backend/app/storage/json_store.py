"""
JSON-file stand-in for the content store.

TEMPORARY — this is the placeholder persistence for the pre-database phase. It keeps
two files under `data/`: `content.json` (the editable site content) and
`submissions.json` (contact-form requests). Concurrency-safe enough for a single
admin; the colleague replaces it with a real DB store (see backend/README.md).
"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from ..defaults import default_content
from ..schemas import ContactSubmission, ContactSubmissionIn, SiteContent
from .base import ContentStore


class JSONFileStore(ContentStore):
    def __init__(self, data_dir: str) -> None:
        self.dir = Path(data_dir)
        self.dir.mkdir(parents=True, exist_ok=True)
        self.content_path = self.dir / "content.json"
        self.subs_path = self.dir / "submissions.json"
        if not self.content_path.exists():
            self._write(self.content_path, default_content().model_dump())
        if not self.subs_path.exists():
            self._write(self.subs_path, [])

    @staticmethod
    def _read(path: Path):
        return json.loads(path.read_text(encoding="utf-8"))

    @staticmethod
    def _write(path: Path, data) -> None:
        path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def get_content(self) -> SiteContent:
        return SiteContent.model_validate(self._read(self.content_path))

    def save_content(self, content: SiteContent) -> SiteContent:
        self._write(self.content_path, content.model_dump())
        return content

    def list_submissions(self) -> list[ContactSubmission]:
        items = [ContactSubmission.model_validate(s) for s in self._read(self.subs_path)]
        return list(reversed(items))  # newest first

    def add_submission(self, data: ContactSubmissionIn) -> ContactSubmission:
        record = ContactSubmission(
            id=uuid.uuid4().hex,
            created_at=datetime.now(timezone.utc).isoformat(),
            **data.model_dump(),
        )
        items = self._read(self.subs_path)
        items.append(record.model_dump())
        self._write(self.subs_path, items)
        return record
