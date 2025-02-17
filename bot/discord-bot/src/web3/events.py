import asyncio
import logging
from typing import Callable, Dict, List, Optional

from web3 import Web3
from web3.contract import Contract
from web3.types import LogReceipt

from src.db.prisma import prisma
from src.utils.config import config
from src.web3.contract import contract

logger = logging.getLogger(__name__)

class EventListener:
    """Contract event listener class."""
    
    def __init__(self):
        self.contract = contract
        self.event_handlers: Dict[str, List[Callable]] = {
            'MatchCreated': [],
            'MatchJoined': [],
            'TeamJoined': [],
            'MatchCompleted': [],
            'MatchCancelled': []
        }
        
    def register_handler(self, event_name: str, handler: Callable):
        """Register an event handler."""
        if event_name not in self.event_handlers:
            raise ValueError(f"Unknown event: {event_name}")
        self.event_handlers[event_name].append(handler)
        
    async def handle_event(self, event: LogReceipt):
        """Handle a contract event."""
        try:
            event_name = event['event']
            if event_name not in self.event_handlers:
                logger.warning(f"No handlers for event: {event_name}")
                return
                
            for handler in self.event_handlers[event_name]:
                try:
                    await handler(event['args'])
                except Exception as e:
                    logger.error(f"Error in event handler: {e}", exc_info=True)
                    
        except Exception as e:
            logger.error(f"Error handling event: {e}", exc_info=True)
            
    async def start_listening(self):
        """Start listening for contract events."""
        try:
            # Initialize Web3 contract
            self.contract.connect()
            
            # Get all event filters
            filters = {
                'MatchCreated': self.contract.contract.events.MatchCreated.create_filter(fromBlock='latest'),
                'MatchJoined': self.contract.contract.events.MatchJoined.create_filter(fromBlock='latest'),
                'TeamJoined': self.contract.contract.events.TeamJoined.create_filter(fromBlock='latest'),
                'MatchCompleted': self.contract.contract.events.MatchCompleted.create_filter(fromBlock='latest'),
                'MatchCancelled': self.contract.contract.events.MatchCancelled.create_filter(fromBlock='latest')
            }
            
            while True:
                for event_name, event_filter in filters.items():
                    try:
                        for event in event_filter.get_new_entries():
                            await self.handle_event(event)
                    except Exception as e:
                        logger.error(f"Error getting {event_name} events: {e}")
                        
                await asyncio.sleep(1)  # Poll interval
                
        except Exception as e:
            logger.error(f"Error in event listener: {e}", exc_info=True)
            raise
            
    async def stop_listening(self):
        """Stop listening for contract events."""
        # Cleanup code here if needed
        pass

# Default event handlers
async def handle_match_created(event_args):
    """Handle MatchCreated event."""
    try:
        match_id = event_args['matchId']
        creator = event_args['creator']
        
        # Update match in database
        await prisma.match.update_many(
            where={
                "matchId": match_id
            },
            data={
                "status": "OPEN"
            }
        )
        
        logger.info(f"Match {match_id} created by {creator}")
        
    except Exception as e:
        logger.error(f"Error handling MatchCreated event: {e}", exc_info=True)
        
async def handle_match_joined(event_args):
    """Handle MatchJoined event."""
    try:
        match_id = event_args['matchId']
        player = event_args['player']
        
        # Update match in database
        match = await prisma.match.find_first(
            where={
                "matchId": match_id
            }
        )
        
        if not match:
            logger.error(f"Match {match_id} not found in database")
            return
            
        # Create or update team membership
        await prisma.team.update(
            where={
                "matchId": match.id
            },
            data={
                "members": {
                    "connect": {
                        "address": player
                    }
                }
            }
        )
        
        logger.info(f"Player {player} joined match {match_id}")
        
    except Exception as e:
        logger.error(f"Error handling MatchJoined event: {e}", exc_info=True)
        
async def handle_match_completed(event_args):
    """Handle MatchCompleted event."""
    try:
        match_id = event_args['matchId']
        winner = event_args['winner']
        
        # Update match in database
        await prisma.match.update_many(
            where={
                "matchId": match_id
            },
            data={
                "status": "COMPLETED",
                "winnerAddress": winner
            }
        )
        
        logger.info(f"Match {match_id} completed, winner: {winner}")
        
    except Exception as e:
        logger.error(f"Error handling MatchCompleted event: {e}", exc_info=True)

# Create global event listener instance
event_listener = EventListener()

# Register default handlers
event_listener.register_handler('MatchCreated', handle_match_created)
event_listener.register_handler('MatchJoined', handle_match_joined)
event_listener.register_handler('MatchCompleted', handle_match_completed)
