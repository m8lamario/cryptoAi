import { prisma } from "@cryptoai/database";
import { canonicalHash, type SnapshotBundle } from "./contracts.js";

export async function resolveSnapshotBundle(asset: string, asOf: Date, configurationSnapshotIds: string[]): Promise<SnapshotBundle> {
  const marketSnapshot = await prisma.marketSnapshot.findFirst({ where: { asset: { symbol: asset }, collectedAt: { lte: asOf } }, orderBy: { collectedAt: "desc" } });
  if (!marketSnapshot) throw new Error(`No market snapshot available for ${asset} at ${asOf.toISOString()}`);
  const candles = await prisma.priceCandle.findMany({ where: { asset: { symbol: asset }, closeTime: { lte: asOf }, interval: "15m" }, orderBy: { openTime: "desc" }, take: 100, select: { id: true } });
  if (candles.length < 50) throw new Error(`Insufficient frozen candles for ${asset}`);
  const external = await prisma.externalDataSnapshot.findMany({ where: { qualityStatus: "VALID", acquiredAt: { lte: asOf }, observedAt: { lte: asOf } }, select: { id: true } });
  const base = { schemaVersion: "workflow-snapshot-v1" as const, asOf: asOf.toISOString(), asset, marketSnapshotId: marketSnapshot.id, candleIds: candles.reverse().map((c) => c.id), externalSnapshotIds: external.map((s) => s.id), configurationSnapshotIds };
  return { ...base, contentHash: canonicalHash(base) };
}

