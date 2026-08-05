import { prisma } from "./prisma-client.js";
import type { Prisma } from "@prisma/client";

export interface OpportunityScanResult {
  asset: string;
  score: number;
  classification: string;
  components: Array<{ name: string; value: number; weight: number }>;
  direction?: string;
  opportunityIntensity?: number;
  directionScore?: number;
  expectedMove?: number;
  expectedRisk?: number;
  estimatedCosts?: { spread: number; slippage: number; fees: number; turnover: number; total: number };
  netEdge?: number;
  horizonCandles?: number;
  formulaVersion?: string;
  featureVersion?: string;
  features?: Record<string, number | null>;
  evaluatedAt: Date;
}

export async function storeOpportunityScore(result: OpportunityScanResult): Promise<void> {
  const evaluatedAt = new Date(Math.floor(result.evaluatedAt.getTime() / 60_000) * 60_000);
  const data = {
    score: result.score,
    classification: result.classification,
    components: result.components as Prisma.InputJsonValue,
    direction: result.direction,
    opportunityIntensity: result.opportunityIntensity,
    directionScore: result.directionScore,
    expectedMove: result.expectedMove,
    expectedRisk: result.expectedRisk,
    estimatedCosts: result.estimatedCosts as Prisma.InputJsonValue | undefined,
    netEdge: result.netEdge,
    horizonCandles: result.horizonCandles,
    formulaVersion: result.formulaVersion,
    featureVersion: result.featureVersion,
    features: result.features as Prisma.InputJsonValue | undefined,
  };
  await prisma.marketOpportunityScore.upsert({
    where: { asset_evaluatedAt: { asset: result.asset, evaluatedAt } },
    update: data,
    create: { asset: result.asset, evaluatedAt, ...data },
  });
}

export async function getLatestOpportunityScores(): Promise<OpportunityScanResult[]> {
  const raw = await prisma.marketOpportunityScore.findMany({
    orderBy: [{ asset: "asc" }, { evaluatedAt: "desc" }],
  });
  const latest = new Map<string, (typeof raw)[number]>();
  for (const row of raw) if (!latest.has(row.asset)) latest.set(row.asset, row);
  return [...latest.values()].map((row) => ({
    asset: row.asset,
    score: row.score,
    classification: row.classification,
    components: JSON.parse(JSON.stringify(row.components)),
    direction: row.direction ?? undefined,
    opportunityIntensity: row.opportunityIntensity ?? undefined,
    directionScore: row.directionScore ?? undefined,
    expectedMove: row.expectedMove ?? undefined,
    expectedRisk: row.expectedRisk ?? undefined,
    estimatedCosts: row.estimatedCosts as OpportunityScanResult["estimatedCosts"],
    netEdge: row.netEdge ?? undefined,
    horizonCandles: row.horizonCandles ?? undefined,
    formulaVersion: row.formulaVersion ?? undefined,
    featureVersion: row.featureVersion ?? undefined,
    features: row.features as OpportunityScanResult["features"],
    evaluatedAt: row.evaluatedAt,
  }));
}
