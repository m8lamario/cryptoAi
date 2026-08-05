import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma-client.js";

type PersistableSnapshot<T> = {
  domain: string;
  asset: string | null;
  provider: string;
  providerVersion: string;
  observedAt: Date;
  acquiredAt: Date;
  validUntil: Date | null;
  qualityScore: number;
  qualityStatus: string;
  sampleSize: number | null;
  methodologyVersion: string | null;
  payloadHash: string;
  payload: T;
};

export async function upsertExternalDataSnapshot(snapshot: PersistableSnapshot<unknown>, expiresAt?: Date): Promise<string> {
  const row = await prisma.externalDataSnapshot.upsert({
    where: { domain_provider_payloadHash: { domain: snapshot.domain, provider: snapshot.provider, payloadHash: snapshot.payloadHash } },
    update: {
      asset: snapshot.asset,
      providerVersion: snapshot.providerVersion,
      observedAt: snapshot.observedAt,
      acquiredAt: snapshot.acquiredAt,
      validUntil: snapshot.validUntil,
      qualityScore: snapshot.qualityScore,
      qualityStatus: snapshot.qualityStatus,
      sampleSize: snapshot.sampleSize,
      methodologyVersion: snapshot.methodologyVersion,
      payload: snapshot.payload as Prisma.InputJsonValue,
      expiresAt,
    },
    create: {
      domain: snapshot.domain,
      asset: snapshot.asset,
      provider: snapshot.provider,
      providerVersion: snapshot.providerVersion,
      observedAt: snapshot.observedAt,
      acquiredAt: snapshot.acquiredAt,
      validUntil: snapshot.validUntil,
      qualityScore: snapshot.qualityScore,
      qualityStatus: snapshot.qualityStatus,
      sampleSize: snapshot.sampleSize,
      methodologyVersion: snapshot.methodologyVersion,
      payloadHash: snapshot.payloadHash,
      payload: snapshot.payload as Prisma.InputJsonValue,
      expiresAt,
    },
    select: { id: true },
  });
  return row.id;
}

export async function getLatestExternalSnapshots(domain: string, asset: string | null, asOf = new Date()) {
  return prisma.externalDataSnapshot.findMany({
    where: {
      domain,
      ...(asset === null ? { asset: null } : { OR: [{ asset }, { asset: null }] }),
      qualityStatus: "VALID",
      acquiredAt: { lte: asOf },
      observedAt: { lte: asOf },
    },
    orderBy: { observedAt: "desc" },
  });
}

export async function deleteExpiredExternalDataSnapshots(now = new Date()): Promise<number> {
  const result = await prisma.externalDataSnapshot.deleteMany({ where: { expiresAt: { lt: now } } });
  return result.count;
}
