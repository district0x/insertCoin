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
    return matches.map(match => {
        const matchId = Number(match.id);
        const matchMetadata = metadata[matchId];

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
                    opponentDiscordId: null,
                    winnerId: null
                }
            };
        }
    });
}

// Function to get a display title for a match
export function getMatchDisplayTitle(match: OnChainMatch): string {
    // If we have game metadata and it's not null, use it
    if (match.metadata?.game && match.metadata.game.trim() !== '') {
        const platform = match.metadata.platform ? ` (${match.metadata.platform})` : '';
        return `${match.metadata.game}${platform}`;
    }

    // Fallback to generic title with match type
    const matchTypeLabel = getMatchTypeLabel(match.matchType);
    return `${matchTypeLabel} Match #${match.id.toString()}`;
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