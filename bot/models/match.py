from sqlalchemy import (
    Column,
    String,
    Integer,
    Text,
    Numeric,
    ForeignKey,
    CheckConstraint,
    DateTime,
    text,
)
from sqlalchemy.orm import relationship
from database.base import Base


class Match(Base):
    """Model representing a match between two players."""

    __tablename__ = "matches"

    match_id = Column(String, primary_key=True)
    channel_id = Column(String)
    player1_name = Column(Text, nullable=False)
    player2_name = Column(Text)
    match_amount_usd = Column(Integer, nullable=False)
    category = Column(Text, nullable=False)
    platform = Column(Text, nullable=False)
    game = Column(Text, nullable=False)
    discord_id = Column(Text)
    player2_discord_id = Column(Text)

    # Relationships
    match_results = relationship("MatchResult", back_populates="match", uselist=False)

    def __repr__(self):
        return f"<Match(match_id={self.match_id}, player1={self.player1_name}, player2={self.player2_name})>"


class MatchResult(Base):
    """Model representing the result of a match."""

    __tablename__ = "match_results"

    match_id = Column(Text, ForeignKey("matches.match_id"), primary_key=True)
    winner_discord_id = Column(Text, nullable=False)
    loser_discord_id = Column(Text, nullable=False)
    amount_won_usd = Column(Numeric, nullable=False)
    amount_won_wei = Column(Text, nullable=False)
    match_type = Column(Text, nullable=False)
    transaction_hash = Column(Text, nullable=False, unique=True)
    created_at = Column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP")
    )

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "match_type IN ('1v1', 'tournament')", name="match_results_match_type_check"
        ),
        CheckConstraint(
            "winner_discord_id IS NOT NULL AND loser_discord_id IS NOT NULL",
            name="valid_discord_ids",
        ),
    )

    # Relationships
    match = relationship("Match", back_populates="match_results")

    def __repr__(self):
        return (
            f"<MatchResult(match_id={self.match_id}, winner={self.winner_discord_id})>"
        )
