-- M5: point-in-time external context snapshots with provenance and retention.
CREATE TABLE "ExternalDataSnapshot" (
  "id" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "asset" TEXT,
  "provider" TEXT NOT NULL,
  "providerVersion" TEXT NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "acquiredAt" TIMESTAMP(3) NOT NULL,
  "validUntil" TIMESTAMP(3),
  "qualityScore" DECIMAL(5,4) NOT NULL,
  "qualityStatus" TEXT NOT NULL,
  "sampleSize" INTEGER,
  "methodologyVersion" TEXT,
  "payloadHash" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalDataSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExternalDataSnapshot_domain_provider_payloadHash_key" ON "ExternalDataSnapshot"("domain", "provider", "payloadHash");
CREATE INDEX "ExternalDataSnapshot_domain_asset_observedAt_idx" ON "ExternalDataSnapshot"("domain", "asset", "observedAt");
CREATE INDEX "ExternalDataSnapshot_provider_acquiredAt_idx" ON "ExternalDataSnapshot"("provider", "acquiredAt");
CREATE INDEX "ExternalDataSnapshot_qualityStatus_idx" ON "ExternalDataSnapshot"("qualityStatus");
CREATE INDEX "ExternalDataSnapshot_expiresAt_idx" ON "ExternalDataSnapshot"("expiresAt");

