import logging
from pathlib import Path

from prisma import Prisma
from prisma.errors import PrismaError

from src.utils.config import config

logger = logging.getLogger(__name__)

class PrismaClient:
    """Prisma client singleton class."""
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            # Create client instance but don't connect yet
            cls._instance._client = Prisma(
                datasource={'url': config.DATABASE_URL}
            )
        return cls._instance
        
    def connect(self):
        """Connect to the database."""
        if not self._client.is_connected():
            try:
                self._client.connect()
                logger.info("Connected to database")
            except PrismaError as e:
                logger.error(f"Database connection failed: {e}")
                raise
                
    def disconnect(self):
        """Disconnect from the database."""
        if self._client.is_connected():
            self._client.disconnect()
            logger.info("Disconnected from database")
            
    @property
    def client(self):
        """Get the Prisma client instance."""
        return self._client
        
    def __getattr__(self, name):
        """Proxy attribute access to the Prisma client."""
        return getattr(self._client, name)

# Create global prisma client instance
prisma = PrismaClient()
