import { supabase } from "./supabase";

export async function linkWalletToDiscord(
  walletAddress,
  matchId,
  isPlayer2 = false
) {
  try {
    console.log(
      `Attempting to link wallet: ${walletAddress} with match ID: ${matchId}`
    );

    // First check if wallet already exists
    const { data: existingPlayer, error: existingPlayerError } = await supabase
      .from("players")
      .select("*")
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    if (existingPlayerError) {
      console.error("Error fetching existing player:", existingPlayerError);
      throw existingPlayerError;
    }

    if (existingPlayer) {
      console.log(`Existing player found: ${JSON.stringify(existingPlayer)}`);

      // If the wallet exists but discord_id is null, update it
      if (!existingPlayer.discord_id) {
        console.log("Discord ID is null, attempting to update...");

        // Get the correct discord_id from the matches table using matchId
        const discordIdField = isPlayer2 ? "player2_discord_id" : "discord_id";
        const { data: matchData, error: matchError } = await supabase
          .from("matches")
          .select(discordIdField)
          .eq("match_id", matchId)
          .single();

        if (matchError) {
          console.error("Error fetching match data:", matchError);
          throw matchError;
        }

        if (matchData && matchData[discordIdField]) {
          console.log(
            `Found discord ID from match: ${matchData[discordIdField]}`
          );

          // Update the players table with the discord_id
          const { data, error } = await supabase
            .from("players")
            .update({ discord_id: matchData[discordIdField] })
            .eq("wallet_address", walletAddress)
            .select()
            .single();

          if (error) {
            console.error("Error updating discord ID:", error);
            throw error;
          }

          console.log(
            `Successfully updated discord ID for wallet: ${walletAddress}`
          );
          return data;
        } else {
          console.log("No discord ID found in match data.");
        }
      } else {
        console.log("Discord ID already set, no update needed.");
      }

      return existingPlayer;
    }

    // If wallet doesn't exist, insert new record
    console.log("No existing player found, inserting new record...");
    const { data, error } = await supabase
      .from("players")
      .insert({
        wallet_address: walletAddress,
        created_at: new Date().toISOString(),
        discord_id: null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error inserting new player:", error);
      throw error;
    }

    console.log(`Successfully inserted new player: ${JSON.stringify(data)}`);
    return data;
  } catch (error) {
    console.error("Error linking wallet:", error);
    throw error;
  }
}

export async function recordMatchResult(matchData) {
  try {
    // Get player wallet addresses from the transaction
    const { data: playerData, error: playerError } = await supabase
      .from("players")
      .select("discord_id, wallet_address")
      .in("wallet_address", [matchData.winnerAddress, matchData.loserAddress]);

    if (playerError) throw playerError;

    // Map wallet addresses to discord IDs
    const winnerDiscordId = playerData.find(
      (p) => p.wallet_address === matchData.winnerAddress
    )?.discord_id;
    const loserDiscordId = playerData.find(
      (p) => p.wallet_address !== matchData.winnerAddress
    )?.discord_id;

    // Insert match result
    const { data, error } = await supabase.from("match_results").insert({
      match_id: matchData.matchId,
      winner_discord_id: winnerDiscordId || "pending",
      loser_discord_id: loserDiscordId || "pending",
      amount_won_usd: matchData.winnerAmountUsd,
      amount_won_wei: matchData.winnerAmount,
      match_type: "1v1",
      transaction_hash: matchData.transactionHash,
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error recording match result:", error);
    throw error;
  }
}

// New function to update discord ID (to be used by bot)
export async function updateDiscordId(walletAddress, discordId) {
  try {
    // First check if discord_id is already used
    const { data: existingDiscord } = await supabase
      .from("players")
      .select("*")
      .eq("discord_id", discordId)
      .single();

    if (existingDiscord) {
      throw new Error("Discord ID already linked to another wallet");
    }

    // Update the player record
    const { data, error } = await supabase
      .from("players")
      .update({ discord_id: discordId })
      .eq("wallet_address", walletAddress)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error updating discord ID:", error);
    throw error;
  }
}
