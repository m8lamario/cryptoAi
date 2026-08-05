-- M6: persist complete TradingPlan and contract version for proposals.
ALTER TABLE "StoredTradeProposal"
  ADD COLUMN "tradingPlan" JSONB,
  ADD COLUMN "contractVersion" TEXT NOT NULL DEFAULT 'm6-contracts-v1';

