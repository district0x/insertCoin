import json
import os
from web3 import Web3
import logging
from sqlalchemy import desc, or_, func
from database import get_db
from models import Match, MatchResult, Player, Tournament
from datetime import datetime
from decimal import Decimal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_next_match_id():
    web3 = Web3(Web3.HTTPProvider("https://sepolia.base.org"))
    with open("contractABI.json", "r") as abi_file:
        contract_abi = json.load(abi_file)
    contract_address = "0x7dA4854f9a90D4beC448BE597b1D0a632122f9Bd"

    # Create contract instance
    contract = web3.eth.contract(address=contract_address, abi=contract_abi)

    # Verify the connection
    if not web3.is_connected():
        logger.error("Failed to connect to the network")
        return None

    try:
        # Call the nextMatchId function
        next_match_id = contract.functions.nextMatchId().call()
        logger.info(f"Next match ID: {next_match_id}")
        return int(next_match_id)
    except Exception as e:
        logger.error(f"Contract logic error: {e}")
        return None


def insert_match_data(_, transaction_data):
    match_data = Match(
        match_id=transaction_data["match_id"],
        channel_id=transaction_data["channel_id"],
        player1_name=transaction_data["player1_name"],
        player2_name=transaction_data.get("player2_name"),
        match_amount_usd=transaction_data["match_amount_usd"],
        category=transaction_data["category"],
        platform=transaction_data["platform"],
        game=transaction_data["game"],
        discord_id=transaction_data["discord_id"],
    )

    try:
        with get_db() as db:
            db.add(match_data)
            db.flush()  # Flush to get the id without committing
            return match_data
    except Exception as e:
        logger.error(f"Exception when inserting match data: {str(e)}")
        return None


def get_channel_id_by_match_id(_, match_id):
    try:
        with get_db() as db:
            match = db.query(Match).filter(Match.match_id == match_id).first()
            return match.channel_id if match else None
    except Exception as e:
        logger.error(f"Error getting channel ID: {e}")
        return None


def get_player_wallet(_, discord_id):
    try:
        with get_db() as db:
            player = db.query(Player).filter(Player.discord_id == discord_id).first()
            if player:
                return {
                    "id": player.id,
                    "discord_id": player.discord_id,
                    "wallet_address": player.wallet_address,
                    "created_at": player.created_at,
                }
            return None
    except Exception as e:
        logger.error(f"Error getting player wallet: {e}")
        return None


def get_player_stats(_, discord_id):
    try:
        with get_db() as db:
            # Get wins
            wins = (
                db.query(MatchResult)
                .filter(MatchResult.winner_discord_id == discord_id)
                .count()
            )

            # Get losses
            losses = (
                db.query(MatchResult)
                .filter(MatchResult.loser_discord_id == discord_id)
                .count()
            )

            # Calculate total earnings
            total_earnings = db.query(func.sum(MatchResult.amount_won_usd)).filter(
                MatchResult.winner_discord_id == discord_id
            ).scalar() or Decimal("0")

            # Calculate win rate
            total_matches = wins + losses
            win_rate = (wins / total_matches * 100) if total_matches > 0 else 0

            return {
                "wins": wins,
                "losses": losses,
                "total_earnings_usd": float(total_earnings),
                "win_rate": round(win_rate, 2),
            }
    except Exception as e:
        logger.error(f"Error getting player stats: {e}")
        return None


def get_recent_matches(_, discord_id, limit=5):
    try:
        with get_db() as db:
            # Get matches where player was either winner or loser
            matches = (
                db.query(MatchResult, Match)
                .join(Match)
                .filter(
                    or_(
                        MatchResult.winner_discord_id == discord_id,
                        MatchResult.loser_discord_id == discord_id,
                    )
                )
                .order_by(desc(MatchResult.created_at))
                .limit(limit)
                .all()
            )

            formatted_matches = []
            for match_result, match in matches:
                # Determine opponent name
                opponent_name = (
                    match.player2_name
                    if match.player1_name == match_result.winner_discord_id
                    else match.player1_name
                )

                formatted_matches.append(
                    {
                        "game": match.game,
                        "platform": match.platform,
                        "winner_discord_id": match_result.winner_discord_id,
                        "opponent_name": opponent_name,
                        "amount_won_usd": float(match_result.amount_won_usd),
                        "created_at": match_result.created_at,
                    }
                )

            return formatted_matches
    except Exception as e:
        logger.error(f"Error getting recent matches: {e}")
        return None


def get_opponents_stats(_, discord_id, limit=5):
    try:
        with get_db() as db:
            # Get all matches for the player
            matches = (
                db.query(MatchResult)
                .filter(
                    or_(
                        MatchResult.winner_discord_id == discord_id,
                        MatchResult.loser_discord_id == discord_id,
                    )
                )
                .all()
            )

            # Process opponent statistics
            opponent_stats = {}
            for match in matches:
                opponent_id = (
                    match.loser_discord_id
                    if match.winner_discord_id == discord_id
                    else match.winner_discord_id
                )

                if opponent_id not in opponent_stats:
                    opponent_stats[opponent_id] = {"wins": 0, "losses": 0}

                if match.winner_discord_id == discord_id:
                    opponent_stats[opponent_id]["wins"] += 1
                else:
                    opponent_stats[opponent_id]["losses"] += 1

            # Format and sort by total matches
            formatted_stats = []
            for opponent_id, stats in opponent_stats.items():
                total_matches = stats["wins"] + stats["losses"]
                win_rate = (
                    (stats["wins"] / total_matches * 100) if total_matches > 0 else 0
                )

                # Get opponent info
                opponent = (
                    db.query(Player).filter(Player.discord_id == opponent_id).first()
                )
                opponent_name = opponent.discord_id if opponent else opponent_id

                formatted_stats.append(
                    {
                        "opponent_name": opponent_name,
                        "wins": stats["wins"],
                        "losses": stats["losses"],
                        "win_rate": round(win_rate, 2),
                    }
                )

            # Sort by total matches and return top N
            return sorted(
                formatted_stats, key=lambda x: (x["wins"] + x["losses"]), reverse=True
            )[:limit]
    except Exception as e:
        logger.error(f"Error getting opponent stats: {e}")
        return None
