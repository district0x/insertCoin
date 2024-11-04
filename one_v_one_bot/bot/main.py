import logging
import os
import discord
from discord import Option
from discord.ext import commands
from dotenv import load_dotenv
from lib import (
    get_next_match_id,
    initialize_supabase,
    insert_match_data,
    get_channel_id_by_match_id,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("iscoin_gpt")

load_dotenv()
DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")

intents = discord.Intents.default()
intents.messages = True
intents.guilds = True
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)

supabase = initialize_supabase()

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


async def get_game_choices(ctx: discord.AutocompleteContext):
    category = ctx.options["category"]
    return game_choices.get(category, [])


class AcceptButton(discord.ui.Button):
    def __init__(self, challenge_creator_id, channel_id, transaction_data):
        super().__init__(
            label="Accept Challenge",
            style=discord.ButtonStyle.green,
            custom_id="accept_1v1",
        )
        self.challenge_creator_id = challenge_creator_id
        self.channel_id = channel_id
        self.transaction_data = transaction_data

    async def callback(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)

        guild = interaction.guild
        challenge_creator = guild.get_member(self.challenge_creator_id)
        channel = guild.get_channel(self.channel_id)

        overwrites = {
            guild.default_role: discord.PermissionOverwrite(read_messages=False),
            guild.me: discord.PermissionOverwrite(read_messages=True),
            challenge_creator: discord.PermissionOverwrite(read_messages=True),
            interaction.user: discord.PermissionOverwrite(read_messages=True),
        }

        await channel.edit(overwrites=overwrites)
        await channel.send(
            f"{challenge_creator.mention} and {interaction.user.mention}, your private match channel is ready!"
        )

        self.transaction_data["player2_name"] = str(interaction.user.display_name)

        # Update the database with player2 information
        supabase = initialize_supabase()
        try:
            update_response = (
                supabase.table("matches")
                .update({"player2_name": self.transaction_data["player2_name"]})
                .eq("match_id", self.transaction_data["match_id"])
                .execute()
            )

            logger.info(f"Update response: {update_response}")
            if update_response.data:
                await channel.send(
                    f"{challenge_creator.mention}, please start the match on the 1v1 frontpage."
                )
            else:
                logger.error(f"Error updating player2 information: No data returned")
                await channel.send(
                    "There was an error updating the match information. Please contact an administrator."
                )
        except Exception as e:
            logger.error(f"Exception when updating player2 information: {str(e)}")
            await channel.send(
                "An unexpected error occurred. Please contact an administrator."
            )

        await interaction.followup.send(
            f"Your private match channel {channel.mention} is ready!", ephemeral=True
        )


@bot.slash_command(name="1v1", description="Start a 1v1 challenge.")
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
    await ctx.defer()

    channel = await ctx.guild.create_text_channel(
        name=f"1v1-{ctx.author.display_name}-{platform}-{game}"
    )

    match_id = get_next_match_id()
    logger.info(f"Received match_id: {match_id}")

    if match_id is None:
        await ctx.followup.send(
            "There was an error getting the match ID. Please try again later."
        )
        await channel.delete()
        return

    transaction_data = {
        "match_id": str(match_id),  # Convert to string for database insertion
        "channel_id": str(channel.id),
        "player1_name": str(ctx.author.display_name),
        "player2_name": None,
        "match_amount_usd": int(match_amount_usd),
        "category": category,
        "platform": platform,
        "game": game,
    }

    supabase = initialize_supabase()
    insert_result = insert_match_data(supabase, transaction_data)
    if insert_result is None:
        logger.error(f"Failed to insert match data for match_id: {match_id}")
        await ctx.followup.send(
            "There was an error creating the match. Please try again later."
        )
        await channel.delete()
        return

    logger.info(f"Successfully inserted match data for match_id: {match_id}")

    frontpage_link = "https://1v1-three.vercel.app/"

    await channel.send(
        f"1v1 Match Parameters:\n"
        f"Match ID: {match_id}\n"
        f"Platform: {platform}\n"
        f"Category: {category}\n"
        f"Game: {game}\n"
        f"Match Amount: ${match_amount_usd}\n\n"
        f"{ctx.author.mention}, please start the match\n"
        f"1v1 Frontpage: {frontpage_link}"
    )

    view = discord.ui.View()
    button = AcceptButton(ctx.author.id, channel.id, transaction_data)
    view.add_item(button)

    await ctx.followup.send(
        f"{ctx.author.mention} has initiated a 1v1 challenge (ID: {match_id}) for {game} ({category}) on {platform} with a match amount of ${match_amount_usd}. Waiting for an opponent!",
        view=view,
    )


@bot.event
async def on_ready():
    print(f"Logged in as {bot.user}!")
    print("Registered commands:")
    for cmd in bot.application_commands:
        print(cmd.name)


bot.run(DISCORD_TOKEN)
