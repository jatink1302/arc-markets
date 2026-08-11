-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('CASH', 'POSITION');

-- CreateEnum
CREATE TYPE "TradeSide" AS ENUM ('BUY', 'SELL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "sleeperUsername" TEXT,
    "sleeperUserId" TEXT,
    "activeLeagueId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "sleeperLeagueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "totalRosters" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SleeperRoster" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "sleeperRosterId" INTEGER NOT NULL,
    "sleeperOwnerId" TEXT,
    "displayName" TEXT NOT NULL,
    "teamName" TEXT,
    "avatarUrl" TEXT,

    CONSTRAINT "SleeperRoster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "sleeperPlayerId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "team" TEXT,
    "position" TEXT NOT NULL,
    "rosterId" TEXT,
    "basePrice" DECIMAL(12,4) NOT NULL,
    "slope" DECIMAL(10,6) NOT NULL DEFAULT 0.01,
    "supply" INTEGER NOT NULL DEFAULT 0,
    "currentPrice" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "playerId" TEXT,
    "amount" DECIMAL(14,4) NOT NULL,
    "tradeId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "side" "TradeSide" NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "price" DECIMAL(12,4) NOT NULL,
    "totalAmount" DECIMAL(14,4) NOT NULL,
    "priceBefore" DECIMAL(12,4) NOT NULL,
    "priceAfter" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "costBasis" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "League_sleeperLeagueId_key" ON "League"("sleeperLeagueId");

-- CreateIndex
CREATE UNIQUE INDEX "SleeperRoster_leagueId_sleeperRosterId_key" ON "SleeperRoster"("leagueId", "sleeperRosterId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_leagueId_sleeperPlayerId_key" ON "Player"("leagueId", "sleeperPlayerId");

-- CreateIndex
CREATE INDEX "LedgerEntry_userId_type_idx" ON "LedgerEntry"("userId", "type");

-- CreateIndex
CREATE INDEX "LedgerEntry_userId_playerId_idx" ON "LedgerEntry"("userId", "playerId");

-- CreateIndex
CREATE INDEX "Trade_playerId_createdAt_idx" ON "Trade"("playerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Position_userId_playerId_key" ON "Position"("userId", "playerId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_activeLeagueId_fkey" FOREIGN KEY ("activeLeagueId") REFERENCES "League"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SleeperRoster" ADD CONSTRAINT "SleeperRoster_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "SleeperRoster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
