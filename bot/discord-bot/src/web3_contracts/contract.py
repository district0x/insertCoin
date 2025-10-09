import json
import logging
from pathlib import Path
from typing import Optional

from eth_account.messages import encode_defunct
from web3 import Web3
from web3.contract import Contract
from web3.exceptions import ContractLogicError

from src.utils.config import config

logger = logging.getLogger(__name__)

class ContractClient:
    """Web3 contract client singleton class."""
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._contract = None
            cls._instance._w3 = None
            cls._instance._abi = None
        return cls._instance
        
    def connect(self):
        """Connect to the blockchain and initialize contract."""
        try:
            logger.info(f"Connecting to RPC endpoint: {config.RPC_URL}")
            self._w3 = Web3(Web3.HTTPProvider(config.RPC_URL))
            if not self._w3.is_connected():
                raise ConnectionError("Failed to connect to RPC endpoint")
            logger.info("Successfully connected to RPC endpoint")
                
            # Load contract ABI if not already loaded
            if self._abi is None:
                abi_path = Path(__file__).parent / 'abi.json'
                logger.info(f"Loading ABI from: {abi_path}")
                with open(abi_path) as f:
                    self._abi = json.load(f)
                logger.info("ABI loaded successfully")
                
            # Initialize contract
            logger.info(f"Initializing contract at address: {config.CONTRACT_ADDRESS}")
            self._contract = self._w3.eth.contract(
                address=config.CONTRACT_ADDRESS,
                abi=self._abi
            )
            
            # Test contract connection
            try:
                next_match_id = self._contract.functions.nextMatchId().call()
                logger.info(f"Contract initialized successfully. Next match ID: {next_match_id}")
            except Exception as e:
                logger.warning(f"Failed to call nextMatchId: {e}")
                logger.warning("Contract may not be deployed or initialized. Bot will continue with limited functionality.")
                # Don't raise the exception, just log the warning
                # This allows the bot to start even if the contract isn't available
            
        except Exception as e:
            logger.error(f"Failed to initialize Web3 contract: {e}", exc_info=True)
            self._w3 = None
            self._contract = None
            raise

    def ensure_connection(self):
        """Ensure we have a valid connection, reconnect if necessary."""
        try:
            if self._w3 is None or not self._w3.is_connected():
                logger.info("No active connection, reconnecting...")
                self.connect()
            else:
                # Test connection with a simple call
                try:
                    self._w3.eth.block_number
                except Exception:
                    logger.info("Connection stale, reconnecting...")
                    self.connect()
        except Exception as e:
            logger.error(f"Error ensuring connection: {e}")
            raise
                
    @property
    def contract(self) -> Contract:
        """Get the Web3 contract instance, ensuring connection is active."""
        self.ensure_connection()
        if self._contract is None:
            raise RuntimeError("Contract not initialized. Call connect() first.")
        return self._contract
        
    @property
    def w3(self) -> Web3:
        """Get the Web3 instance, ensuring connection is active."""
        self.ensure_connection()
        if self._w3 is None:
            raise RuntimeError("Web3 not initialized. Call connect() first.")
        return self._w3
        
    def verify_wallet(self, address: str, signature: str, message: str = None) -> bool:
        """Verify wallet ownership using signature."""
        try:
            self.ensure_connection()
            
            # Use custom message if provided, otherwise use default
            if message is None:
                message = f"Link Discord account to wallet {address}"
            
            # Create message hash
            message_hash = encode_defunct(text=message)
            
            # Recover signer address
            signer = self.w3.eth.account.recover_message(
                message_hash,
                signature=signature
            )
            
            return signer.lower() == address.lower()
            
        except Exception as e:
            logger.error(f"Error verifying wallet signature: {e}")
            return False
            
    async def create_match(self, match_type: str, stake: float = 0) -> int:
        """Create a match on the blockchain."""
        try:
            self.ensure_connection()
            # Convert match type to contract enum
            type_mapping = {
                "1v1": 0,
                "2v2": 1,
                "5v5": 2
            }
            match_type_enum = type_mapping.get(match_type.lower())
            if match_type_enum is None:
                raise ValueError(f"Invalid match type: {match_type}")
                
            # Convert stake to Wei
            stake_wei = self.w3.to_wei(stake, 'ether')
            
            # Call contract method
            tx_hash = await self.contract.functions.createMatch(
                match_type_enum,
                stake_wei
            ).transact()
            
            # Wait for transaction receipt
            receipt = await self.w3.eth.wait_for_transaction_receipt(tx_hash)
            
            # Get match ID from event
            match_created_event = self.contract.events.MatchCreated().process_receipt(receipt)
            if not match_created_event:
                raise ContractLogicError("Match creation event not found")
                
            return match_created_event[0]['args']['matchId']
            
        except Exception as e:
            logger.error(f"Error creating match on blockchain: {e}")
            raise
            
    async def get_match_status(self, match_id: int) -> dict:
        """Get match status from the blockchain."""
        try:
            self.ensure_connection()
            match_data = await self.contract.functions.matches(match_id).call()
            return {
                'status': match_data[0],
                'matchType': match_data[1],
                'stake': self.w3.from_wei(match_data[2], 'ether'),
                'totalPrize': self.w3.from_wei(match_data[3], 'ether'),
                'winner': match_data[4]
            }
        except Exception as e:
            logger.error(f"Error getting match status: {e}")
            raise

# Create global contract client instance
contract = ContractClient()
