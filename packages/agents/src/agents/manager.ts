import { z } from "zod";
import { BaseAgent } from "../base-agent.js";
import type { BaseAgentConfig, AgentRunContext } from "../base-agent.js";
import type { AgentReport, TradeSignal } from "../agent-report.js";
import { unavailableReport } from "../agent-report.js";
import type {
  TradeProposal,
} from "@cryptoai/risk-engine";

export interface ManagerAgentInput {
  symbol: string;
  reports: AgentReport[];
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
- Output ONLY valid JSON matching the schema.`;

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
      model: config.model ?? "deepseek/deepseek-v4-pro",
      temperature: config.temperature ?? 0.2,
      maxTokens: config.maxTokens ?? 2000,
      reasoning: config.reasoning ?? "high",
    });
    this.ambiguityVarianceThreshold = config.ambiguityVarianceThreshold ?? 0.35;
    this.minValidReports = config.minValidReports ?? 3;
  }

  async run(context: AgentRunContext & { input: ManagerAgentInput }): Promise<AgentReport> {
    const { symbol, reports } = context.input;
    const validReports = reports.filter((r) => r.status === "VALID");

    // Quorum check: not enough valid reports
    if (validReports.length < this.minValidReports) {
      return unavailableReport(
        this.agentId,
        this.agentVersion,
        this.promptVersion,
        this.model,
        symbol,
        `Insufficient valid reports: ${validReports.length}/${reports.length} (minimum ${this.minValidReports})`,
      );
    }

    try {
      const userPrompt = buildUserPrompt(context.input);

      const baseReport = await this.callGateway(
        context.gateway,
        SYSTEM_PROMPT,
        userPrompt,
        ManagerOutputSchema,
        context,
      );

      if (baseReport.status !== "VALID") {
        return baseReport;
      }

      // Deterministic ambiguity detection (pre-check)
      const determAmbiguity = this.detectAmbiguity(validReports);

      // Build the TradeProposal
      const proposal: TradeProposal = {
        status: "VALID",
        asset: symbol,
        action: baseReport.signal,
        confidence: baseReport.confidence,
        rationale: baseReport.reasoning,
        reportIds: validReports.map((r) => r.runId),
        suggestedRiskFraction: baseReport.signal === "BUY" || baseReport.signal === "SELL"
          ? (baseReport as unknown as { suggestedRiskFraction?: number | null }).suggestedRiskFraction ?? baseReport.confidence * 0.05
          : null,
        invalidationConditions: (baseReport as unknown as { invalidationConditions?: string[] }).invalidationConditions ?? [],
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      };

      // If managerial ambiguity detected OR AI flagged ambiguity, override status
      if (determAmbiguity.isAmbiguous) {
        proposal.status = "AMBIGUOUS";
        proposal.action = null;
        proposal.suggestedRiskFraction = null;

        return {
          ...baseReport,
          status: "VALID", // Manager report itself is VALID; the proposal carries AMBIGUOUS
          signal: null,
          reasoning: [
            `AMBIGUOUS: ${determAmbiguity.reason}`,
            ...baseReport.reasoning,
          ],
        };
      }

      // If no clear action, set NO_ACTION
      if (proposal.action === null || proposal.action === "HOLD" || proposal.action === "WAIT") {
        proposal.status = "NO_ACTION";
        proposal.suggestedRiskFraction = null;
      }

      // Return the AgentReport enriched with proposal data
      return baseReport;
    } catch (err) {
      return unavailableReport(
        this.agentId,
        this.agentVersion,
        this.promptVersion,
        this.model,
        symbol,
        err instanceof Error ? err.message : "Manager agent failed",
      );
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

