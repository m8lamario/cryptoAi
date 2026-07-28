-- CreateTable
CREATE TABLE "KillSwitch" (
    "id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KillSwitch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskDecision" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "proposalJson" JSONB NOT NULL,
    "observedValue" DECIMAL(24,8),
    "configuredLimit" DECIMAL(24,8),
    "positionSize" DECIMAL(24,8),
    "stopLoss" DECIMAL(24,8),
    "idempotencyKey" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RiskDecision_idempotencyKey_key" ON "RiskDecision"("idempotencyKey");
