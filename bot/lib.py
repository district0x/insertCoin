import json
import os
from web3 import Web3
from supabase import create_client, Client

def initialize_supabase():
    SUPABASE_URL = 'https://bqrkkxsfkpxyxflsqtlo.supabase.co'
    SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxcmtreHNma3B4eXhmbHNxdGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTcwMTI4MDUsImV4cCI6MjAzMjU4ODgwNX0.cK5UruJIJttzBYi5qSttFKCbETtkpvv-oj-EVJM1vKU'
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return supabase

def get_next_match_id():
    # Initialize web3 connection
    web3 = Web3(Web3.HTTPProvider('https://sepolia.base.org'))

    # Load contract ABI from JSON file
    with open('contractABI.json', 'r') as abi_file:
        contract_abi = json.load(abi_file)

    # Contract address
    contract_address = '0x8d7b8A8ba6f29615810FAd89Fe2F34c359784De9'

    # Create contract instance
    contract = web3.eth.contract(address=contract_address, abi=contract_abi)

    # Verify the connection
    if web3.is_connected():
        try:
            # Call the nextMatchId function
            next_match_id = contract.functions.nextMatchId().call()
            return next_match_id
        except Exception as e:
            return f"Contract logic error: {e}"
    else:
        return "Failed to connect to the network"

def insert_match_data(supabase, match_id, channel_id):
    response = supabase.table('matches').insert({
        "match_id": match_id,
        "channel_id": channel_id
    }).execute()
    return response

def get_channel_id_by_match_id(supabase, match_id):
    response = supabase.table('matches').select('channel_id').eq('match_id', match_id).single().execute()
    if response.data:
        return response.data[0]['channel_id']
    return None
