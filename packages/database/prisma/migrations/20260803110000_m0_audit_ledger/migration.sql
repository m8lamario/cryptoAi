-- M0: immutable configuration snapshots, decision audit, outcomes and performance snapshots.
CREATE TABLE "ConfigurationSnapshot" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT NOT NULL DEFAULT 'SYSTEM',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConfigurationSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConfigurationSnapshot_kind_version_key" ON "ConfigurationSnapshot"("kind", "version");
CREATE UNIQUE INDEX "ConfigurationSnapshot_kind_payloadHash_key" ON "ConfigurationSnapshot"("kind", "payloadHash");
CREATE INDEX "ConfigurationSnapshot_kind_createdAt_idx" ON "ConfigurationSnapshot"("kind", "createdAt");

CREATE TABLE "DecisionAudit" (
  "id" TEXT NOT NULL,
  "decisionKey" TEXT NOT NULL,
  "proposalRunId" TEXT,
  "asset" TEXT NOT NULL,
  "action" TEXT,
  "decisionStatus" TEXT NOT NULL,
  "marketInput" JSONB NOT NULL,
  "quantitativeFeatures" JSONB NOT NULL,
  "agentReportIds" TEXT[] NOT NULL,
  "proposalJson" JSONB NOT NULL,
  "decisionGateResult" TEXT,
  "riskDecisionId" TEXT,
  "orderId" TEXT,
  "configurationSnapshotIds" TEXT[] NOT NULL,
  "promptVersion" TEXT,
  "requestedModel" TEXT,
  "actualModel" TEXT,
  "outcomeStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "migrationSafe" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DecisionAudit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DecisionAudit_decisionKey_key" ON "DecisionAudit"("decisionKey");
CREATE INDEX "DecisionAudit_asset_createdAt_idx" ON "DecisionAudit"("asset", "createdAt");
CREATE INDEX "DecisionAudit_outcomeStatus_createdAt_idx" ON "DecisionAudit"("outcomeStatus", "createdAt");

CREATE TABLE "OutcomeLedger" (
  "id" TEXT NOT NULL,
  "decisionAuditId" TEXT NOT NULL,
  "proposalRunId" TEXT,
  "orderId" TEXT,
  "checkpoint" TEXT NOT NULL,
  "referencePrice" DECIMAL(24,8),
  "entryPrice" DECIMAL(24,8),
  "exitPrice" DECIMAL(24,8),
  "realizedPnl" DECIMAL(24,8) NOT NULL DEFAULT 0,
  "unrealizedPnl" DECIMAL(24,8) NOT NULL DEFAULT 0,
  "grossPnl" DECIMAL(24,8) NOT NULL DEFAULT 0,
  "fee" DECIMAL(24,8) NOT NULL DEFAULT 0,
  "slippage" DECIMAL(24,8) NOT NULL DEFAULT 0,
  "netPnl" DECIMAL(24,8) NOT NULL DEFAULT 0,
  "wasCorrect" BOOLEAN,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OutcomeLedger_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OutcomeLedger_decisionAuditId_checkpoint_key" ON "OutcomeLedger"("decisionAuditId", "checkpoint");
CREATE INDEX "OutcomeLedger_proposalRunId_recordedAt_idx" ON "OutcomeLedger"("proposalRunId", "recordedAt");
CREATE INDEX "OutcomeLedger_checkpoint_recordedAt_idx" ON "OutcomeLedger"("checkpoint", "recordedAt");

CREATE TABLE "PerformanceSnapshot" (
  "id" TEXT NOT NULL,
  "realizedPnl" DECIMAL(24,8) NOT NULL DEFAULT 0,
  "unrealizedPnl" DECIMAL(24,8) NOT NULL DEFAULT 0,
  "dailyRealizedPnl" DECIMAL(24,8) NOT NULL DEFAULT 0,
  "dailyUnrealizedPnl" DECIMAL(24,8) NOT NULL DEFAULT 0,
  "cumulativeNetPnl" DECIMAL(24,8) NOT NULL DEFAULT 0,
  "equity" DECIMAL(24,8) NOT NULL DEFAULT 0,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PerformanceSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PerformanceSnapshot_recordedAt_idx" ON "PerformanceSnapshot"("recordedAt");

