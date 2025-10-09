#!/usr/bin/env python3
"""
Simple health check server for Railway deployment
"""
import asyncio
import logging
from aiohttp import web
import threading
import time

logger = logging.getLogger(__name__)

class HealthServer:
    def __init__(self, port=8080):
        self.port = port
        self.app = web.Application()
        self.app.router.add_get('/health', self.health_check)
        self.app.router.add_get('/', self.health_check)
        self.server = None
        self.runner = None
        
    async def health_check(self, request):
        """Health check endpoint"""
        return web.Response(
            text='{"status": "healthy", "service": "discord-bot"}',
            content_type='application/json',
            status=200
        )
    
    async def start(self):
        """Start the health check server"""
        try:
            self.runner = web.AppRunner(self.app)
            await self.runner.setup()
            self.server = web.TCPSite(self.runner, '0.0.0.0', self.port)
            await self.server.start()
            logger.info(f"Health check server started on port {self.port}")
        except Exception as e:
            logger.error(f"Failed to start health check server: {e}")
    
    async def stop(self):
        """Stop the health check server"""
        if self.runner:
            await self.runner.cleanup()
            logger.info("Health check server stopped")

# Global health server instance
health_server = HealthServer()

async def start_health_server():
    """Start the health server in the background"""
    await health_server.start()

async def stop_health_server():
    """Stop the health server"""
    await health_server.stop()
