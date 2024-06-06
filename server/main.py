from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from supabase import create_client, Client
import requests
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Discord configuration
DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = Flask(__name__, static_folder="static")
CORS(app)


def get_channel_id(match_id: str) -> str:
    response = (
        supabase.table("matches")
        .select("channel_id")
        .eq("match_id", match_id)
        .single()
        .execute()
    )
    print(response)
    if response:
        return response.data["channel_id"]
    else:
        raise Exception(f"Error fetching channel ID: {response}")


def send_message_to_discord(channel_id: str, message: str) -> None:
    url = f"https://discord.com/api/v9/channels/{channel_id}/messages"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bot {DISCORD_TOKEN}",
    }
    payload = {"content": message}
    response = requests.post(url, headers=headers, json=payload)
    if response.status_code == 200:
        return "Message sent successfully!"
    else:
        raise Exception(
            f"Error sending message: {response.status_code} - {response.json()}"
        )


@app.route("/send-message", methods=["POST"])
def send_message():
    data = request.json
    match_id = data.get("match_id")
    message = data.get("message")

    if not match_id or not message:
        return jsonify({"error": "Missing match_id or message"}), 400

    try:
        channel_id = get_channel_id(match_id)
        result = send_message_to_discord(channel_id, message)
        return jsonify({"message": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/")
def serve_lobby():
    return send_from_directory(app.static_folder, "lobby.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 8080)))
