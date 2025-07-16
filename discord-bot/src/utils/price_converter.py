"""Price conversion utilities for USD to ETH conversion."""

import logging
from typing import Optional
import requests

logger = logging.getLogger(__name__)

class PriceConverter:
    """Utility for converting USD to ETH and vice versa."""
    
    # Fallback ETH price (can be updated with real-time data)
    DEFAULT_ETH_PRICE_USD = 3000.0
    
    @classmethod
    def get_eth_price_usd(cls) -> float:
        """Get current ETH price in USD."""
        try:
            # Try to get real-time price from CoinGecko API
            response = requests.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={
                    "ids": "ethereum",
                    "vs_currencies": "usd"
                },
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                eth_price = data.get("ethereum", {}).get("usd")
                if eth_price:
                    logger.info(f"Current ETH price: ${eth_price}")
                    return float(eth_price)
            
            logger.warning("Failed to fetch ETH price, using fallback")
            return cls.DEFAULT_ETH_PRICE_USD
            
        except Exception as e:
            logger.error(f"Error fetching ETH price: {e}")
            return cls.DEFAULT_ETH_PRICE_USD
    
    @classmethod
    def usd_to_eth(cls, usd_amount: float, eth_price_usd: Optional[float] = None) -> float:
        """Convert USD amount to ETH."""
        if eth_price_usd is None:
            eth_price_usd = cls.get_eth_price_usd()
        
        if eth_price_usd <= 0:
            logger.error("Invalid ETH price")
            return 0.0
        
        eth_amount = usd_amount / eth_price_usd
        logger.info(f"Converted ${usd_amount} USD to {eth_amount:.6f} ETH (rate: ${eth_price_usd}/ETH)")
        return eth_amount
    
    @classmethod
    def eth_to_usd(cls, eth_amount: float, eth_price_usd: Optional[float] = None) -> float:
        """Convert ETH amount to USD."""
        if eth_price_usd is None:
            eth_price_usd = cls.get_eth_price_usd()
        
        usd_amount = eth_amount * eth_price_usd
        logger.info(f"Converted {eth_amount} ETH to ${usd_amount:.2f} USD (rate: ${eth_price_usd}/ETH)")
        return usd_amount
    
    @classmethod
    def format_eth_amount(cls, eth_amount: float) -> str:
        """Format ETH amount for display."""
        if eth_amount < 0.001:
            return f"{eth_amount:.8f} ETH"
        elif eth_amount < 1:
            return f"{eth_amount:.6f} ETH"
        else:
            return f"{eth_amount:.4f} ETH"
    
    @classmethod
    def format_usd_amount(cls, usd_amount: float) -> str:
        """Format USD amount for display."""
        return f"${usd_amount:.2f} USD" 