from contextlib import contextmanager
from typing import Generator
from sqlalchemy.orm import Session
from .base import SessionLocal


@contextmanager
def get_db() -> Generator[Session, None, None]:
    """
    Get a database session with automatic commit/rollback and cleanup.

    Yields:
        Session: SQLAlchemy database session

    Example:
        with get_db() as db:
            db.query(Model).all()
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
