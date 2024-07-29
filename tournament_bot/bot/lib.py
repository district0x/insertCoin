import json
import os
from web3 import Web3
from supabase import create_client, Client

# Initialize Supabase client


def initialize_supabase():
    SUPABASE_URL = os.getenv("SUPABASE_URL", "https://bqrkkxsfkpxyxflsqtlo.supabase.co")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY", "your-supabase-key")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return supabase


# Web3 configuration
WEB3_PROVIDER = os.getenv("WEB3_PROVIDER", "https://sepolia.base.org")
CONTRACT_ADDRESS = os.getenv(
    "CONTRACT_ADDRESS", "0xF01c34A37b37E7834dAC7e4EabE597996F3ADbf3"
)
CONTRACT_ABI_PATH = os.getenv("CONTRACT_ABI_PATH", "contractABI.json")

# Initialize web3
web3 = Web3(Web3.HTTPProvider(WEB3_PROVIDER))

# Load contract ABI


def load_contract_abi():
    with open(CONTRACT_ABI_PATH, "r") as abi_file:
        contract_abi = json.load(abi_file)
    return contract_abi


contract_abi = load_contract_abi()
contract = web3.eth.contract(address=CONTRACT_ADDRESS, abi=contract_abi)

# Function to get the next match ID


def get_next_tournament_id():
    if web3.is_connected():
        try:
            next_tournament_id = contract.functions.nextTournamentId().call()
            return next_tournament_id
        except Exception as e:
            return f"Contract logic error: {e}"
    else:
        return "Failed to connect to the network"


# Function to insert tournament data
def insert_tournament_data(supabase, tournament_id, data):
    response = (
        supabase.from_("tournaments")
        .insert(
            {
                "id": tournament_id,
                "num_entrants": data["num_entrants"],
                "winners_percentage": 0,
                "multisig_percentage": 0,
                "status": "open",
            }
        )
        .execute()
    )
    return response


# Function to insert entrant data
def insert_entrant_data(supabase, tournament_id, user_id):
    response = (
        supabase.from_("tournament_entrants")
        .insert({"tournament_id": tournament_id, "user_id": user_id})
        .execute()
    )
    return response


# Function to update tournament status
def update_tournament_status(supabase, tournament_id, status):
    response = (
        supabase.from_("tournaments")
        .update({"status": status})
        .eq("id", tournament_id)
        .execute()
    )
    return response


def insert_tournament_channel(supabase, tournament_id, channel_id):
    response = (
        supabase.table("tournament_channels")
        .insert(
            {
                "tournament_id": tournament_id,
                "channel_id": str(
                    channel_id
                ),  # Ensure channel_id is stored as a string
            }
        )
        .execute()
    )
    return response
