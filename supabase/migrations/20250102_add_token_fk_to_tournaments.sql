-- Alter the Tournament table to add a foreign key to the approved_tokens table

-- Step 1: Add a new column for the foreign key relationship
-- This assumes `tokenAddress` in the `Tournament` table stores the address of the token.
-- We will create a new column `token_address_ref` to be the foreign key.
-- ALTER TABLE "Tournament"
-- ADD COLUMN token_address_ref VARCHAR(42);

-- Note: It's better to alter the existing column if possible, but that can be risky
-- if the column types don't match perfectly. Let's assume the `tokenAddress`
-- column already exists and is of a compatible type (like VARCHAR or TEXT).

-- Step 2: Add the foreign key constraint
-- This links the `tokenAddress` in `Tournament` to the `address` in `approved_tokens`
ALTER TABLE "Tournament"
ADD CONSTRAINT fk_tournament_token
FOREIGN KEY ("tokenAddress")
REFERENCES public.approved_tokens(address)
ON UPDATE CASCADE
ON DELETE SET NULL;

-- Step 3: Add an index for better query performance
CREATE INDEX IF NOT EXISTS idx_tournament_token_address ON "Tournament"("tokenAddress");

-- Optional: Backfill data if you were using a different column before
-- UPDATE "Tournament" t
-- SET tokenAddress = at.address
-- FROM approved_tokens at
-- WHERE t.some_other_token_identifier = at.symbol; 