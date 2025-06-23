-- Winner payments table
CREATE TABLE winner_payments (
  id SERIAL PRIMARY KEY,
  tournament_id VARCHAR,
  match_id VARCHAR,
  winner_address VARCHAR NOT NULL,
  winner_name VARCHAR,
  amount VARCHAR NOT NULL,
  percentage INTEGER,
  token_symbol VARCHAR DEFAULT 'ETH',
  token_address VARCHAR DEFAULT '0x0000000000000000000000000000000000000000',
  is_erc20 BOOLEAN DEFAULT false,
  transaction_hash VARCHAR NOT NULL,
  block_number INTEGER,
  timestamp TIMESTAMP DEFAULT NOW(),
  game_type VARCHAR DEFAULT 'tournament',
  total_prize_pool VARCHAR,
  participants JSONB
);

-- Update Tournament table (note: capital T to match existing)
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS game_type VARCHAR DEFAULT 'tournament';

-- Update TournamentParticipant table (note: lowercase tournamentid to match existing)
ALTER TABLE "TournamentParticipant" ADD COLUMN IF NOT EXISTS is_winner BOOLEAN DEFAULT false;
ALTER TABLE "TournamentParticipant" ADD COLUMN IF NOT EXISTS prize_amount VARCHAR; 