import logging
import time
from contextlib import contextmanager
from typing import Optional

from prisma import Prisma
from prisma.errors import PrismaError

from src.utils.config import config

logger = logging.getLogger(__name__)

class PrismaClient:
    """Enhanced Prisma client with connection management."""
    
    def __init__(self):
        self._client: Optional[Prisma] = None
        self._connection_string: Optional[str] = None
        
    def connect(self, connection_string: str):
        """Initialize Prisma client with connection string."""
        try:
        # Add PostgreSQL parameters to prevent prepared statement conflicts
        # These parameters help resolve the "prepared statement s0 already exists" error
        if '?' not in connection_string:
            connection_string += '?'
        else:
            connection_string += '&'
        
        # Add parameters to disable prepared statements and force fresh connections
        connection_string += 'prepared_statements=false&connection_limit=1&pool_timeout=20&connect_timeout=20'
        
        self._connection_string = connection_string
        
        # Add connection parameters to prevent prepared statement conflicts
        # These parameters help resolve the "prepared statement s0 already exists" error
        connection_params = {
            'url': connection_string,
            'connection_limit': 1,  # Limit connections to prevent conflicts
            'pool_timeout': 20,     # Timeout for connection pool
            'connect_timeout': 20,  # Timeout for initial connection
        }
        
        self._client = Prisma(datasource=connection_params)
        self._client.connect()
        logger.info("Prisma client connected")
            
            # Test the connection by trying to access a model
            if not hasattr(self._client, 'user'):
                raise RuntimeError("Prisma client not properly initialized - user model not found")
                
        except Exception as e:
            logger.error(f"Failed to connect Prisma client: {e}")
            self._client = None
            raise RuntimeError(f"Database connection failed: {e}")
        
    def disconnect(self):
        """Disconnect Prisma client."""
        if self._client:
            self._client.disconnect()
            self._client = None
            logger.info("Prisma client disconnected")
            
    def reset_connection(self):
        """Reset the connection by disconnecting and reconnecting."""
        if self._client:
            logger.info("Resetting Prisma connection...")
            self.disconnect()
            time.sleep(1)  # Brief pause to allow connection cleanup
            if self._connection_string:
                self.connect(self._connection_string)
                
    @contextmanager
    def transaction(self):
        """Context manager for database transactions with proper error handling."""
        if not self._client:
            raise RuntimeError("Prisma client not connected")
            
        try:
            with self._client.tx() as transaction:
                yield transaction
        except Exception as e:
            logger.error(f"Transaction failed: {e}")
            raise
            
    def __getattr__(self, name):
        """Delegate attribute access to the underlying Prisma client."""
        if not self._client:
            raise RuntimeError(f"Prisma client not connected. Cannot access '{name}'. Make sure database connection is initialized.")
        return getattr(self._client, name)
        
    def __enter__(self):
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.disconnect()

# Create global prisma client instance
prisma = PrismaClient()
