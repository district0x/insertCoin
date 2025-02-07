-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('ONE_V_ONE', 'TWO_V_TWO', 'FIVE_V_FIVE');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'OPEN', 'FILLED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('CREATED', 'FILLING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "address" TEXT,
    "discordId" TEXT,
    "username" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "totalMatches" INTEGER NOT NULL DEFAULT 0,
    "totalWins" INTEGER NOT NULL DEFAULT 0,
    "totalLosses" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "matchId" INTEGER NOT NULL,
    "matchType" "MatchType" NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "creatorId" TEXT,
    "creatorDiscordId" TEXT,
    "stake" DOUBLE PRECISION NOT NULL,
    "tokenAddress" TEXT,
    "totalPrize" DOUBLE PRECISION NOT NULL,
    "winnerAddress" TEXT,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "status" "TournamentStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "entryFee" DOUBLE PRECISION NOT NULL,
    "tokenAddress" TEXT,
    "totalPrize" DOUBLE PRECISION NOT NULL,
    "maxParticipants" INTEGER NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "isTeamA" BOOLEAN NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_Participant" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_Participant_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_TournamentParticipant" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TournamentParticipant_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_TeamMember" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TeamMember_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_address_key" ON "User"("address");

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Match_matchId_key" ON "Match"("matchId");

-- CreateIndex
CREATE INDEX "Match_matchId_idx" ON "Match"("matchId");

-- CreateIndex
CREATE INDEX "Match_creatorDiscordId_idx" ON "Match"("creatorDiscordId");

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_tournamentId_key" ON "Tournament"("tournamentId");

-- CreateIndex
CREATE INDEX "Tournament_tournamentId_idx" ON "Tournament"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_matchId_isTeamA_key" ON "Team"("matchId", "isTeamA");

-- CreateIndex
CREATE INDEX "_Participant_B_index" ON "_Participant"("B");

-- CreateIndex
CREATE INDEX "_TournamentParticipant_B_index" ON "_TournamentParticipant"("B");

-- CreateIndex
CREATE INDEX "_TeamMember_B_index" ON "_TeamMember"("B");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Participant" ADD CONSTRAINT "_Participant_A_fkey" FOREIGN KEY ("A") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Participant" ADD CONSTRAINT "_Participant_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TournamentParticipant" ADD CONSTRAINT "_TournamentParticipant_A_fkey" FOREIGN KEY ("A") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TournamentParticipant" ADD CONSTRAINT "_TournamentParticipant_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TeamMember" ADD CONSTRAINT "_TeamMember_A_fkey" FOREIGN KEY ("A") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TeamMember" ADD CONSTRAINT "_TeamMember_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
