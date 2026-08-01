-- CreateTable
CREATE TABLE "TradingPlan" (
    "id" TEXT NOT NULL,
    "proposalRunId" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "expectedDuration" TEXT NOT NULL,
    "expectedProfitPercent" DECIMAL(8,4) NOT NULL,
    "expectedRiskPercent" DECIMAL(8,4) NOT NULL,
    "confidence" DECIMAL(4,2) NOT NULL,
    "suggestedEntry" DECIMAL(24,8) NOT NULL,
    "suggestedTakeProfit" DECIMAL(24,8) NOT NULL,
    "suggestedStopLoss" DECIMAL(24,8) NOT NULL,
    "urgency" TEXT NOT NULL,
    "reasons" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TradingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketOpportunityScore" (
    "id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "classification" TEXT NOT NULL,
    "components" JSONB NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketOpportunityScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIDecisionMemory" (
    "id" TEXT NOT NULL,
    "proposalRunId" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "strategy" TEXT,
    "entryPrice" DECIMAL(24,8) NOT NULL,
    "indicatorsJson" JSONB NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "confidenceAtDecision" DECIMAL(4,2) NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL,
    "outcomes" JSONB NOT NULL,
    "finalResult" DECIMAL(8,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AIDecisionMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatingModeConfig" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'PAPER',
    "autoApprovalRules" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OperatingModeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquitySnapshot" (
    "id" TEXT NOT NULL,
    "equity" DECIMAL(24,2) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EquitySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TradingPlan_proposalRunId_key" ON "TradingPlan"("proposalRunId");
CREATE INDEX "TradingPlan_proposalRunId_idx" ON "TradingPlan"("proposalRunId");
CREATE INDEX "MarketOpportunityScore_asset_evaluatedAt_idx" ON "MarketOpportunityScore"("asset", "evaluatedAt");
CREATE INDEX "MarketOpportunityScore_evaluatedAt_idx" ON "MarketOpportunityScore"("evaluatedAt");
CREATE UNIQUE INDEX "AIDecisionMemory_proposalRunId_key" ON "AIDecisionMemory"("proposalRunId");
CREATE INDEX "AIDecisionMemory_asset_decidedAt_idx" ON "AIDecisionMemory"("asset", "decidedAt");
CREATE INDEX "AIDecisionMemory_modelUsed_createdAt_idx" ON "AIDecisionMemory"("modelUsed", "createdAt");
CREATE INDEX "AIDecisionMemory_proposalRunId_idx" ON "AIDecisionMemory"("proposalRunId");
CREATE INDEX "EquitySnapshot_timestamp_idx" ON "EquitySnapshot"("timestamp");
