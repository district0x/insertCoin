from datetime import datetime
from sqlalchemy import Column, DateTime, text
from database.base import Base


class TimestampMixin:
    """Mixin to add created_at and updated_at timestamps to models."""

    created_at = Column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=datetime.utcnow,
        nullable=False,
    )
