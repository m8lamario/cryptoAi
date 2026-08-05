-- M7: durable global AI budget policy, buckets and call ledger.
CREATE TABLE "AIBudgetPolicy" (
  "id" TEXT NOT NULL,
  "singletonKey" TEXT NOT NULL DEFAULT 'GLOBAL',
  "maxDailyUsd" DECIMAL(18,6) NOT NULL,
  "maxMonthlyUsd" DECIMAL(18,6) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AIBudgetPolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AIBudgetPolicy_singletonKey_key" ON "AIBudgetPolicy"("singletonKey");
CREATE TABLE "AIBudgetBucket" (
  "id" TEXT NOT NULL,
  "bucketType" TEXT NOT NULL,
  "bucketStart" TIMESTAMP(3) NOT NULL,
  "reservedUsd" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "settledUsd" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "releasedUsd" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AIBudgetBucket_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AIBudgetBucket_bucketType_bucketStart_key" ON "AIBudgetBucket"("bucketType", "bucketStart");
CREATE TABLE "AICall" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "reservationId" TEXT,
  "jobId" TEXT,
  "agentId" TEXT,
  "asset" TEXT,
  "provider" TEXT NOT NULL,
  "requestedModel" TEXT NOT NULL,
  "actualModel" TEXT,
  "status" TEXT NOT NULL,
  "estimatedCostUsd" DECIMAL(18,6) NOT NULL,
  "actualCostUsd" DECIMAL(18,6),
  "promptTokens" INTEGER,
  "completionTokens" INTEGER,
  "latencyMs" INTEGER,
  "providerRequestId" TEXT,
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "parentCallId" TEXT,
  "errorCategory" TEXT,
  "errorMessage" TEXT,
  "reservedAt" TIMESTAMP(3),
  "settledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AICall_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AICall_idempotencyKey_key" ON "AICall"("idempotencyKey");
CREATE UNIQUE INDEX "AICall_reservationId_key" ON "AICall"("reservationId");
CREATE INDEX "AICall_jobId_createdAt_idx" ON "AICall"("jobId", "createdAt");
CREATE INDEX "AICall_status_createdAt_idx" ON "AICall"("status", "createdAt");
CREATE INDEX "AICall_provider_requestedModel_createdAt_idx" ON "AICall"("provider", "requestedModel", "createdAt");

