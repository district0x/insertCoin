import logging
from typing import Dict, Optional
from datetime import datetime, timedelta
import asyncio
from web3 import Web3
from eth_account import Account

logger = logging.getLogger(__name__)

class TransactionVerificationService:
    def __init__(self, rpc_url: str, verification_address: str):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        self.verification_address = verification_address.lower()
        self.verification_amount = Web3.to_wei(0.001, 'ether')  # 0.001 ETH
        
    async def verify_transaction(
        self,
        tx_hash: str,
        expected_from_address: Optional[str] = None
    ) -> Dict:
        """
        Verify a transaction on the blockchain.
        
        Args:
            tx_hash: Transaction hash to verify
            expected_from_address: Expected sender address (optional)
            
        Returns:
            Dict with verification result
        """
        try:
            # Get transaction details
            tx = await self.get_transaction(tx_hash)
            if not tx:
                return {
                    "success": False,
                    "error": "Transaction not found or not confirmed"
                }
            
            # Check if transaction is recent (within 24 hours)
            if not self.is_transaction_recent(tx):
                return {
                    "success": False,
                    "error": "Transaction is too old (must be within 24 hours)"
                }
            
            # Verify recipient address
            if tx['to'].lower() != self.verification_address:
                return {
                    "success": False,
                    "error": f"Transaction sent to wrong address. Expected: {self.verification_address}"
                }
            
            # Verify amount
            if int(tx['value']) != self.verification_amount:
                return {
                    "success": False,
                    "error": f"Wrong amount sent. Expected: {Web3.from_wei(self.verification_amount, 'ether')} ETH"
                }
            
            # Verify sender address if provided
            if expected_from_address:
                if tx['from'].lower() != expected_from_address.lower():
                    return {
                        "success": False,
                        "error": "Transaction not sent from expected wallet"
                    }
            
            # All checks passed
            return {
                "success": True,
                "wallet_address": tx['from'],
                "amount": Web3.from_wei(tx['value'], 'ether'),
                "timestamp": datetime.fromtimestamp(tx['timestamp']),
                "block_number": tx['blockNumber']
            }
            
        except Exception as e:
            logger.error(f"Error verifying transaction {tx_hash}: {e}")
            return {
                "success": False,
                "error": f"Verification failed: {str(e)}"
            }
    
    async def get_transaction(self, tx_hash: str) -> Optional[Dict]:
        """Get transaction details from blockchain."""
        try:
            # Get transaction receipt
            receipt = self.w3.eth.get_transaction_receipt(tx_hash)
            if not receipt or receipt['status'] != 1:
                return None
            
            # Get transaction details
            tx = self.w3.eth.get_transaction(tx_hash)
            if not tx:
                return None
            
            # Get block timestamp
            block = self.w3.eth.get_block(tx['blockNumber'])
            if not block:
                return None
            
            # Add timestamp to transaction
            tx['timestamp'] = block['timestamp']
            
            return tx
            
        except Exception as e:
            logger.error(f"Error getting transaction {tx_hash}: {e}")
            return None
    
    def is_transaction_recent(self, tx: Dict) -> bool:
        """Check if transaction is recent (within 24 hours)."""
        try:
            tx_timestamp = datetime.fromtimestamp(tx['timestamp'])
            cutoff_time = datetime.now() - timedelta(hours=24)
            return tx_timestamp > cutoff_time
        except Exception as e:
            logger.error(f"Error checking transaction timestamp: {e}")
            return False
    
    def validate_transaction_hash(self, tx_hash: str) -> bool:
        """Validate transaction hash format."""
        try:
            if not tx_hash.startswith('0x'):
                return False
            if len(tx_hash) != 66:
                return False
            # Try to convert to bytes to validate format
            self.w3.to_bytes(hexstr=tx_hash)
            return True
        except Exception:
            return False
    
    def get_verification_info(self) -> Dict:
        """Get verification requirements info."""
        return {
            "verification_address": self.verification_address,
            "verification_amount": Web3.from_wei(self.verification_amount, 'ether'),
            "amount_in_wei": self.verification_amount,
            "network": self.w3.eth.chain_id
        }

# Example usage:
# service = TransactionVerificationService(
#     rpc_url="https://mainnet.infura.io/v3/YOUR_PROJECT_ID",
#     verification_address="0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"
# )
# 
# result = await service.verify_transaction("0x1234...")
# if result["success"]:
#     print(f"Wallet verified: {result['wallet_address']}")
# else:
#     print(f"Verification failed: {result['error']}") 