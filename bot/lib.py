import json
import os
from web3 import Web3
from supabase import create_client, Client
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def initialize_supabase():
    SUPABASE_URL = "https://lyjimsetpystcpprjxac.supabase.co"
    SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5amltc2V0cHlzdGNwcHJqeGFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTk5MjM1OTMsImV4cCI6MjAzNTQ5OTU5M30.Bk4sroHIT5tmaPO9r4fRKBv5ZrvyOxBRn2xIgsuFA28"
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return supabase


def get_next_match_id():
    web3 = Web3(Web3.HTTPProvider("https://sepolia.base.org"))
    with open("contractABI.json", "r") as abi_file:
        contract_abi = json.load(abi_file)
    contract_address = "0x7dA4854f9a90D4beC448BE597b1D0a632122f9Bd"

    # Create contract instance
    contract = web3.eth.contract(address=contract_address, abi=contract_abi)

    # Verify the connection
    if web3.is_connected():
        try:
            # Call the nextMatchId function
            next_match_id = contract.functions.nextMatchId().call()
            logger.info(f"Next match ID: {next_match_id}")
            return int(next_match_id)
        except Exception as e:
            return f"Contract logic error: {e}"
    else:
        return "Failed to connect to the network"


def insert_match_data(supabase, transaction_data):
    match_data = {
        "match_id": transaction_data["match_id"],
        "channel_id": transaction_data["channel_id"],
        "player1_name": transaction_data["player1_name"],
        "player2_name": transaction_data.get("player2_name"),  # This can be None
        "match_amount_usd": transaction_data["match_amount_usd"],
        "category": transaction_data["category"],
        "platform": transaction_data["platform"],
        "game": transaction_data["game"],
        "discord_id": transaction_data["discord_id"],  # Store the Discord ID
    }

    try:
        response = supabase.table("matches").insert(match_data).execute()
        logger.info(f"Insert response: {response}")
        if response.data:
            return response
        else:
            logger.error(f"Error inserting match data: No data returned")
            return None
    except Exception as e:
        logger.error(f"Exception when inserting match data: {str(e)}")
        return None


def get_channel_id_by_match_id(supabase, match_id):
    response = (
        supabase.table("matches")
        .select("channel_id")
        .eq("match_id", match_id)
        .single()
        .execute()
    )
    if response.data:
        return response.data[0]["channel_id"]
    return None


def get_player_wallet(supabase, discord_id):
    try:
        response = (
            supabase.table("players")
            .select("*")
            .eq("discord_id", discord_id)
            .single()
            .execute()
        )
        return response.data if response.data else None
    except Exception as e:
        logger.error(f"Error getting player wallet: {e}")
        return None


def get_player_stats(supabase, discord_id):
    try:
        # Get wins
        wins = (
            supabase.table("match_results")
            .select("*")
            .eq("winner_discord_id", discord_id)
            .execute()
        )
        wins_count = len(wins.data)

        # Get losses
        losses = (
            supabase.table("match_results")
            .select("*")
            .eq("loser_discord_id", discord_id)
            .execute()
        )
        losses_count = len(losses.data)

        # Calculate total earnings
        total_earnings = (
            sum(float(match["amount_won_usd"]) for match in wins.data)
            if wins.data
            else 0
        )

        # Calculate win rate
        total_matches = wins_count + losses_count
        win_rate = (wins_count / total_matches * 100) if total_matches > 0 else 0

        return {
            "wins": wins_count,
            "losses": losses_count,
            "total_earnings_usd": total_earnings,
            "win_rate": round(win_rate, 2),
        }
    except Exception as e:
        logger.error(f"Error getting player stats: {e}")
        return None


def get_recent_matches(supabase, discord_id, limit=5):
    try:
        # Get matches where player was either winner or loser
        matches = (
            supabase.table("match_results")
            .select("*, matches(game, platform)")
            .or_(f"winner_discord_id.eq.{discord_id},loser_discord_id.eq.{discord_id}")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )

        formatted_matches = []
        for match in matches.data:
            # Get opponent name from matches table
            opponent_query = (
                supabase.table("matches")
                .select("player1_name, player2_name")
                .eq("match_id", match["match_id"])
                .single()
                .execute()
            )

            opponent_data = opponent_query.data
            opponent_name = (
                opponent_data["player2_name"]
                if opponent_data["player1_name"] == ctx.author.name
                else opponent_data["player1_name"]
            )

            formatted_matches.append(
                {
                    "game": match["matches"]["game"],
                    "platform": match["matches"]["platform"],
                    "winner_discord_id": match["winner_discord_id"],
                    "opponent_name": opponent_name,
                    "amount_won_usd": match["amount_won_usd"],
                    "created_at": match["created_at"],
                }
            )

        return formatted_matches
    except Exception as e:
        logger.error(f"Error getting recent matches: {e}")
        return None


def get_opponents_stats(supabase, discord_id, limit=5):
    try:
        # Get all matches for the player
        matches = (
            supabase.table("match_results")
            .select("*")
            .or_(f"winner_discord_id.eq.{discord_id},loser_discord_id.eq.{discord_id}")
            .execute()
        )

        # Process opponent statistics
        opponent_stats = {}
        for match in matches.data:
            opponent_id = (
                match["loser_discord_id"]
                if match["winner_discord_id"] == discord_id
                else match["winner_discord_id"]
            )

            if opponent_id not in opponent_stats:
                opponent_stats[opponent_id] = {"wins": 0, "losses": 0}

            if match["winner_discord_id"] == discord_id:
                opponent_stats[opponent_id]["wins"] += 1
            else:
                opponent_stats[opponent_id]["losses"] += 1

        # Format and sort by total matches
        formatted_stats = []
        for opponent_id, stats in opponent_stats.items():
            total_matches = stats["wins"] + stats["losses"]
            win_rate = (stats["wins"] / total_matches * 100) if total_matches > 0 else 0

            # Get opponent name
            opponent_data = (
                supabase.table("players")
                .select("discord_id")
                .eq("discord_id", opponent_id)
                .single()
                .execute()
            )

            formatted_stats.append(
                {
                    "opponent_name": opponent_data.data["discord_id"],
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
