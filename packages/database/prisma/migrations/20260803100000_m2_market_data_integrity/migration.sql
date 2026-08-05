-- M2: align scanner cadence default and make opportunity score persistence idempotent.
ALTER TABLE "ScannerConfig"
  ALTER COLUMN "scannerFrequencyMinutes" SET DEFAULT 1;

CREATE UNIQUE INDEX "MarketOpportunityScore_asset_evaluatedAt_key"
  ON "MarketOpportunityScore"("asset", "evaluatedAt");

