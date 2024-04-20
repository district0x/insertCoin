from openai import OpenAI
import logging
from APICounter import APICounter
import os
import sys
import discord
from discord.ext import commands
import openai
from pinecone import Pinecone, ServerlessSpec
import time
import datetime
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
tracemalloc.start()

# Add the parent directory to the import search path
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(parent_dir)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ethlance_gpt")

load_dotenv()
# Get the value of environment variables
ethlanceGPT_token = os.getenv("ETHLANCE_GPT_TOKEN")
ethlanceGPT_client_id = os.getenv("ETHLANCE_GPT_CLIENT_ID")
openai_api_key = os.getenv("OPENAI_API_KEY")

logger.info("Loading environment variables.")
logger.info(f"OpenAI API Key: {openai_api_key}")


client = OpenAI()

# Define the OpenAI embedding model to use
openai_embed_model = "text-embedding-ada-002"

# Initialize Pinecone
pinecone_api_key = os.getenv("PINECONE_API_KEY")
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

max_prompt_length = 1000

api_counter = APICounter(max_uses_per_day)

bot = discord.Client(intents=intents)


@bot.event
async def on_ready():
    logger.info(f"Logged in as {bot.user.name}")


class CustomHelpCommand(commands.DefaultHelpCommand):
    pass


bot.help_command = CustomHelpCommand()


class AcceptButton(Button):
    def __init__(self, label: str, style: discord.ButtonStyle, custom_id: str, challenge_creator_id: str):
        super().__init__(label=label, style=style, custom_id=custom_id)
        self.challenge_creator_id = challenge_creator_id

    async def callback(self, interaction: discord.Interaction):
        guild = interaction.guild
        challenge_creator = guild.get_member(int(self.challenge_creator_id))

        overwrites = {
            guild.default_role: discord.PermissionOverwrite(read_messages=False),
            guild.me: discord.PermissionOverwrite(read_messages=True),
            challenge_creator: discord.PermissionOverwrite(read_messages=True),
            interaction.user: discord.PermissionOverwrite(read_messages=True)
        }

        match_channel = await guild.create_text_channel(
            name=f"match-{challenge_creator.display_name}-{interaction.user.display_name}",
            overwrites=overwrites
        )

        await match_channel.send(f"{challenge_creator.mention} and {interaction.user.mention}, your private match channel is ready!")

        await interaction.response.send_message(f'Your private match channel {match_channel.mention} is ready!', ephemeral=True)


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


async def handle_user_post(index, prompt_type, embeds, prompt, message):
    print(embeds)
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
                },
            }
        ]
    )

    pine_res = index.query(
        vector=embeds,
        filter={"prompt_type": "prompt_type" if prompt_type ==
                "1v1" else "tournament"},
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
            challenge_creator_id=challenge_creator_id
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
    pine_res = index.query(
        vector=embeds,
        filter={"author_id": str(message.author.id)},
        top_k=1,
        include_metadata=True,
    )
    matches = pine_res["matches"]
    if matches:
        post_id = matches[0]["id"]
        index.delete(ids=[post_id])
        return f"I have deleted following post:\n\n {format_user_post(matches[0])}"
    else:
        return (
            f"I'm sorry, I haven't found any post of yours you described. Please describe in more detail what"
            f"post you'd like me to delete."
        )


def handle_show_list(index, embeds):
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

        embeds_res = client.embeddings.create(
            input=[prompt], model=openai_embed_model)
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
            result_message = await handle_user_post(
                index=index,
                prompt_type=prompt_type,
                embeds=embeds,
                message=message,
                prompt=prompt,
            )

        await message.reply(result_message)

print(discord.__version__)
bot.run(ethlanceGPT_token)
