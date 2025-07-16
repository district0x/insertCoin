#!/usr/bin/env python3
"""
Simple script to run the Discord bot
"""
import asyncio
import sys
import os

# Add the src directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from bot.main import main

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print('Bot shutdown by user')
    except Exception as e:
        print(f'Bot error: {e}')
        import traceback
        traceback.print_exc() 