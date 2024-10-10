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
    contract_address = "0xA4dd8C402331721f7912AFA26793e00bBA3458B7"

    # Create contract instance
    contract = web3.eth.contract(address=contract_address, abi=contract_abi)

    # Verify the connection
    if web3.is_connected():
        try:
            # Call the nextMatchId function
            next_match_id = contract.functions.nextMatchId().call()
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
