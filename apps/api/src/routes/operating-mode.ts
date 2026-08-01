import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "@cryptoai/database";
import type { Prisma } from "@cryptoai/database";
import {
  getOperatingMode,
  getAutoApprovalRules,
  setOperatingMode as setOpMode,
  setAutoApprovalRules as setOpRules,
} from "@cryptoai/risk-engine";
import type { AutoApprovalRule, OperatingMode } from "@cryptoai/risk-engine";

export function createOperatingModeRouter(): Router {
  const router = Router();

  router.get("/", (_req: Request, res: Response) => {
    try {
      const mode = getOperatingMode();
      const rules = getAutoApprovalRules();
      res.json({
        mode,
        autoApprovalRules: rules,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      res.status(500).json({ error: "Failed to get operating mode config" });
    }
  });

  const modeSchema = z.object({
    mode: z.enum(["PAPER", "ASSISTED", "AUTONOMOUS"]),
  });

  router.put("/mode", async (req: Request, res: Response) => {
    try {
      const parsed = modeSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid mode", details: parsed.error.issues });
        return;
      }

      const mode = parsed.data.mode as OperatingMode;
      setOpMode(mode);

      try {
        const existing = await prisma.operatingModeConfig.findFirst();
        if (existing) {
          await prisma.operatingModeConfig.update({
            where: { id: existing.id },
            data: { mode, updatedAt: new Date() },
          });
        } else {
          await prisma.operatingModeConfig.create({
            data: {
              mode,
              autoApprovalRules: getAutoApprovalRules() as unknown as Prisma.JsonObject,
            },
          });
        }
      } catch { /* persistence best-effort */ }

      res.json({
        mode: getOperatingMode(),
        autoApprovalRules: getAutoApprovalRules(),
        updatedAt: new Date().toISOString(),
      });
    } catch {
      res.status(500).json({ error: "Failed to set operating mode" });
    }
  });

  const ruleSchema = z.object({
    maxCapitalFraction: z.number().min(0).max(1),
    minConfidence: z.number().min(0).max(1),
    action: z.enum(["AUTO", "REQUIRE_CONFIRMATION", "ALWAYS_MANUAL", "BLOCK"]),
  });

  router.put("/rules", async (req: Request, res: Response) => {
    try {
      const parsed = z.array(ruleSchema).safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid rules", details: parsed.error.issues });
        return;
      }

      const rules = parsed.data as AutoApprovalRule[];
      setOpRules(rules);

      try {
        const existing = await prisma.operatingModeConfig.findFirst();
        if (existing) {
          await prisma.operatingModeConfig.update({
            where: { id: existing.id },
            data: {
              autoApprovalRules: rules as unknown as Prisma.JsonObject,
              updatedAt: new Date(),
            },
          });
        } else {
          await prisma.operatingModeConfig.create({
            data: {
              mode: getOperatingMode(),
              autoApprovalRules: rules as unknown as Prisma.JsonObject,
            },
          });
        }
      } catch { /* persistence best-effort */ }

      res.json({
        mode: getOperatingMode(),
        autoApprovalRules: getAutoApprovalRules(),
        updatedAt: new Date().toISOString(),
      });
    } catch {
      res.status(500).json({ error: "Failed to set auto-approval rules" });
    }
  });

  return router;
}
