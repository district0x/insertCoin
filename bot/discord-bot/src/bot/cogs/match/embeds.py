"""Functions for creating Discord embeds."""

import discord

def create_match_embed(match: dict, creator: discord.User) -> discord.Embed:
    """Create an embed for match details."""
    embed = discord.Embed(
        title=f"{match.matchType} Match #{match.id[:8]}",
        color=discord.Color.blue()
    )
    
    # Add match details
    embed.add_field(
        name="Status",
        value=match.status,
        inline=True
    )
    embed.add_field(
        name="Stake",
        value=f"{match.stake} ETH",
        inline=True
    )
    if match.platform:
        embed.add_field(
            name="Platform",
            value=match.platform,
            inline=True
        )
    if match.game:
        embed.add_field(
            name="Game",
            value=f"{match.game} ({match.gameCategory})",
            inline=True
        )
    if match.matchAmountUsd:
        embed.add_field(
            name="Match Amount",
            value=f"${match.matchAmountUsd} USD",
            inline=True
        )
    
    # Add creator info
    embed.set_author(
        name=f"Created by {creator.name}",
        icon_url=creator.display_avatar.url
    )
    
    return embed

def create_stats_embed(stats: dict) -> discord.Embed:
    """Create an embed for user stats."""
    embed = discord.Embed(
        title="🎮 Your Gaming Statistics",
        color=discord.Color.blue()
    )
    
    embed.add_field(
        name="Overall Stats",
        value=f"""
        Total Matches: {stats['total_matches']}
        Completed Matches: {stats['completed_matches']}
        Total Winnings: {stats['total_winnings']:.2f} ETH
        """,
        inline=False
    )
    
    if stats['games_played']:
        games_str = "\n".join(f"{game}: {count} matches" for game, count in stats['games_played'].items())
        embed.add_field(
            name="Games Played",
            value=games_str,
            inline=False
        )
    
    return embed

def create_match_history_embed(history: list) -> discord.Embed:
    """Create an embed for match history."""
    embed = discord.Embed(
        title="📜 Your Recent Matches",
        color=discord.Color.blue()
    )
    
    for match in history:
        embed.add_field(
            name=f"Match {match['id'][:8]} - {match['game'] or 'Game not specified'}",
            value=f"""
            Type: {match['type']}
            Opponent: {match['opponent']}
            Platform: {match['platform'] or 'Not specified'}
            Status: {match['result']}
            Prize: {match['prize']} ETH
            """,
            inline=False
        )
    
    return embed

def create_opponent_record_embed(record: dict, opponent: discord.User) -> discord.Embed:
    """Create an embed for opponent record."""
    embed = discord.Embed(
        title=f"🤺 Head-to-Head vs {opponent.name}",
        color=discord.Color.blue()
    )
    
    embed.add_field(
        name="Record",
        value=f"""
        Total Matches: {record['total_matches']}
        Wins: {record['wins']}
        Losses: {record['losses']}
        Win Rate: {record['win_rate']:.1f}%
        """,
        inline=False
    )
    
    if record['games_played']:
        games_str = "\n".join(f"{game}: {count} matches" for game, count in record['games_played'].items())
        embed.add_field(
            name="Games Played",
            value=games_str,
            inline=False
        )
    
    if record['recent_matches']:
        recent_str = "\n".join(f"{match['game']}: {match['result']}" for match in record['recent_matches'])
        embed.add_field(
            name="Recent Matches",
            value=recent_str,
            inline=False
        )
    
    return embed 