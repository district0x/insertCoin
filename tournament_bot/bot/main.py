import os
import discord
from discord.ext import commands
from discord.commands import Option
from dotenv import load_dotenv
import logging
from lib import (
    initialize_supabase,
    get_next_tournament_id,
    # insert_tournament_data,
    # update_tournament_status,
    # insert_entrant_data,
    insert_tournament_channel,
)

get_next_tournament_id()

# Load environment variables
load_dotenv()
TOKEN = os.getenv("TOURNAMENT_GPT_TOKEN")

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tournament_bot")

# Initialize Supabase
supabase = initialize_supabase()

# Initialize Discord Bot
intents = discord.Intents.default()
intents.messages = True
intents.guilds = True
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)


class AcceptButton(discord.ui.Button):
    def __init__(self, tournament_id):
        super().__init__(
            label="Join Tournament",
            style=discord.ButtonStyle.green,
            custom_id=f"join_tournament_{tournament_id}",
        )
        self.tournament_id = tournament_id

    async def callback(self, interaction: discord.Interaction):
        user = interaction.user
        # response = insert_entrant_data(supabase, self.tournament_id, user.id)
        response = True
        if response:
            # Create a private channel for the user
            overwrites = {
                interaction.guild.default_role: discord.PermissionOverwrite(
                    read_messages=False
                ),
                user: discord.PermissionOverwrite(read_messages=True),
            }
            channel = await interaction.guild.create_text_channel(
                name=f"private-{user.name}", overwrites=overwrites
            )
            # Insert the channel and tournament ID into the new table
            insert_tournament_channel(supabase, self.tournament_id, channel.id)

            demo_link = "https://tournament-bot.vercel.app/"  # Put your external website link here
            await channel.send(
                f"Welcome to your private tournament channel! Here is a demo link: {demo_link}"
            )
            await interaction.response.send_message(
                f"Private channel created! {channel.mention}", ephemeral=True
            )
        else:
            await interaction.response.send_message(
                "Failed to join the tournament. Please try again.", ephemeral=True
            )


@bot.slash_command(name="create_tournament", description="Create a new tournament.")
async def create_tournament(
    ctx,
    platform: Option(str, "Choose the platform (e.g., PC, PS5, Xbox)", required=True),
    category: Option(
        str, "Enter the tournament category (e.g., FPS, MOBA, RPG)", required=True
    ),
    game: Option(str, "Enter the game name", required=True),
    num_entrants: Option(int, "Enter the number of entrants", required=True),
):
    tournament_id = get_next_tournament_id()
    tournament_data = {
        "platform": platform,
        "category": category,
        "game": game,
        "num_entrants": num_entrants,
    }

    # response = insert_tournament_data(supabase, tournament_id, tournament_data)
    response = True
    if response:
        view = discord.ui.View()
        join_button = AcceptButton(tournament_id)
        view.add_item(join_button)
        await ctx.respond(
            f"Tournament created with ID: {tournament_id}. Click to join!", view=view
        )
    else:
        await ctx.respond("Failed to create tournament. Please try again.")


@bot.slash_command(name="start_tournament", description="Start an existing tournament.")
async def start_tournament(
    ctx, tournament_id: Option(int, "Enter the tournament ID", required=True)
):
    # response = update_tournament_status(supabase, tournament_id, "in-progress")
    response = {"status_code": 200}
    if response["status_code"] == 200:
        await ctx.respond(f"Tournament {tournament_id} has started!")
    else:
        await ctx.respond(
            "Failed to start tournament. Please check the tournament ID and try again."
        )


@bot.slash_command(name="end_tournament", description="End an existing tournament.")
async def end_tournament(
    ctx, tournament_id: Option(int, "Enter the tournament ID", required=True)
):
    # response = update_tournament_status(supabase, tournament_id, "closed")
    response = {"status_code": 200}
    if response["status_code"] == 200:
        await ctx.respond(f"Tournament {tournament_id} has ended!")
    else:
        await ctx.respond(
            "Failed to end tournament. Please check the tournament ID and try again."
        )


@bot.event
async def on_ready():
    logger.info(
        f"Logged in as {bot.user}! Registered commands: {[cmd.name for cmd in bot.application_commands]}"
    )


if __name__ == "__main__":
    bot.run(TOKEN)
