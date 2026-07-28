import { z } from "zod";

// --- AgentReport — matches ProjectPlan Section 3.1 ---

export const AgentReportStatusSchema = z.enum(["VALID", "UNAVAILABLE", "INVALID"]);
export type AgentReportStatus = z.infer<typeof AgentReportStatusSchema>;

export const TradeSignalSchema = z.enum(["BUY", "SELL", "HOLD", "WAIT"]);
export type TradeSignal = z.infer<typeof TradeSignalSchema>;

export const HorizonSchema = z.enum(["SHORT", "MEDIUM", "LONG"]);
export type Horizon = z.infer<typeof HorizonSchema>;

export const AgentReportSchema = z.object({
  status: AgentReportStatusSchema,
  runId: z.string(),
  agentId: z.string(),
  agentVersion: z.string(),
  promptVersion: z.string(),
  requestedModel: z.string(),
  actualModel: z.string().nullable(),
  asset: z.string(),
  horizon: HorizonSchema,
  signal: TradeSignalSchema.nullable(),
  score: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
  dataQuality: z.number().min(0).max(1),
  reasoning: z.array(z.string()),
  supportingEvidence: z.array(z.string()),
  opposingEvidence: z.array(z.string()),
  sourceIds: z.array(z.string()),
  generatedAt: z.string().datetime(),
  usage: z.object({
    promptTokens: z.number().int().min(0),
    completionTokens: z.number().int().min(0),
    latencyMs: z.number().int().min(0),
    estimatedCostUsd: z.number().min(0),
  }),
});

export type AgentReport = z.infer<typeof AgentReportSchema>;

/** Create an UNAVAILABLE report when the agent fails */
export function unavailableReport(
  agentId: string,
  agentVersion: string,
  promptVersion: string,
  requestedModel: string,
  asset: string,
  reason: string,
): AgentReport {
  return {
    status: "UNAVAILABLE",
    runId: `unavailable-${Date.now()}`,
    agentId,
    agentVersion,
    promptVersion,
    requestedModel,
    actualModel: null,
    asset,
    horizon: "SHORT",
    signal: null,
    score: 0,
    confidence: 0,
    dataQuality: 0,
    reasoning: [reason],
    supportingEvidence: [],
    opposingEvidence: [],
    sourceIds: [],
    generatedAt: new Date().toISOString(),
    usage: {
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: 0,
      estimatedCostUsd: 0,
    },
  };
}

/** Create an INVALID report when output validation fails */
export function invalidReport(
  agentId: string,
  agentVersion: string,
  promptVersion: string,
  requestedModel: string,
  asset: string,
  reason: string,
): AgentReport {
  return {
    status: "INVALID",
    runId: `invalid-${Date.now()}`,
    agentId,
    agentVersion,
    promptVersion,
    requestedModel,
    actualModel: null,
    asset,
    horizon: "SHORT",
    signal: null,
    score: 0,
    confidence: 0,
    dataQuality: 0,
    reasoning: [reason],
    supportingEvidence: [],
    opposingEvidence: [],
    sourceIds: [],
    generatedAt: new Date().toISOString(),
    usage: {
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: 0,
      estimatedCostUsd: 0,
    },
  };
}

