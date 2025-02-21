-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "game" TEXT,
ADD COLUMN     "gameCategory" TEXT,
ADD COLUMN     "matchAmountUsd" INTEGER,
ADD COLUMN     "opponentDiscordId" TEXT,
ADD COLUMN     "platform" TEXT,
ADD COLUMN     "winnerId" TEXT;

-- CreateIndex
CREATE INDEX "Match_opponentDiscordId_idx" ON "Match"("opponentDiscordId");

-- CreateIndex
CREATE INDEX "Match_winnerId_idx" ON "Match"("winnerId");
