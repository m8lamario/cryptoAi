import { createHash } from "node:crypto";
import { prisma } from "./prisma-client.js";

export interface AssetInfo { symbol: string; baseAsset: string; quoteAsset: string; name: string; }
export interface RuntimeAsset extends AssetInfo { isPinned: boolean; whitelist: boolean; lastVolume24hUsd: number | null; lastSeenAt: Date | null; }
const hashPayload = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export async function refreshAssetUniverse(fetchedAssets: AssetInfo[], source = "binance", now = new Date()): Promise<{ version: string; assets: RuntimeAsset[] }> {
  const existing = await prisma.asset.findMany({ select: { symbol: true, isPinned: true, whitelist: true, isExcluded: true } });
  const overrides = new Map(existing.map((row) => [row.symbol, row]));
  const assets = [...new Map(fetchedAssets.filter((asset) => !overrides.get(asset.symbol)?.isExcluded).map((asset) => [asset.symbol, asset])).values()];
  const symbols = assets.map((asset) => asset.symbol).sort();
  const payloadHash = hashPayload({ source, symbols });
  const version = `${now.toISOString()}-${payloadHash.slice(0, 12)}`;
  await prisma.$transaction(async (tx) => {
    await tx.assetUniverseVersion.create({ data: { version, source, payloadHash, symbols, fetchedAt: now, effectiveAt: now } });
    for (const asset of assets) await tx.asset.upsert({ where: { symbol: asset.symbol }, update: { ...asset, active: true, dataAvailable: true, lastSeenAt: now, lastUniverseVersion: version }, create: { ...asset, active: true, lastSeenAt: now, lastUniverseVersion: version } });
    if (symbols.length) await tx.asset.updateMany({ where: { active: true, isExcluded: false, symbol: { notIn: symbols } }, data: { active: false, dataAvailable: false, exclusionReason: "OUTSIDE_UNIVERSE" } });
  });
  return { version, assets: await getRuntimeAssets() };
}

export async function getRuntimeAssets(limit = 100): Promise<RuntimeAsset[]> {
  const rows = await prisma.asset.findMany({ where: { active: true, isExcluded: false, dataAvailable: true }, orderBy: [{ isPinned: "desc" }, { whitelist: "desc" }, { lastVolume24hUsd: "desc" }, { symbol: "asc" }], take: limit });
  return rows.map((row) => ({ symbol: row.symbol, baseAsset: row.baseAsset, quoteAsset: row.quoteAsset, name: row.name, isPinned: row.isPinned, whitelist: row.whitelist, lastVolume24hUsd: row.lastVolume24hUsd?.toNumber() ?? null, lastSeenAt: row.lastSeenAt }));
}

export async function shouldReevaluateAsset(symbol: string, featureHash: string, score: number, netEdge: number, deltaPercent: number): Promise<boolean> {
  const state = await prisma.assetEvaluationState.findUnique({ where: { symbol } });
  if (!state || state.featureHash !== featureHash) return true;
  const previous = Math.abs(state.netEdge ?? 0);
  return (previous === 0 ? Math.abs(netEdge) : Math.abs(netEdge - (state.netEdge ?? 0)) / previous * 100) >= deltaPercent || Math.abs(score - (state.score ?? score)) >= deltaPercent;
}

export async function saveAssetEvaluationState(input: { symbol: string; featureHash: string; score: number; netEdge: number; direction: string; evaluatedAt: Date }): Promise<void> { await prisma.assetEvaluationState.upsert({ where: { symbol: input.symbol }, update: input, create: input }); }
export async function isAssetInCooldown(symbol: string, now = new Date()): Promise<boolean> { const row = await prisma.assetCooldown.findUnique({ where: { symbol } }); return row !== null && row.cooldownUntil > now; }
export async function setAssetCooldown(input: { symbol: string; reason: string; cooldownUntil: Date; openedAt?: Date; closedAt?: Date; lastDecisionKey?: string }): Promise<void> { await prisma.assetCooldown.upsert({ where: { symbol: input.symbol }, update: input, create: input }); }

export async function syncPositionCooldown(symbol: string, afterOpenMinutes: number, afterCloseMinutes: number, now = new Date()): Promise<void> {
  const position = await prisma.paperPosition.findFirst({ where: { asset: symbol }, orderBy: { closedAt: "desc" } });
  if (!position) return;
  const anchor = position.status === "OPEN" ? position.openedAt : position.closedAt;
  if (!anchor) return;
  const minutes = position.status === "OPEN" ? afterOpenMinutes : afterCloseMinutes;
  const cooldownUntil = new Date(anchor.getTime() + Math.max(0, minutes) * 60_000);
  if (cooldownUntil <= now) return;
  await setAssetCooldown({ symbol, reason: position.status === "OPEN" ? "POSITION_OPENED" : "POSITION_CLOSED", cooldownUntil, openedAt: position.openedAt, ...(position.closedAt ? { closedAt: position.closedAt } : {}) });
}

export async function reserveScannerAiBudget(maxCalls: number, maxCostUsd: number, estimatedCostUsd: number, now = new Date()): Promise<boolean> {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "ScannerAiBudget" ("id", "budgetDay", "callsReserved", "costReservedUsd", "createdAt", "updatedAt")
    VALUES (${`m4-${day.toISOString().slice(0, 10)}`}, ${day}, 1, ${estimatedCostUsd}, NOW(), NOW())
    ON CONFLICT ("budgetDay") DO UPDATE
      SET "callsReserved" = "ScannerAiBudget"."callsReserved" + 1,
          "costReservedUsd" = "ScannerAiBudget"."costReservedUsd" + ${estimatedCostUsd},
          "updatedAt" = NOW()
      WHERE "ScannerAiBudget"."callsReserved" + 1 <= ${maxCalls}
        AND "ScannerAiBudget"."costReservedUsd" + ${estimatedCostUsd} <= ${maxCostUsd}
    RETURNING "id"
  `;
  return rows.length > 0;
}
