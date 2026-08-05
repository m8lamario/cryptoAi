import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/password.js";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const ownerUsername = process.env["OWNER_USERNAME"] ?? "owner";
  const ownerPassword = process.env["OWNER_PASSWORD"];

  const existingUser = await prisma.user.findUnique({
    where: { username: ownerUsername },
    select: { id: true, passwordHash: true },
  });

  if (!existingUser?.passwordHash && !ownerPassword) {
    throw new Error("OWNER_PASSWORD is required to create or complete the owner account");
  }

  let passwordHash = existingUser?.passwordHash;
  if (!passwordHash) {
    if (!ownerPassword) {
      throw new Error("OWNER_PASSWORD is required to create or complete the owner account");
    }
    passwordHash = await hashPassword(ownerPassword);
  }
  const user = await prisma.user.upsert({
    where: { username: ownerUsername },
    update: { passwordHash },
    create: {
      username: ownerUsername,
      role: "OWNER",
      passwordHash,
    },
  });

  await prisma.riskProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      maxPortfolioExposurePercent: 20,
      maxAssetExposurePercent: 10,
      maxDailyLossPercent: 2,
      maxDrawdownPercent: 15,
    },
  });

  const existingSeedEvent = await prisma.systemEvent.findFirst({
    where: {
      type: "SEED",
      message: "Database seeded successfully",
    },
    select: { id: true },
  });

  if (!existingSeedEvent) {
    await prisma.systemEvent.create({
      data: {
        level: "INFO",
        type: "SEED",
        message: "Database seeded successfully",
        metadata: { seedVersion: 3 },
      },
    });
  }

  // M1: Seed default assets into the DB
  const defaultAssets = [
    { symbol: "BTCUSDT", baseAsset: "BTC", quoteAsset: "USDT", name: "Bitcoin" },
    { symbol: "ETHUSDT", baseAsset: "ETH", quoteAsset: "USDT", name: "Ethereum" },
    { symbol: "SOLUSDT", baseAsset: "SOL", quoteAsset: "USDT", name: "Solana" },
    { symbol: "BNBUSDT", baseAsset: "BNB", quoteAsset: "USDT", name: "BNB" },
    { symbol: "XRPUSDT", baseAsset: "XRP", quoteAsset: "USDT", name: "XRP" },
    { symbol: "LINKUSDT", baseAsset: "LINK", quoteAsset: "USDT", name: "Chainlink" },
    { symbol: "SUIUSDT", baseAsset: "SUI", quoteAsset: "USDT", name: "Sui" },
    { symbol: "AVAXUSDT", baseAsset: "AVAX", quoteAsset: "USDT", name: "Avalanche" },
    { symbol: "DOGEUSDT", baseAsset: "DOGE", quoteAsset: "USDT", name: "Dogecoin" },
  ];

  for (const asset of defaultAssets) {
    await prisma.asset.upsert({
      where: { symbol: asset.symbol },
      update: { active: true },
      create: { ...asset, active: true },
    });
  }

  // M1: Seed default scanner config
  const existingScannerConfig = await prisma.scannerConfig.findFirst();
  if (!existingScannerConfig) {
    await prisma.scannerConfig.create({
      data: {
        maxAssetsToScan: 100,
        maxAssetsForQuant: 10,
        maxAssetsForAI: 5,
        minScoreForAI: 60,
        scannerFrequencyMinutes: 1,
        minVolume24hUsd: 1_000_000,
        minMarketCapUsd: 10_000_000,
      },
    });
  }

  console.log(`Seeded owner user: ${ownerUsername}`);
  console.log(`Seeded ${defaultAssets.length} default assets`);
}

main()
  .catch((err: unknown) => {
    console.error("Seed failed:", err instanceof Error ? err.message : "Unknown error");
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
