-- M3: directional, cost-aware quantitative score fields.
ALTER TABLE "MarketOpportunityScore"
  ADD COLUMN "direction" TEXT,
  ADD COLUMN "opportunityIntensity" DOUBLE PRECISION,
  ADD COLUMN "directionScore" DOUBLE PRECISION,
  ADD COLUMN "expectedMove" DOUBLE PRECISION,
  ADD COLUMN "expectedRisk" DOUBLE PRECISION,
  ADD COLUMN "estimatedCosts" JSONB,
  ADD COLUMN "netEdge" DOUBLE PRECISION,
  ADD COLUMN "horizonCandles" INTEGER,
  ADD COLUMN "formulaVersion" TEXT,
  ADD COLUMN "featureVersion" TEXT,
  ADD COLUMN "features" JSONB;

CREATE INDEX "MarketOpportunityScore_netEdge_evaluatedAt_idx"
  ON "MarketOpportunityScore"("netEdge", "evaluatedAt");

