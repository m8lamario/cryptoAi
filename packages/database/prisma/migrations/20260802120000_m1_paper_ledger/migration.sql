-- M1 paper ledger: singleton balance, stable execution identity and take-profit storage.
-- The nullable execution key keeps existing historical orders compatible.
ALTER TABLE "PaperBalance"
  ADD COLUMN "singletonKey" TEXT NOT NULL DEFAULT 'PAPER';

CREATE UNIQUE INDEX "PaperBalance_singletonKey_key"
  ON "PaperBalance"("singletonKey");

ALTER TABLE "PaperOrder"
  ADD COLUMN "executionKey" TEXT;

CREATE UNIQUE INDEX "PaperOrder_executionKey_key"
  ON "PaperOrder"("executionKey");

ALTER TABLE "PaperPosition"
  ADD COLUMN "takeProfit" DECIMAL(24,8);

