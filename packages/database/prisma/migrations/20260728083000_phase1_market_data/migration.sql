-- Phase 1: Pipeline dati di mercato
-- Add Asset, PriceCandle, MarketSnapshot, DataCollectionRun

-- CreateEnum
-- (none needed)

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "baseAsset" TEXT NOT NULL,
    "quoteAsset" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceCandle" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "openTime" TIMESTAMP(3) NOT NULL,
    "closeTime" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(24,8) NOT NULL,
    "high" DECIMAL(24,8) NOT NULL,
    "low" DECIMAL(24,8) NOT NULL,
    "close" DECIMAL(24,8) NOT NULL,
    "volume" DECIMAL(24,8) NOT NULL,
    "quoteVolume" DECIMAL(30,8) NOT NULL,
    "trades" INTEGER NOT NULL,
    "interval" TEXT NOT NULL DEFAULT '15m',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceCandle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketSnapshot" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "price" DECIMAL(24,8) NOT NULL,
    "change24h" DECIMAL(12,4),
    "volume24h" DECIMAL(30,8),
    "high24h" DECIMAL(24,8),
    "low24h" DECIMAL(24,8),
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectionRunId" TEXT,

    CONSTRAINT "MarketSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataCollectionRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "provider" TEXT NOT NULL,
    "error" TEXT,

    CONSTRAINT "DataCollectionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_symbol_key" ON "Asset"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "PriceCandle_assetId_openTime_interval_key" ON "PriceCandle"("assetId", "openTime", "interval");

-- CreateIndex
CREATE INDEX "PriceCandle_assetId_openTime_idx" ON "PriceCandle"("assetId", "openTime");

-- CreateIndex
CREATE UNIQUE INDEX "MarketSnapshot_assetId_collectedAt_key" ON "MarketSnapshot"("assetId", "collectedAt");

-- AddForeignKey
ALTER TABLE "PriceCandle" ADD CONSTRAINT "PriceCandle_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketSnapshot" ADD CONSTRAINT "MarketSnapshot_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketSnapshot" ADD CONSTRAINT "MarketSnapshot_collectionRunId_fkey" FOREIGN KEY ("collectionRunId") REFERENCES "DataCollectionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

