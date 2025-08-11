import { OnChainMatch } from "@/types/match";

// Function to fetch metadata for multiple matches
export async function fetchMatchMetadata(matchIds: number[]): Promise<Record<number, any>> {
    if (matchIds.length === 0) {
        return {};
    }

    try {
        const response = await fetch(`/api/matches/metadata?matchIds=${matchIds.join(',')}`);

        if (!response.ok) {
            console.error('Failed to fetch match metadata:', response.statusText);
            return {};
        }

        const data = await response.json();
        return data.metadata || {};
    } catch (error) {
        console.error('Error fetching match metadata:', error);
        return {};
    }
}

// Function to merge metadata with on-chain match data
export function mergeMatchMetadata(
    matches: OnChainMatch[],
    metadata: Record<number, any>
): OnChainMatch[] {
    console.log('[METADATA] Merging metadata for matches:', matches.map(m => Number(m.id)));
    console.log('[METADATA] Available metadata:', Object.keys(metadata));

    return matches.map(match => {
        const matchId = Number(match.id);
        const matchMetadata = metadata[matchId];

        console.log(`[METADATA] Match ${matchId}:`, matchMetadata);

        if (matchMetadata) {
            return {
                ...match,
                metadata: matchMetadata
            };
        } else {
            // Create a fallback metadata object for matches without database entries
            return {
                ...match,
                metadata: {
                    game: null,
                    gameCategory: null,
                    platform: null,
                    status: match.isOpen ? 'OPEN' : 'COMPLETED',
                    creatorDiscordId: null,
                    creatorAddress: null,
                    creatorUsername: null,
                    opponentDiscordId: null,
                    player2Address: null,
                    player2Username: null,
                    winnerId: null
                }
            };
        }
    });
}

// Function to get a display title for a match
export function getMatchDisplayTitle(match: OnChainMatch): string {
    console.log(`[TITLE] Generating title for match ${match.id}:`, {
        hasMetadata: !!match.metadata,
        game: match.metadata?.game,
        platform: match.metadata?.platform,
        matchType: match.matchType
    });

    // If we have game metadata and it's not null, use it
    if (match.metadata?.game && match.metadata.game.trim() !== '') {
        const platform = match.metadata.platform ? ` (${match.metadata.platform})` : '';
        const title = `${match.metadata.game}${platform}`;
        console.log(`[TITLE] Using game title: ${title}`);
        return title;
    }

    // Fallback to generic title with match type
    const matchTypeLabel = getMatchTypeLabel(match.matchType);
    const fallbackTitle = `${matchTypeLabel} Match #${match.id.toString()}`;
    console.log(`[TITLE] Using fallback title: ${fallbackTitle}`);
    return fallbackTitle;
}

// Helper function to get match type label
export function getMatchTypeLabel(type: string): string {
    switch (type) {
        case "ONE_V_ONE": return "1v1";
        case "TWO_V_TWO": return "2v2";
        case "FIVE_V_FIVE": return "5v5";
        default: return type;
    }
} 