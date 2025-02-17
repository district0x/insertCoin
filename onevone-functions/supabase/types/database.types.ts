export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type MatchType = 'ONE_V_ONE' | 'TWO_V_TWO' | 'FIVE_V_FIVE'
export type MatchStatus = 'PENDING' | 'OPEN' | 'FILLED' | 'COMPLETED' | 'CANCELLED'
export type TournamentStatus = 'CREATED' | 'FILLING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export interface Database {
  public: {
    Tables: {
      User: {
        Row: {
          id: string
          address: string | null
          discordId: string | null
          username: string | null
          createdAt: string
          updatedAt: string
          totalMatches: number
          totalWins: number
          totalLosses: number
        }
        Insert: {
          id?: string
          address?: string | null
          discordId?: string | null
          username?: string | null
          createdAt?: string
          updatedAt?: string
          totalMatches?: number
          totalWins?: number
          totalLosses?: number
        }
        Update: {
          id?: string
          address?: string | null
          discordId?: string | null
          username?: string | null
          createdAt?: string
          updatedAt?: string
          totalMatches?: number
          totalWins?: number
          totalLosses?: number
        }
      }
      Match: {
        Row: {
          id: string
          matchId: number
          matchType: MatchType
          status: MatchStatus
          createdAt: string
          updatedAt: string
          creatorId: string | null
          creatorDiscordId: string | null
          stake: number
          tokenAddress: string | null
          totalPrize: number
          winnerAddress: string | null
        }
        Insert: {
          id?: string
          matchId: number
          matchType: MatchType
          status?: MatchStatus
          createdAt?: string
          updatedAt?: string
          creatorId?: string | null
          creatorDiscordId?: string | null
          stake: number
          tokenAddress?: string | null
          totalPrize: number
          winnerAddress?: string | null
        }
        Update: {
          id?: string
          matchId?: number
          matchType?: MatchType
          status?: MatchStatus
          createdAt?: string
          updatedAt?: string
          creatorId?: string | null
          creatorDiscordId?: string | null
          stake?: number
          tokenAddress?: string | null
          totalPrize?: number
          winnerAddress?: string | null
        }
      }
      Team: {
        Row: {
          id: string
          matchId: string
          isTeamA: boolean
        }
        Insert: {
          id?: string
          matchId: string
          isTeamA: boolean
        }
        Update: {
          id?: string
          matchId?: string
          isTeamA?: boolean
        }
      }
      Tournament: {
        Row: {
          id: string
          tournamentId: number
          status: TournamentStatus
          createdAt: string
          updatedAt: string
          entryFee: number
          tokenAddress: string | null
          totalPrize: number
          maxParticipants: number
        }
        Insert: {
          id?: string
          tournamentId: number
          status: TournamentStatus
          createdAt?: string
          updatedAt?: string
          entryFee: number
          tokenAddress?: string | null
          totalPrize: number
          maxParticipants: number
        }
        Update: {
          id?: string
          tournamentId?: number
          status?: TournamentStatus
          createdAt?: string
          updatedAt?: string
          entryFee?: number
          tokenAddress?: string | null
          totalPrize?: number
          maxParticipants?: number
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      MatchType: MatchType
      MatchStatus: MatchStatus
      TournamentStatus: TournamentStatus
    }
  }
} 