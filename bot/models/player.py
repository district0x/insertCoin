from sqlalchemy import Column, Integer, Text, Index, and_, DateTime, text
from database.base import Base


class Player(Base):
    """Model representing a player in the system."""

    __tablename__ = "players"

    id = Column(Integer, primary_key=True)
    discord_id = Column(Text)
    wallet_address = Column(Text, unique=True)
    created_at = Column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )

    # Create a partial index for non-null discord_id that's not 'pending'
    __table_args__ = (
        Index(
            "players_discord_id_unique",
            discord_id,
            unique=True,
            postgresql_where=and_(discord_id.isnot(None), discord_id != "pending"),
        ),
    )

    def __repr__(self):
        return f"<Player(id={self.id}, discord_id={self.discord_id})>"
