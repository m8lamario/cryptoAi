-- M4: persisted dynamic universe, evaluation state, cooldown and scanner AI reservations.
ALTER TABLE "Asset"
  ADD COLUMN "whitelist" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "exclusionReason" TEXT,
  ADD COLUMN "dataAvailable" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "lastSeenAt" TIMESTAMP(3),
  ADD COLUMN "lastVolume24hUsd" DECIMAL(30,8),
  ADD COLUMN "lastMarketCapUsd" DECIMAL(30,8),
  ADD COLUMN "lastUniverseVersion" TEXT;

ALTER TABLE "ScannerConfig"
  ADD COLUMN "universeRefreshMinutes" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "cooldownAfterOpenMinutes" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "cooldownAfterCloseMinutes" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "reevaluationDeltaPercent" DECIMAL(8,4) NOT NULL DEFAULT 3,
  ADD COLUMN "maxDailyAiCalls" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN "maxDailyAiCostUsd" DECIMAL(12,6) NOT NULL DEFAULT 1;

CREATE TABLE "AssetUniverseVersion" (
  "id" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "symbols" JSONB NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssetUniverseVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AssetUniverseVersion_version_key" ON "AssetUniverseVersion"("version");
CREATE INDEX "AssetUniverseVersion_fetchedAt_idx" ON "AssetUniverseVersion"("fetchedAt");

CREATE TABLE "AssetEvaluationState" (
  "id" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "featureHash" TEXT NOT NULL,
  "evaluatedAt" TIMESTAMP(3) NOT NULL,
  "score" DOUBLE PRECISION,
  "netEdge" DOUBLE PRECISION,
  "direction" TEXT,
  "lastAiEnqueuedAt" TIMESTAMP(3),
  "lastProposalKey" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssetEvaluationState_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AssetEvaluationState_symbol_key" ON "AssetEvaluationState"("symbol");
CREATE INDEX "AssetEvaluationState_evaluatedAt_idx" ON "AssetEvaluationState"("evaluatedAt");

CREATE TABLE "AssetCooldown" (
  "id" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "cooldownUntil" TIMESTAMP(3) NOT NULL,
  "openedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "lastDecisionKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssetCooldown_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AssetCooldown_symbol_key" ON "AssetCooldown"("symbol");
CREATE INDEX "AssetCooldown_cooldownUntil_idx" ON "AssetCooldown"("cooldownUntil");

CREATE TABLE "ScannerAiBudget" (
  "id" TEXT NOT NULL,
  "budgetDay" TIMESTAMP(3) NOT NULL,
  "callsReserved" INTEGER NOT NULL DEFAULT 0,
  "costReservedUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScannerAiBudget_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ScannerAiBudget_budgetDay_key" ON "ScannerAiBudget"("budgetDay");
CREATE INDEX "ScannerAiBudget_budgetDay_idx" ON "ScannerAiBudget"("budgetDay");

CREATE INDEX "Asset_active_isExcluded_isPinned_idx" ON "Asset"("active", "isExcluded", "isPinned");
CREATE INDEX "Asset_lastSeenAt_idx" ON "Asset"("lastSeenAt");

