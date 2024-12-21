from sqlalchemy import Column, Integer, String, Numeric, ARRAY, UniqueConstraint
from database.base import Base


class Tournament(Base):
    """Model representing a tournament."""

    __tablename__ = "tournaments"

    id = Column(Integer, primary_key=True)
    channel_id = Column(String(255))
    tournament_id = Column(Integer, unique=True)
    game_name = Column(String(255))
    amount = Column(Numeric(18, 8))
    num_entrants = Column(Integer)
    creator_id = Column(String(255))
    players = Column(ARRAY(String(255)))
    wallet_addresses = Column(ARRAY(String(255)))

    # Add unique constraint for tournament_id
    __table_args__ = (UniqueConstraint("tournament_id", name="unique_tournament_id"),)

    def __repr__(self):
        return f"<Tournament(id={self.id}, tournament_id={self.tournament_id}, game={self.game_name})>"
