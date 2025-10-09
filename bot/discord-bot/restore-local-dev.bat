@echo off
REM Script to restore pyproject.toml for local development on Windows
move pyproject.toml.local pyproject.toml
echo Restored pyproject.toml for local development
echo You can now use: poetry install && poetry run python run_bot.py
