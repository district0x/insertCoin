from sqlalchemy import Column, Integer, String, DateTime, Enum, text
from database.base import Base
import enum


class PostType(enum.Enum):
    MATCH_CREATED = "match_created"
    MATCH_JOINED = "match_joined"
    MATCH_COMPLETED = "match_completed"
    TOURNAMENT_CREATED = "tournament_created"
    DAILY_STATS = "daily_stats"


class PostStatus(enum.Enum):
    SUCCESS = "success"
    FAILED = "failed"
    PENDING = "pending"


class TwitterPost(Base):
    """Model for tracking Twitter posts."""

    __tablename__ = "twitter_posts"

    id = Column(Integer, primary_key=True)
    type = Column(Enum(PostType), nullable=False)
    reference_id = Column(String)  # match_id or tournament_id
    created_at = Column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )
    status = Column(Enum(PostStatus), nullable=False, default=PostStatus.PENDING)
    error_message = Column(String)
    tweet_id = Column(String)  # Store the ID of the posted tweet

    def __repr__(self):
        return f"<TwitterPost(id={self.id}, type={self.type}, reference_id={self.reference_id}, status={self.status})>"
