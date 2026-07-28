-- CreateTable
CREATE TABLE "PaperBalance" (
    "id" TEXT NOT NULL,
    "quote" DECIMAL(24,2) NOT NULL,
    "peakValue" DECIMAL(24,2) NOT NULL,
    "dailyPnl" DECIMAL(24,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaperBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(24,8) NOT NULL,
    "price" DECIMAL(24,8) NOT NULL,
    "commission" DECIMAL(24,8) NOT NULL,
    "slippagePercent" DECIMAL(8,4) NOT NULL,
    "status" TEXT NOT NULL,
    "proposalRunId" TEXT,
    "riskDecisionId" TEXT,
    "backtestRunId" TEXT,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaperOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperPosition" (
    "id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "quantity" DECIMAL(24,8) NOT NULL,
    "entryPrice" DECIMAL(24,8) NOT NULL,
    "currentPrice" DECIMAL(24,8) NOT NULL,
    "unrealizedPnl" DECIMAL(24,8) NOT NULL,
    "stopLoss" DECIMAL(24,8),
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "PaperPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestRun" (
    "id" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "initialQuote" DECIMAL(24,2) NOT NULL,
    "finalQuote" DECIMAL(24,2) NOT NULL,
    "totalReturn" DECIMAL(8,4) NOT NULL,
    "maxDrawdown" DECIMAL(8,4) NOT NULL,
    "sharpeRatio" DECIMAL(8,4),
    "sortinoRatio" DECIMAL(8,4),
    "totalTrades" INTEGER NOT NULL,
    "winRate" DECIMAL(6,4),
    "avgProfit" DECIMAL(24,8),
    "avgLoss" DECIMAL(24,8),
    "commissionCost" DECIMAL(24,8) NOT NULL,
    "slippageCost" DECIMAL(24,8) NOT NULL,
    "aiCostUsd" DECIMAL(12,6) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BacktestRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaperOrder_orderId_key" ON "PaperOrder"("orderId");

-- CreateIndex
CREATE INDEX "PaperOrder_asset_createdAt_idx" ON "PaperOrder"("asset", "createdAt");

-- CreateIndex
CREATE INDEX "PaperOrder_status_createdAt_idx" ON "PaperOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PaperOrder_backtestRunId_idx" ON "PaperOrder"("backtestRunId");

-- CreateIndex
CREATE INDEX "PaperPosition_asset_idx" ON "PaperPosition"("asset");

-- CreateIndex
CREATE INDEX "PaperPosition_status_idx" ON "PaperPosition"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PaperPosition_asset_status_key" ON "PaperPosition"("asset", "status");

-- CreateIndex
CREATE INDEX "BacktestRun_strategy_createdAt_idx" ON "BacktestRun"("strategy", "createdAt");

-- CreateIndex
CREATE INDEX "BacktestRun_asset_createdAt_idx" ON "BacktestRun"("asset", "createdAt");
