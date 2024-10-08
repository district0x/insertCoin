from openai import OpenAI
import logging
from APICounter import APICounter
import os
import sys
import requests
import discord
from discord.ext import commands
from discord.commands import Option
import logging
import openai
from pinecone import Pinecone, ServerlessSpec
import time
import datetime
import urllib.parse
from dotenv import load_dotenv
from discord.ui import Button, View
import tracemalloc
from config_strings import (
    primer,
    primer_messages,
    tournament_primer,
    match_primer_no_items,
    match_primer,
    tournament_primer_no_items,
    unidentified_prompt_message,
)

from lib import get_next_match_id, initialize_supabase, insert_match_data
import os

supabase = initialize_supabase()

tracemalloc.start()

# Add the parent directory to the import search path
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(parent_dir)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("iscoin_gpt")

load_dotenv()
# Get the value of environment variables
iscoinGPT_token = os.getenv("ISCOIN_GPT_TOKEN")
iscoinGPT_client_id = os.getenv("ISCOIN_GPT_CLIENT_ID")
openai_api_key = os.getenv("OPENAI_API_KEY")

logger.info("Loading environment variables.")
logger.info(f"OpenAI API Key: {openai_api_key}")


client = OpenAI()

# Define the OpenAI embedding model to use
openai_embed_model = "text-embedding-ada-002"

# Initialize Pinecone
pinecone_api_key = os.getenv("PINECONE_API_KEY")
pinecone_namespace = os.getenv("PINECONE_NAMESPACE")
logger.info(f"Pinecone API Key: {pinecone_api_key}")
pc = Pinecone(api_key=pinecone_api_key)

max_uses_per_day = int(os.getenv("MAX_USES_PER_DAY"))
admin_user_id = int(os.getenv("ADMIN_USER_ID"))
min_pinecone_score = float(os.getenv("MIN_PINECONE_SCORE"))

# Pinecone index name
pinecone_index_name = os.getenv("PINECONE_INDEX_NAME")
logger.info(f"Pinecone Index Name: {pinecone_index_name}")

try:
    # Fetch and store Pinecone index names
    pinecone_indexes = pc.list_indexes().names()
    logger.info(f"Pinecone indexes: {pinecone_indexes}")
except Exception as e:
    logger.error(f"Error fetching Pinecone indexes: {e}")
    pinecone_indexes = []  # Initialize as empty list in case of an error

try:
    if pinecone_index_name not in pinecone_indexes:
        logger.info("Creating Pinecone index...")
        pc.create_index(
            name=pinecone_index_name,
            dimension=1536,
            metric="cosine",
            spec=ServerlessSpec(cloud="gcp", region="northamerica-northeast1"),
        )
    index = pc.Index(name=pinecone_index_name)
    logger.info("Connected to Pinecone index.")
except Exception as e:
    logger.error(f"Error in Pinecone index initialization: {e}")

intents = discord.Intents.default()
intents.messages = True
intents.guilds = True
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)

max_prompt_length = 1000

api_counter = APICounter(max_uses_per_day)


class CustomHelpCommand(commands.DefaultHelpCommand):
    pass


bot.help_command = CustomHelpCommand()

lobbies = {}  # Dictionary to store lobby information


async def getNextLobbyId():
    if not lobbies:
        return 1  # If no lobbies exist, start with lobby ID 1
    else:
        return max(lobbies.keys()) + 1  # Increment the maximum lobby ID by 1


class AcceptButton(Button):
    def __init__(
        self, label, style, custom_id, challenge_creator_id, channel, transaction_data
    ):
        super().__init__(label=label, style=style, custom_id=custom_id)
        self.challenge_creator_id = challenge_creator_id
        self.channel = channel
        self.transaction_data = transaction_data

    async def callback(self, interaction: discord.Interaction):
        try:
            # Defer the response immediately
            await interaction.response.defer(ephemeral=True)

            guild = interaction.guild
            challenge_creator = guild.get_member(self.challenge_creator_id)
            channel = guild.get_channel(self.channel)

            # Set up permissions to make the channel private
            overwrites = {
                guild.default_role: discord.PermissionOverwrite(read_messages=False),
                guild.me: discord.PermissionOverwrite(read_messages=True),
                challenge_creator: discord.PermissionOverwrite(read_messages=True),
                interaction.user: discord.PermissionOverwrite(read_messages=True),
            }

            # Modify the existing channel's permissions to make it private
            await channel.edit(overwrites=overwrites)
            await channel.send(
                f"{challenge_creator.mention} and {interaction.user.mention}, your private match channel is ready!"
            )

            # Update the transaction_data with player2 information
            self.transaction_data["player2_name"] = str(interaction.user.display_name) 

            # Send a message asking Player 1 to start the match
            await channel.send(
                f"{challenge_creator.mention}, please start the match on the 1v1 frontpage."
            )

            # Use followup.send instead of response.send_message
            await interaction.followup.send(
                f"Your private match channel {channel.mention} is ready!",
                ephemeral=True
            )

        except discord.errors.NotFound:
            logging.error("Interaction not found. It may have expired.")
            # Optionally, you can try to send a message to the channel directly
            try:
                await channel.send(f"{interaction.user.mention}, there was an issue processing your request. The match has been accepted, but there might be some delays.")
            except:
                logging.error("Failed to send fallback message to the channel.")

        except Exception as e:
            logging.error(f"An error occurred in AcceptButton callback: {str(e)}")
            # Optionally, you can try to send an error message to the channel
            try:
                await channel.send(f"An error occurred while processing the match acceptance. Please try again or contact an administrator.")
            except:
                logging.error("Failed to send error message to the channel.")

@bot.event
async def on_private_channel_created(channel, player1, player2, transaction_data):
    transaction_url = generate_transaction_url(transaction_data)
    embed = discord.Embed(
        title="Transaction Link",
        description="Please confirm the transaction for this match.",
        color=0x00FF00,
    )
    embed.add_field(
        name="Transaction",
        value=f"[Confirm Transaction]({transaction_url})",
        inline=False,
    )
    await channel.send(
        content=f"{player1.mention} and {player2.mention}, please complete the transaction:",
        embed=embed,
    )


def generate_transaction_url(data):
    base_url = "http://localhost:8000/lobby.html"
    query_params = urllib.parse.urlencode(
        {
            "player1": data["player1_name"],
            "player2": data["player2_name"],
            "player1_wallet": data["player1_wallet"],
            "player2_wallet": data["player2_wallet"],
            "match_amount_usd": str(data["match_amount_usd"]),
        }
    )
    return f"{base_url}?{query_params}"


game_choices = {
    "Sports": ["FIFA 23", "NBA 2K23", "Madden NFL 23"],
    "Fighting": [
        "Street Fighter 6",
        "Tekken 8",
        "Mortal Kombat 12",
        "Guilty Gear Strive",
        "DNF Duel",
        "Dragon Ball FighterZ",
    ],
    "Racing": [
        "Forza Motorsport",
        "Gran Turismo 7",
        "Need for Speed Unbound",
        "F1 23",
        "Dirt 5",
    ],
}


async def get_game_choices(ctx):
    category = ctx.options["category"]
    return game_choices[category]

@bot.slash_command(
    name="1v1", description="Start a 1v1 challenge.", force_registration=True
)
async def one_v_one(
    ctx,
    platform: Option(str, "Choose your platform", choices=["PS5", "PC"], required=True),
    category: Option(
        str,
        "Choose the game category",
        choices=["Sports", "Fighting", "Racing"],
        required=True,
    ),
    game: Option(str, "Choose the game", autocomplete=get_game_choices, required=True),
    match_amount_usd: Option(int, "Enter the match amount in USD", required=True),
):
    # Defer the response immediately
    await ctx.defer()

    channel = await ctx.guild.create_text_channel(
        name=f"1v1-{ctx.author.display_name}-{platform}-{game}"
    )

    match_id = get_next_match_id()
    if isinstance(match_id, str):
        match_id = "12345"  # Use default if there's an error

    # Insert match data into Supabase
    insert_result = insert_match_data(supabase, match_id, str(channel.id))
    if insert_result is None:
        await ctx.followup.send("There was an error creating the match. Please try again later.")
        return

    transaction_data = {
        "player1_name": str(ctx.author.display_name),
        "player2_name": None,
        "player1_wallet": None,
        "player2_wallet": None,
        "match_id": match_id,
        "match_amount_usd": int(match_amount_usd),
        "platform": platform,
        "category": category,
        "game": game,
        "channel_id": str(channel.id)
    }

    # Create a link to the 1v1 frontpage
    frontpage_link = "https://1v1-three.vercel.app/"

    # Send the message with parameters and link
    await channel.send(
        f"1v1 Match Parameters:\n"
        f"Platform: {platform}\n"
        f"Category: {category}\n"
        f"Game: {game}\n"
        f"Match Amount: ${match_amount_usd}\n\n"
        f"{ctx.author.mention}, please start the match"
        f"1v1 Frontpage: {frontpage_link}"
    )

    view = View()
    button = AcceptButton(
        "Accept Challenge",
        discord.ButtonStyle.green,
        "accept_1v1",
        ctx.author.id,
        channel.id,
        transaction_data,
    )
    view.add_item(button)
    
    # Use followup.send instead of respond
    await ctx.followup.send(
        f"{ctx.author.mention} has initiated a 1v1 challenge for {game} on {platform} with a match amount of ${match_amount_usd}. Waiting for an opponent!",
        view=view,
    )

@bot.slash_command(name="record", description="Fetch your post history.")
async def record(ctx):
    await ctx.defer()  # Acknowledge the interaction to avoid timeout

    user_id = str(ctx.author.id)
    print(user_id)
    vector = (
        client.embeddings.create(
            input=["1v1 challenge"],
            model=openai_embed_model,
        )
        .data[0]
        .embedding
    )
    try:
        index = pc.Index(pinecone_index_name)
        pine_res = index.query(
            # namespace=pinecone_namespace,
            vector=vector,
            filter={
                "author_id": {"$eq": user_id},
            },
            top_k=100,  # Adjust this number based on how many records you want to fetch
            include_metadata=True,
        )

        matches = pine_res["matches"]
        if not matches:
            await ctx.send_followup("No post history found.")
            return

        # Sort matches by timestamp and get the 5 latest matches
        sorted_matches = sorted(
            matches, key=lambda x: x["metadata"]["timestamp"], reverse=True
        )[:5]

        formatted_matches = "\n\n".join(
            [
                f"**Summary:** {item['metadata']['text']}\n"
                f"**Game:** {item['metadata']['game']}\n"
                f"**Platform:** {item['metadata']['platform']}\n"
                f"**Match Amount:** ${item['metadata']['match_amount_usd']}\n"
                # f"**Timestamp:** {item['metadata']['timestamp']}"
                for item in sorted_matches
            ]
        )

        await ctx.send_followup(f"Your post history:\n\n{formatted_matches}")
    except Exception as e:
        logger.error(f"Error fetching post history: {e}")
        await ctx.send_followup(
            "An error occurred while fetching your post history. Please try again later."
        )


def time_ago(timestamp):
    dt = datetime.datetime.fromtimestamp(timestamp)
    now = datetime.datetime.now()
    time_diff = now - dt
    days_ago = time_diff.days
    hours_ago, remainder = divmod(time_diff.seconds, 3600)
    minutes_ago = remainder // 60
    return {"days": days_ago, "hours": hours_ago, "minutes": minutes_ago}


def format_time_ago(timestamp):
    time_ago_map = time_ago(timestamp)
    days_ago = time_ago_map["days"]
    hours_ago = time_ago_map["hours"]
    minutes_ago = time_ago_map["minutes"]
    if days_ago > 0:
        return f"{days_ago} days ago"
    if hours_ago > 0:
        return f"{hours_ago} hours ago"
    if minutes_ago > 0:
        return f"{minutes_ago} minutes ago"
    else:
        return "few moments ago"


def format_user_post(user_post):
    metadata = user_post["metadata"]
    author_id = metadata["author_id"]
    text = metadata["text"]
    created_ago = format_time_ago(metadata["created"])
    return f"<@{author_id}>: *{text}* ({created_ago})"


async def handle_user_post(
    index, prompt_type, embeds, prompt, message, transaction_data
):
    index.upsert(
        vectors=[
            {
                "id": str(message.id),
                "values": embeds[0],
                "metadata": {
                    "text": prompt,
                    "author_id": str(message.author.id),
                    "prompt_type": prompt_type,
                    "created": time.time(),
                    "platform": transaction_data.get("platform"),
                    "category": transaction_data.get("category"),
                    "game": transaction_data.get("game"),
                    "match_amount_usd": transaction_data.get("match_amount_usd"),
                },
            }
        ],
        pinecone_namespace=pinecone_namespace,
    )

    # Corrected query to use only filter
    pine_res = index.query(
        filter={"prompt_type": prompt_type},
        top_k=5,
        include_metadata=True,
    )
    matches = pine_res["matches"]
    filtered_matches = [
        match for match in matches if match["score"] >= min_pinecone_score
    ]
    logger.info(f"User post filtered matches: {filtered_matches}")
    openai_thank_primer = ""
    if not filtered_matches:
        if prompt_type == "tournament":
            openai_thank_primer = tournament_primer_no_items
        elif prompt_type == "1v1":
            openai_thank_primer = match_primer_no_items
    else:
        if prompt_type == "tournament":
            openai_thank_primer = match_primer
        elif prompt_type == "1v1":
            openai_thank_primer = tournament_primer
    openai_thank_res = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": openai_thank_primer},
            {"role": "user", "content": prompt},
        ],
    )
    openai_thank_reply = openai_thank_res.choices[0].message.content

    if filtered_matches:
        results_text = "\n\n".join(
            [format_user_post(item) for item in filtered_matches]
        )
        openai_thank_reply = f"{openai_thank_reply} \n\n {results_text}"

    # Check if the post is a 1v1 challenge
    if prompt_type == "1v1":
        # The ID of the user who posted the challenge
        challenge_creator_id = str(message.author.id)

        view = View()
        accept_button = AcceptButton(
            label="Accept",
            style=discord.ButtonStyle.green,
            custom_id=f"accept_1v1_{message.id}",
            challenge_creator_id=challenge_creator_id,
        )
        view.add_item(accept_button)

        # Send the alert message with the "Accept" button
        alert_message = f"New 1v1 challenge added by {message.author.display_name}: {prompt} \nClick 'Accept' to join!"
        await message.channel.send(alert_message, view=view)

        # Send a confirmation that the 1v1 has been recorded to the original requester
        await message.reply("Your 1v1 challenge has been recorded.")
        return

    return openai_thank_reply


def handle_delete_post(index, embeds, message):
    # Corrected query to use only filter
    pine_res = index.query(
        filter={"author_id": str(message.author.id)},
        top_k=1,
        include_metadata=True,
    )
    matches = pine_res["matches"]
    if matches:
        post_id = matches[0]["id"]
        index.delete(ids=[post_id])
        return f"I have deleted the following post:\n\n {format_user_post(matches[0])}"
    else:
        return (
            f"I'm sorry, I haven't found any post of yours you described. Please describe in more detail what"
            f"post you'd like me to delete."
        )


def handle_show_list(index, embeds):
    # Corrected query to use only vector
    pine_res = index.query(vector=embeds, top_k=5, include_metadata=True)
    matches = pine_res["matches"]
    filtered_matches = [
        match for match in matches if match["score"] >= min_pinecone_score
    ]
    if filtered_matches:
        formatted_matches = "\n\n".join(
            [format_user_post(item) for item in filtered_matches]
        )
        return (
            f"According to your description, I have compiled the following list of user posts:\n\n"
            f"{formatted_matches}"
        )
    else:
        return f"Based on your description, it appears that there are no user submissions found in our chat."


@bot.event
async def on_message(message):
    if message.author == bot.user:
        return

    if bot.user.mentioned_in(message):
        if message.author.id != admin_user_id and not api_counter.check_limit(
            message.author.id
        ):
            logger.info(f"User {message.author.id} exceeded daily limit")
            await message.reply(
                f"Apologies, but you have exceeded the daily limit of {max_uses_per_day} requests. "
                f"Please feel free to continue tomorrow."
            )
            return

        prompt = message.content.replace(f"<@{bot.user.id}>", "").strip()
        if len(prompt) > max_prompt_length:
            logger.info(
                f"Maximum prompt length exceeded: {len(prompt)} characters by {message.author.id}"
            )
            await message.reply(
                f"Apologies, but you have exceeded maximum input length of {max_prompt_length} characters. "
                f"Kindly aim for greater conciseness, if possible."
            )
            return

        logger.info(f"Prompt: {prompt}")
        if (
            message.author.id == admin_user_id
            and prompt.lower() == "absolutely sure about clearing your memory"
        ):
            index = pinecone.Index(pinecone_index_name)
            index.delete(deleteAll="true")
            logger.info(f"Pinecone index was cleared")
            await message.reply("I've cleared my memory")
            return

        if not prompt:
            await message.reply(unidentified_prompt_message)
            return

        openai_messages = []
        openai_messages.extend(primer_messages)
        openai_messages.extend([{"role": "user", "content": prompt}])
        openai_res = client.chat.completions.create(
            model="gpt-3.5-turbo", messages=openai_messages
        )
        logger.info(f"OpenAI Response: {openai_res}")
        openai_reply = openai_res.choices[0].message.content

        logger.info(f"OpenAI reply: {openai_reply}")

        prompt_type = "unidentified"

        logger.info(f"OpenAI reply: {openai_reply}")
        if "unidentified" not in openai_reply:
            if "list" in openai_reply:
                prompt_type = "list"
            elif "delete" in openai_reply:
                prompt_type = "delete"
            elif "tournament" in openai_reply:
                prompt_type = "tournament"
            elif "1v1" in openai_reply:
                prompt_type = "1v1"

        logger.info(f"Prompt Type: {prompt_type}")
        if prompt_type == "unidentified":
            await message.reply(unidentified_prompt_message)
            return

        embeds_res = client.embeddings.create(input=[prompt], model=openai_embed_model)
        embeds = [record.embedding for record in embeds_res.data]
        logger.info(f"Embeds length: {len(embeds[0])}")

        if pinecone_index_name not in pinecone_indexes:
            raise NameError("Pinecone index name does not exist")

        index = pc.Index(pinecone_index_name)
        logger.info(f"Index stats: {index.describe_index_stats()}")

        if prompt_type == "delete":
            result_message = handle_delete_post(
                index=index, embeds=embeds, message=message
            )
        elif prompt_type == "list":
            result_message = handle_show_list(index=index, embeds=embeds)
        else:
            try:
                result_message = await handle_user_post(
                    index=index,
                    prompt_type=prompt_type,
                    embeds=embeds,
                    message=message,
                    prompt=prompt,
                )
            except Exception as e:
                logger.error(f"Error handling user post: {e}")
                result_message = "An error occurred while processing your request. Please try again later."

        await message.reply(result_message)


@bot.event
async def on_ready():
    print(f"Logged in as {bot.user}!")
    print("Registered commands:")
    for cmd in bot.application_commands:
        print(cmd.name)


@bot.slash_command(name="my-balance", description="Check your current credit balance.")
async def my_balance(ctx):
    user_id = str(ctx.author.id)
    balance = 25  # Simulating a balance retrieval, replace with your method
    await ctx.respond(f"Your current balance is: {balance} credits")


print(discord.__version__)
bot.run(iscoinGPT_token)
