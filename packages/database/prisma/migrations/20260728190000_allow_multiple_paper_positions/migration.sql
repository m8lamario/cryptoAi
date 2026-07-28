-- A paper account may close and reopen the same asset many times.
-- The previous unique(asset, status) index incorrectly allowed only one CLOSED row.
DROP INDEX "PaperPosition_asset_status_key";
CREATE UNIQUE INDEX "PaperPosition_asset_open_key"
  ON "PaperPosition"("asset")
  WHERE "status" = 'OPEN';

