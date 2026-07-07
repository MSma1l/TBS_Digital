"""
Storage interface.

This is the seam the colleague implements against a real database. The routers,
schemas and auth all depend only on this interface — swapping `JSONFileStore` for a
`DbStore` requires no changes above this layer.
"""

from abc import ABC, abstractmethod

from ..schemas import ContactSubmission, ContactSubmissionIn, SiteContent


class ContentStore(ABC):
    @abstractmethod
    def get_content(self) -> SiteContent:
        """Return the whole site content document."""

    @abstractmethod
    def save_content(self, content: SiteContent) -> SiteContent:
        """Replace the whole site content document and return it."""

    @abstractmethod
    def list_submissions(self) -> list[ContactSubmission]:
        """Return all contact-form submissions (newest first)."""

    @abstractmethod
    def add_submission(self, data: ContactSubmissionIn) -> ContactSubmission:
        """Persist a new contact-form submission and return the stored record."""
