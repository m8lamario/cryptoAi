import { prisma } from "./prisma-client.js";

interface OpportunityScanResult {
  asset: string;
  score: number;
  classification: string;
  components: Array<{ name: string; value: number; weight: number }>;
  evaluatedAt: Date;
}

/**
 * Store a MarketOpportunityScore in the database.
 * Uses upsert on asset+evaluatedAt (same minute) for idempotency.
 */
export async function storeOpportunityScore(result: OpportunityScanResult): Promise<void> {
  await prisma.marketOpportunityScore.create({
    data: {
      asset: result.asset,
      score: result.score,
      classification: result.classification,
      components: result.components,
      evaluatedAt: result.evaluatedAt,
    },
  });
}

/**
 * Get the latest opportunity scores for all assets.
 */
export async function getLatestOpportunityScores(): Promise<OpportunityScanResult[]> {
  const raw = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      asset: string;
      score: number;
      classification: string;
      components: unknown;
      evaluated_at: Date;
    }>
  >(
    `SELECT DISTINCT ON (asset)
       id, asset, score, classification, components, evaluated_at
     FROM "MarketOpportunityScore"
     ORDER BY asset, evaluated_at DESC`,
  );

  return raw.map((r) => ({
    asset: r.asset,
    score: r.score,
    classification: r.classification as OpportunityScanResult["classification"],
    components: JSON.parse(JSON.stringify(r.components)),
    evaluatedAt: r.evaluated_at,
  }));
}
