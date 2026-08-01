import { prisma } from "./prisma-client.js";

export type EquityHistoryInterval = "15m" | "1h" | "1d";

export interface EquityHistoryPoint {
  timestamp: Date;
  equity: number;
}

const INTERVAL_MS: Record<EquityHistoryInterval, number> = {
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
};

export async function saveEquitySnapshot(equity: number, timestamp = new Date()): Promise<string> {
  if (!Number.isFinite(equity) || equity < 0) {
    throw new Error("Equity must be a finite non-negative number");
  }

  const snapshot = await prisma.equitySnapshot.create({
    data: { equity, timestamp },
    select: { id: true },
  });
  return snapshot.id;
}

export async function getEquityHistory(
  from: Date,
  to: Date,
  interval: EquityHistoryInterval = "1h",
): Promise<EquityHistoryPoint[]> {
  if (from > to) return [];

  const snapshots = await prisma.equitySnapshot.findMany({
    where: { timestamp: { gte: from, lte: to } },
    orderBy: { timestamp: "asc" },
    select: { timestamp: true, equity: true },
  });

  if (interval === "15m") {
    return snapshots.map((snapshot) => ({
      timestamp: snapshot.timestamp,
      equity: Number(snapshot.equity),
    }));
  }

  const bucketSize = INTERVAL_MS[interval];
  const buckets = new Map<number, EquityHistoryPoint>();
  for (const snapshot of snapshots) {
    const timestamp = snapshot.timestamp.getTime();
    const bucketTimestamp = Math.floor(timestamp / bucketSize) * bucketSize;
    // Keep the last observed value in a bucket: it is the close of that period.
    buckets.set(bucketTimestamp, {
      timestamp: new Date(bucketTimestamp),
      equity: Number(snapshot.equity),
    });
  }

  return [...buckets.values()].sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
}
