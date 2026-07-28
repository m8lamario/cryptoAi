-- CreateTable
CREATE TABLE "StoredAgentReport" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentVersion" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "requestedModel" TEXT NOT NULL,
    "actualModel" TEXT,
    "asset" TEXT NOT NULL,
    "horizon" TEXT NOT NULL,
    "signal" TEXT,
    "score" DECIMAL(4,2) NOT NULL,
    "confidence" DECIMAL(4,2) NOT NULL,
    "dataQuality" DECIMAL(4,2) NOT NULL,
    "reasoning" JSONB NOT NULL,
    "supportingEvidence" JSONB NOT NULL,
    "opposingEvidence" JSONB NOT NULL,
    "sourceIds" TEXT[],
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "estimatedCostUsd" DECIMAL(12,6) NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredAgentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredTradeProposal" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "action" TEXT,
    "confidence" DECIMAL(4,2) NOT NULL,
    "suggestedRiskFraction" DECIMAL(4,2),
    "rationale" JSONB NOT NULL,
    "reportIds" TEXT[],
    "invalidationConditions" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "decisionGateResult" TEXT,
    "riskDecisionId" TEXT,
    "managerAgentVersion" TEXT NOT NULL,
    "managerPromptVersion" TEXT NOT NULL,
    "requestedModel" TEXT NOT NULL,
    "actualModel" TEXT,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "estimatedCostUsd" DECIMAL(12,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredTradeProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoredAgentReport_runId_key" ON "StoredAgentReport"("runId");

-- CreateIndex
CREATE INDEX "StoredAgentReport_agentId_createdAt_idx" ON "StoredAgentReport"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "StoredAgentReport_asset_createdAt_idx" ON "StoredAgentReport"("asset", "createdAt");

-- CreateIndex
CREATE INDEX "StoredAgentReport_createdAt_idx" ON "StoredAgentReport"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoredTradeProposal_runId_key" ON "StoredTradeProposal"("runId");

-- CreateIndex
CREATE INDEX "StoredTradeProposal_asset_createdAt_idx" ON "StoredTradeProposal"("asset", "createdAt");

-- CreateIndex
CREATE INDEX "StoredTradeProposal_status_createdAt_idx" ON "StoredTradeProposal"("status", "createdAt");

-- CreateIndex
CREATE INDEX "StoredTradeProposal_createdAt_idx" ON "StoredTradeProposal"("createdAt");
