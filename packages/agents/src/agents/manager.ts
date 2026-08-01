import { z } from "zod";
import { BaseAgent } from "../base-agent.js";
import type { BaseAgentConfig, AgentRunContext } from "../base-agent.js";
import type { AgentReport, TradeSignal } from "../agent-report.js";
import { unavailableReport, invalidReport } from "../agent-report.js";
import type {
  TradeProposal,
} from "@cryptoai/risk-engine";

export interface ManagerAgentInput {
  symbol: string;
  reports: AgentReport[];
  /** Open positions for this asset (for portfolio-aware decisions) */
  openPositions?: Array<{
    side: string;
    quantity: number;
    entryPrice: number;
    currentPrice: number;
    unrealizedPnl: number;
  }>;
}

export interface ManagerRunResult {
  report: AgentReport;
  proposal: TradeProposal;
}

const ManagerOutputSchema = z.object({
  action: z.enum(["BUY", "SELL", "HOLD", "WAIT"]).nullable(),
  confidence: z.number().min(0).max(1),
  suggestedRiskFraction: z.number().min(0).max(1).nullable(),
  rationale: z.array(z.string()).min(1).max(10),
  invalidationConditions: z.array(z.string()).max(6),
  /** Whether there's significant disagreement among analysts */
  isAmbiguous: z.boolean(),
  /** If ambiguous, explain why */
  ambiguityReason: z.string().nullable(),
});

const SYSTEM_PROMPT = `You are the Investment Manager AI for a hybrid crypto investment system.

Your role: compare structured AgentReports from multiple specialized analyst AIs (Technical, Macro, News, Sentiment, Whale) and produce a single TradeProposal.

Rules:
- Each analyst report contains: signal (BUY/SELL/HOLD/WAIT), score (-1 to +1), confidence (0-1), dataQuality (0-1), reasoning, and evidence.
- You are the aggregator. Your job is to weigh the evidence and decide.
- DO NOT average scores blindly. Consider confidence AND data quality.
- If analysts strongly disagree (opposite signals with similar high confidence), flag as ambiguous. Do NOT force a consensus.
- If most analysts are HOLD/WAIT or unavailable, propose NO_ACTION.
- suggestedRiskFraction should reflect your overall conviction: 0.01 (1%) for low conviction, up to 0.05 (5%) for very high conviction. Only for BUY/SELL.
- Provide clear rationale referencing SPECIFIC agent reports and their findings.
- Provide invalidationConditions: what would make this proposal invalid (e.g., "BTC drops below $62K", "RSI crosses above 70").

Output ONLY this JSON schema (no markdown, no extra text):
{
  "action": "BUY" | "SELL" | "HOLD" | "WAIT" | null,
  "confidence": 0.5,
  "suggestedRiskFraction": 0.02,
  "rationale": ["reason 1", "reason 2"],
  "invalidationConditions": ["condition 1"],
  "isAmbiguous": false,
  "ambiguityReason": null
}

Field constraints:
- action: one of "BUY", "SELL", "HOLD", "WAIT", or null
- confidence: number 0.0 to 1.0 (REQUIRED, always include)
- suggestedRiskFraction: number 0.0 to 1.0, or null if not BUY/SELL
- rationale: array of strings, at least 1, max 10 (REQUIRED)
- invalidationConditions: array of strings, max 6 (REQUIRED, can be empty array [])
- isAmbiguous: boolean (REQUIRED)
- ambiguityReason: string or null (REQUIRED, set to null if not ambiguous)`;

function buildUserPrompt(input: ManagerAgentInput): string {
  const lines: string[] = [
    `Asset: ${input.symbol}`,
    "",
    `=== Analyst Reports (${input.reports.length} total) ===`,
    "",
  ];

  const validReports = input.reports.filter((r) => r.status === "VALID");
  const unavailableReports = input.reports.filter((r) => r.status !== "VALID");

  lines.push(`Valid reports: ${validReports.length}`);
  lines.push(`Unavailable/Invalid: ${unavailableReports.length}`);
  lines.push("");

  // Valid reports summary table
  lines.push("--- Valid Reports ---");
  for (const r of validReports) {
    lines.push(
      `[${r.agentId}] signal=${r.signal ?? "null"} score=${r.score.toFixed(2)} confidence=${r.confidence.toFixed(2)} dataQuality=${r.dataQuality.toFixed(2)} horizon=${r.horizon}`,
    );
    if (r.reasoning.length > 0) {
      lines.push(`  Reasoning: ${r.reasoning.join("; ")}`);
    }
    if (r.supportingEvidence.length > 0) {
      lines.push(`  Supporting: ${r.supportingEvidence.join("; ")}`);
    }
    if (r.opposingEvidence.length > 0) {
      lines.push(`  Opposing: ${r.opposingEvidence.join("; ")}`);
    }
    lines.push("");
  }

  // Unavailable reports
  if (unavailableReports.length > 0) {
    lines.push("--- Unavailable/Invalid Reports ---");
    for (const r of unavailableReports) {
      lines.push(`[${r.agentId}] status=${r.status} reason=${r.reasoning[0] ?? "unknown"}`);
    }
    lines.push("");
  }

  // Stats for the manager to consider
  const signals = validReports
    .map((r) => r.signal)
    .filter((s): s is TradeSignal => s !== null);
  const scores = validReports.map((r) => r.score);
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const buyCount = signals.filter((s) => s === "BUY").length;
  const sellCount = signals.filter((s) => s === "SELL").length;
  const holdCount = signals.filter((s) => s === "HOLD").length;
  const waitCount = signals.filter((s) => s === "WAIT").length;

  lines.push("--- Summary Statistics ---");
  lines.push(`BUY: ${buyCount}, SELL: ${sellCount}, HOLD: ${holdCount}, WAIT: ${waitCount}`);
  lines.push(`Average score: ${avgScore.toFixed(3)}`);
  lines.push(`Report IDs: ${validReports.map((r) => r.runId).join(", ")}`);

  // Open positions context — critical for exit decisions
  if (input.openPositions && input.openPositions.length > 0) {
    lines.push("");
    lines.push("--- Current Open Positions (YOU MUST CONSIDER THESE) ---");
    for (const pos of input.openPositions) {
      const pnlSign = pos.unrealizedPnl >= 0 ? "+" : "";
      lines.push(
        `[${pos.side}] qty=${pos.quantity.toFixed(6)} entry=$${pos.entryPrice.toFixed(2)} current=$${pos.currentPrice.toFixed(2)} unrealizedPnl=$${pnlSign}${pos.unrealizedPnl.toFixed(2)}`,
      );
    }
    lines.push("IMPORTANT: If a position is in significant loss with bearish technicals, consider SELL. If in profit and trend is weakening, consider taking profit.");
  }

  lines.push("");
  lines.push("Produce your TradeProposal as valid JSON.");

  return lines.join("\n");
}

/**
 * Investment Manager AI Agent.
 *
 * Aggregates all analyst AgentReports and produces a TradeProposal.
 * The Manager does NOT have access to orders or capital.
 * Output passes through the deterministic Decision Gate (Phase 4) and Risk Manager (Phase 2).
 */
export class ManagerAgent extends BaseAgent {
  private readonly ambiguityVarianceThreshold: number;
  private readonly minValidReports: number;

  constructor(config: Partial<BaseAgentConfig> & {
    ambiguityVarianceThreshold?: number;
    minValidReports?: number;
  } = {}) {
    super({
      agentId: config.agentId ?? "manager-agent",
      agentVersion: config.agentVersion ?? "1.0.0",
      promptVersion: config.promptVersion ?? "1.0.0",
      model: config.model,
      temperature: config.temperature ?? 0.2,
      maxTokens: config.maxTokens ?? 2000,
      reasoning: config.reasoning ?? "high",
    });
    this.ambiguityVarianceThreshold = config.ambiguityVarianceThreshold ?? 0.35;
    this.minValidReports = config.minValidReports ?? 3;
  }

  async run(context: AgentRunContext & { input: ManagerAgentInput }): Promise<AgentReport> {
    const result = await this.runProposal(context);
    return result.report;
  }

  /**
   * Run the manager and return both its auditable AgentReport and its
   * deterministic-boundary TradeProposal. The proposal never contains an
   * executable order or an amount decided by the model.
   */
  async runProposal(context: AgentRunContext & { input: ManagerAgentInput }): Promise<ManagerRunResult> {
    const { symbol, reports } = context.input;
    const validReports = reports.filter((r) => r.status === "VALID");

    // Quorum check: not enough valid reports
    if (validReports.length < this.minValidReports) {
      const report = unavailableReport(
        this.agentId,
        this.agentVersion,
        this.promptVersion,
        this.model,
        symbol,
        `Insufficient valid reports: ${validReports.length}/${reports.length} (minimum ${this.minValidReports})`,
      );
      return { report, proposal: unavailableProposal(symbol, report.reasoning[0] ?? "Insufficient valid reports") };
    }

    try {
      const userPrompt = buildUserPrompt(context.input);

      const response = await context.gateway.structuredCall(
        SYSTEM_PROMPT,
        userPrompt,
        ManagerOutputSchema,
        this.callOptions,
        this.promptVersion,
        "1.0.0",
      );

      if (response.status === "UNAVAILABLE") {
        const report = unavailableReport(
          this.agentId,
          this.agentVersion,
          this.promptVersion,
          this.model,
          symbol,
          response.error?.message ?? "AI Gateway unavailable",
        );
        return { report, proposal: unavailableProposal(symbol, report.reasoning[0] ?? "AI Gateway unavailable") };
      }

      if (response.status === "INVALID" || response.data === null) {
        const report = invalidReport(
          this.agentId,
          this.agentVersion,
          this.promptVersion,
          this.model,
          symbol,
          response.error?.message ?? "Invalid manager output",
        );
        return { report, proposal: { ...unavailableProposal(symbol, report.reasoning[0] ?? "Invalid manager output"), status: "INVALID" } };
      }

      const output = response.data;
      const determAmbiguity = this.detectAmbiguity(validReports);
      const isAmbiguous = determAmbiguity.isAmbiguous || output.isAmbiguous;
      const reportIds = validReports.map((r) => r.runId);
      const averageDataQuality = validReports.reduce((sum, r) => sum + r.dataQuality, 0) / validReports.length;
      const report: AgentReport = {
        status: "VALID",
        runId: response.runId,
        agentId: this.agentId,
        agentVersion: this.agentVersion,
        promptVersion: this.promptVersion,
        requestedModel: response.requestedModel,
        actualModel: response.actualModel,
        asset: symbol,
        horizon: "MEDIUM",
        signal: isAmbiguous ? null : output.action,
        score: output.action === "BUY" ? output.confidence : output.action === "SELL" ? -output.confidence : 0,
        confidence: output.confidence,
        dataQuality: averageDataQuality,
        reasoning: isAmbiguous
          ? [`AMBIGUOUS: ${determAmbiguity.reason || output.ambiguityReason || "Manager flagged significant disagreement"}`, ...output.rationale]
          : output.rationale,
        supportingEvidence: validReports.flatMap((r) => r.supportingEvidence).slice(0, 20),
        opposingEvidence: validReports.flatMap((r) => r.opposingEvidence).slice(0, 20),
        sourceIds: reportIds,
        generatedAt: response.generatedAt,
        usage: response.usage ?? { promptTokens: 0, completionTokens: 0, latencyMs: 0, estimatedCostUsd: 0 },
      };

      // Build the TradeProposal
      const proposal: TradeProposal = {
        status: isAmbiguous ? "AMBIGUOUS" : output.action === null || output.action === "HOLD" || output.action === "WAIT" ? "NO_ACTION" : "VALID",
        asset: symbol,
        action: isAmbiguous ? null : output.action,
        confidence: output.confidence,
        rationale: isAmbiguous && output.ambiguityReason ? [output.ambiguityReason, ...output.rationale] : output.rationale,
        reportIds,
        suggestedRiskFraction: !isAmbiguous && (output.action === "BUY" || output.action === "SELL") ? output.suggestedRiskFraction : null,
        invalidationConditions: output.invalidationConditions,
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      };

      return { report, proposal };
    } catch (err) {
      const report = unavailableReport(
        this.agentId,
        this.agentVersion,
        this.promptVersion,
        this.model,
        symbol,
        err instanceof Error ? err.message : "Manager agent failed",
      );
      return { report, proposal: unavailableProposal(symbol, report.reasoning[0] ?? "Manager agent failed") };
    }
  }

  /**
   * Deterministic ambiguity detection.
   * Checks for:
   * 1. High variance in confidence-weighted scores
   * 2. Conflicting signals (BUY vs SELL) with comparable confidence
   */
  private detectAmbiguity(validReports: AgentReport[]): { isAmbiguous: boolean; reason: string } {
    const reportsWithSignal = validReports.filter(
      (r) => r.signal !== null && r.signal !== "HOLD" && r.signal !== "WAIT",
    );

    if (reportsWithSignal.length < 2) {
      return { isAmbiguous: false, reason: "" };
    }

    // Check for BUY vs SELL conflict
    const hasBuy = reportsWithSignal.some((r) => r.signal === "BUY");
    const hasSell = reportsWithSignal.some((r) => r.signal === "SELL");

    if (hasBuy && hasSell) {
      const buyConfidence = reportsWithSignal
        .filter((r) => r.signal === "BUY")
        .reduce((sum, r) => sum + r.confidence, 0);
      const sellConfidence = reportsWithSignal
        .filter((r) => r.signal === "SELL")
        .reduce((sum, r) => sum + r.confidence, 0);

      // If both sides have similar total confidence (within 40% of each other)
      const maxConf = Math.max(buyConfidence, sellConfidence);
      const minConf = Math.min(buyConfidence, sellConfidence);

      if (maxConf > 0 && minConf / maxConf > 0.6) {
        return {
          isAmbiguous: true,
          reason: `Conflicting BUY/SELL signals with comparable confidence (BUY=${buyConfidence.toFixed(2)}, SELL=${sellConfidence.toFixed(2)})`,
        };
      }
    }

    // Check for high variance in confidence-weighted scores
    const scores = validReports.map((r) => r.score * r.confidence);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance =
      scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;

    if (variance > this.ambiguityVarianceThreshold) {
      return {
        isAmbiguous: true,
        reason: `High variance in confidence-weighted scores (${variance.toFixed(3)} > ${this.ambiguityVarianceThreshold})`,
      };
    }

    return { isAmbiguous: false, reason: "" };
  }
}

function unavailableProposal(asset: string, reason: string): TradeProposal {
  return {
    status: "UNAVAILABLE",
    asset,
    action: null,
    confidence: 0,
    rationale: [reason],
    reportIds: [],
    suggestedRiskFraction: null,
    invalidationConditions: [],
    expiresAt: null,
  };
}
