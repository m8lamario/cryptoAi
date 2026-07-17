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
        metadata: { seedVersion: 2 },
      },
    });
  }

  console.log(`Seeded owner user: ${ownerUsername}`);
}

main()
  .catch((err: unknown) => {
    console.error("Seed failed:", err instanceof Error ? err.message : "Unknown error");
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
