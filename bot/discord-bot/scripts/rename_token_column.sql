-- Migration script to rename tokenAddress column to tokenName in the Match table
-- This preserves all existing data while updating the column name

-- Check if the column exists before renaming
DO $$
BEGIN
    IF EXISTS (
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'Match' AND column_name = 'tokenAddress'
    ) THEN
        -- Rename the column
        ALTER TABLE "Match" RENAME COLUMN "tokenAddress" TO "tokenName";
        RAISE NOTICE 'Successfully renamed tokenAddress to tokenName';
    ELSE
        RAISE NOTICE 'Column tokenAddress not found. It may have already been renamed.';
    END IF;
END $$;

-- Verify the change
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'Match' AND column_name = 'tokenName'; 