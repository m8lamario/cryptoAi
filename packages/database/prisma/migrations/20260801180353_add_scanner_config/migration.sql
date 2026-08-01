-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "isExcluded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxCapitalUsd" DECIMAL(24,2);

-- CreateTable
CREATE TABLE "ScannerConfig" (
    "id" TEXT NOT NULL,
    "maxAssetsToScan" INTEGER NOT NULL DEFAULT 100,
    "maxAssetsForQuant" INTEGER NOT NULL DEFAULT 10,
    "maxAssetsForAI" INTEGER NOT NULL DEFAULT 5,
    "minScoreForAI" INTEGER NOT NULL DEFAULT 60,
    "scannerFrequencyMinutes" INTEGER NOT NULL DEFAULT 15,
    "minVolume24hUsd" DECIMAL(20,2) NOT NULL DEFAULT 1000000,
    "minMarketCapUsd" DECIMAL(20,2) NOT NULL DEFAULT 10000000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScannerConfig_pkey" PRIMARY KEY ("id")
);
