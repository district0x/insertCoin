#!/usr/bin/env python3
"""
Script to restart the bot with Poetry and ensure updated code is loaded.
"""

import subprocess
import sys
import os

def restart_bot():
    """Restart the bot with Poetry."""
    print("🔄 Restarting bot with updated code...")
    
    # Change to the bot directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Clear Python cache
    print("🧹 Clearing Python cache...")
    subprocess.run([sys.executable, "-Bc", "import compileall; compileall.compile_dir('.', force=True)"], 
                   capture_output=True)
    
    # Start the bot with Poetry
    print("🚀 Starting bot with Poetry...")
    try:
        subprocess.run(["poetry", "run", "python", "-m", "src.bot.main"], check=True)
    except KeyboardInterrupt:
        print("\n⏹️ Bot stopped by user")
    except subprocess.CalledProcessError as e:
        print(f"❌ Error starting bot: {e}")

if __name__ == "__main__":
    restart_bot() 